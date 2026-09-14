import React, { useState, useMemo, useEffect, useRef } from "react";
import Button from "@shared/components/ui/Button";
import Badge from "@shared/components/ui/Badge";
import {
  HiOutlineArrowLeft,
  HiOutlineCube,
  HiOutlineTag,
  HiOutlineSwatch,
  HiOutlineFolderOpen,
  HiOutlineArrowPath,
  HiOutlineTrash,
  HiOutlinePlus,
  HiOutlineSquaresPlus,
  HiOutlineCurrencyRupee,
} from "react-icons/hi2";
import { useNavigate, useSearchParams } from "react-router-dom";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { sellerApi } from "../services/sellerApi";
import { useAuthStore } from "@/core/auth/auth.store";
import {
  clearSellerProductAddDraft,
  draftMatchesSeller,
  hydrateProductFormFromDraft,
  newProductPublishId,
  readSellerProductAddDraft,
  serializeProductFormForDraft,
  writeSellerProductAddDraft,
} from "../utils/productAddDraft";
import VariantImageSlots from "@/shared/components/products/VariantImageSlots";
import {
  MAX_PRODUCT_VARIANTS,
  MAX_VARIANT_IMAGES,
  MIN_VARIANT_IMAGES,
  countVariantMedia,
  appendVariantImageFiles,
  serializeVariantsForApi,
} from "@/shared/utils/variantMedia";


const normalizeType = (type) =>
  (type || "quick_commerce").toLowerCase().replace(/\s+/g, "_");

const normalizeSlugKey = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-");

/** Pharmacy catalog headers: businessType=pharmacy (legacy slug/name fallback). */
const isPharmacyHeader = (header) => {
  const businessType = normalizeType(header?.businessType);
  if (businessType === "pharmacy") return true;
  if (businessType && businessType !== "default" && businessType !== "quick_commerce") {
    return false;
  }
  const slug = normalizeSlugKey(header?.slug);
  if (slug === "pharmacy") return true;
  return normalizeSlugKey(header?.name) === "pharmacy";
};

const PHARMACY_DOSAGE_FORM_OPTIONS = [
  { value: "tablet", label: "Tablet" },
  { value: "capsule", label: "Capsule" },
  { value: "syrup", label: "Syrup" },
  { value: "injection", label: "Injection" },
  { value: "drops", label: "Drops" },
  { value: "cream", label: "Cream" },
  { value: "ointment", label: "Ointment" },
  { value: "powder", label: "Powder" },
  { value: "spray", label: "Spray" },
  { value: "inhaler", label: "Inhaler" },
  { value: "medical_device", label: "Medical Device" },
  { value: "other", label: "Other" },
];

const PHARMACY_PACK_TYPE_OPTIONS = [
  { value: "strip", label: "Strip" },
  { value: "bottle", label: "Bottle" },
  { value: "box", label: "Box" },
  { value: "tube", label: "Tube" },
  { value: "vial", label: "Vial" },
  { value: "device", label: "Device" },
  { value: "piece", label: "Piece" },
];

const PHARMACY_UNIT_OPTIONS = [
  { value: "tablet", label: "Tablet" },
  { value: "capsule", label: "Capsule" },
  { value: "ml", label: "ml" },
  { value: "gm", label: "gm" },
  { value: "piece", label: "Piece" },
  { value: "vial", label: "Vial" },
  { value: "strip", label: "Strip" },
];

const PHARMACY_CLASSIFICATION_OPTIONS = [
  { value: "otc", label: "OTC" },
  { value: "prescription", label: "Prescription" },
  { value: "ayurvedic", label: "Ayurvedic" },
  { value: "homeopathic", label: "Homeopathic" },
  { value: "surgical", label: "Surgical" },
  { value: "medical_device", label: "Medical Device" },
  { value: "other", label: "Other" },
];

const toLocalIsoDate = (date = new Date()) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const TODAY_ISO = toLocalIsoDate();
const TOMORROW_ISO = (() => {
  const next = new Date();
  next.setDate(next.getDate() + 1);
  return toLocalIsoDate(next);
})();

const DEFAULT_PRODUCT_FORM = {
  name: "",
  slug: "",
  sku: "",
  description: "",
  price: "",
  salePrice: "",
  packingFee: "",
  stock: "",
  lowStockAlert: 5,
  category: "",
  subcategory: "",
  header: "",
  status: "active",
  tags: "",
  weight: "",
  brand: "",
  pharmacyDetails: {
    genericName: "",
    manufacturer: "",
    composition: "",
    strength: "",
    dosageForm: "tablet",
    packType: "strip",
    packQuantity: 10,
    unit: "tablet",
    storageCondition: "",
    prescriptionRequired: false,
    drugClassification: "otc",
    drugLicenseNumber: "",
    hsnCode: "",
    batchNumber: "",
    mfgDate: "",
    expDate: "",
    // Legacy/free-text fallback kept for backwards compatibility.
    packSize: "",
  },
  variants: [{ id: Date.now(), name: "", price: "", salePrice: "", stock: "", sku: "", media: [] }],
};

const getAddProductTabs = (businessType) => [
  { id: "general", label: "General Info" },
  ...(businessType === "pharmacy" ? [{ id: "medicine", label: "Medicine Details" }] : []),
  { id: "variants", label: "Item Variants" },
  { id: "category", label: "Groups" },
];

const AddProduct = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const user = useAuthStore(state => state.user);
  const sellerId = String(user?._id || user?.id || user?.phone || "").trim();
  const sellerBusinessType = normalizeType(user?.shopInfo?.businessType);
  const productTabs = useMemo(
    () => getAddProductTabs(sellerBusinessType),
    [sellerBusinessType],
  );
  const [modalTab, setModalTab] = useState("general");
  const [isSaving, setIsSaving] = useState(false);
  const saveLockRef = useRef(false);
  const [clientRequestId, setClientRequestId] = useState("");
  const [submitStatus, setSubmitStatus] = useState("idle");
  const [pharmacyVariantsEnabled, setPharmacyVariantsEnabled] = useState(false);
  const [addMethod, setAddMethod] = useState(null); // 'single', 'bulk', or null
  const [draftReady, setDraftReady] = useState(false);
  const draftHydratedRef = useRef(false);

  const validateCurrentTab = () => {
    if (modalTab === "general") {
      if (!String(formData.name || "").trim()) {
        toast.error("Please fill in the Product Title");
        return false;
      }
    }

    if (modalTab === "medicine" && sellerBusinessType === "pharmacy") {
      const pd = formData.pharmacyDetails || {};
      if (!pd.genericName || !pd.manufacturer) {
        toast.error("Please fill Generic Name and Manufacturer");
        return false;
      }
    }

    if (modalTab === "variants") {
      const variants = Array.isArray(formData.variants) ? formData.variants : [];
      if (!variants.length) {
        toast.error("Add at least one variant with price and stock");
        return false;
      }
      for (const variant of variants) {
        if (!String(variant.name || "").trim()) {
          toast.error("Each variant needs a name (e.g. 1kg, 500ml)");
          return false;
        }
        if (!variant.price || Number(variant.price) < 1) {
          toast.error(`Variant "${variant.name}": price must be at least ₹1`);
          return false;
        }
        if (variant.stock === "" || variant.stock == null || Number(variant.stock) < 0) {
          toast.error(`Variant "${variant.name}": stock is required`);
          return false;
        }
        if (variant.salePrice && Number(variant.salePrice) > 0 && Number(variant.salePrice) > Number(variant.price)) {
          toast.error(`Variant "${variant.name}": sale price cannot be higher than price`);
          return false;
        }
        if (countVariantMedia(variant) < MIN_VARIANT_IMAGES) {
          toast.error(`Variant "${variant.name || ` #${variants.indexOf(variant) + 1}`}": add at least ${MIN_VARIANT_IMAGES} photo`);
          return false;
        }
        if (countVariantMedia(variant) > MAX_VARIANT_IMAGES) {
          toast.error(`Variant "${variant.name}": maximum ${MAX_VARIANT_IMAGES} photos allowed`);
          return false;
        }
      }
    }

    if (modalTab === "category") {
      if (!formData.header || !formData.category || !formData.subcategory) {
        toast.error("Please select Main Group, Category, and Sub-Category");
        return false;
      }
    }

    return true;
  };

  const goToNextTab = () => {
    if (!validateCurrentTab()) return;
    const index = productTabs.findIndex((tab) => tab.id === modalTab);
    if (index < 0 || index >= productTabs.length - 1) return;
    setModalTab(productTabs[index + 1].id);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const renderContinueButton = (nextLabel) => {
    const index = productTabs.findIndex((tab) => tab.id === modalTab);
    const nextTab = index >= 0 ? productTabs[index + 1] : null;
    const isLast = !nextTab;
    return (
      <div className="pt-4 mt-2 border-t border-slate-100">
        <button
          type="button"
          onClick={isLast ? handleSave : goToNextTab}
          disabled={isLast && isSaving}
          className="w-full h-11 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-60 active:scale-[0.99] text-white text-sm font-semibold shadow-sm transition-all"
        >
          {isLast
            ? isSaving
              ? "Publishing..."
              : "Save & Publish"
            : `Continue${nextLabel || nextTab.label ? ` to ${nextLabel || nextTab.label}` : ""}`}
        </button>
      </div>
    );
  };

  const sanitizeDigits = (value = "") => String(value).replace(/\D+/g, "");

  const sanitizeLicense = (value = "") =>
    String(value)
      .toUpperCase()
      .replace(/\s+/g, "")
      .replace(/[^A-Z0-9/-]+/g, "");

  const sanitizeBatch = (value = "") =>
    String(value)
      .toUpperCase()
      .replace(/\s+/g, "")
      .replace(/[^A-Z0-9-]+/g, "");

  const [formData, setFormData] = useState(() => ({ ...DEFAULT_PRODUCT_FORM }));

  const [dbCategories, setDbCategories] = useState([]);
  const [isLoadingCats, setIsLoadingCats] = useState(true);

  const selectAddMethod = (method) => {
    setAddMethod(method);
    if (method === "single" || method === "bulk") {
      setSearchParams({ method }, { replace: true });
    } else {
      setSearchParams({}, { replace: true });
    }
  };

  const leaveAddProduct = () => {
    clearSellerProductAddDraft();
    navigate("/seller/products");
  };

  // Restore draft + URL method after auth is known (avoids flashing the picker).
  useEffect(() => {
    if (!sellerId || draftHydratedRef.current) return;
    draftHydratedRef.current = true;

    const methodFromUrl = String(searchParams.get("method") || "").toLowerCase();
    const draft = readSellerProductAddDraft();
    const matched = draftMatchesSeller(draft, sellerId) ? draft : null;

    const nextMethod =
      methodFromUrl === "single" || methodFromUrl === "bulk"
        ? methodFromUrl
        : matched?.addMethod === "single" || matched?.addMethod === "bulk"
          ? matched.addMethod
          : null;

    if (nextMethod) {
      setAddMethod(nextMethod);
      if (methodFromUrl !== nextMethod) {
        setSearchParams({ method: nextMethod }, { replace: true });
      }
    }

    if (matched) {
      if (matched.modalTab && matched.modalTab !== "pricing") {
        setModalTab(matched.modalTab === "media" ? "variants" : matched.modalTab);
      } else       if (matched.modalTab === "pricing") setModalTab("variants");
      if (typeof matched.pharmacyVariantsEnabled === "boolean") {
        setPharmacyVariantsEnabled(matched.pharmacyVariantsEnabled);
      }
      if (matched.clientRequestId) {
        setClientRequestId(String(matched.clientRequestId));
      }
      if (matched.submitStatus === "publishing") {
        setSubmitStatus("publishing");
        toast.info("Last publish was still processing. Saving again will not create a duplicate.");
      }
      if (matched.formData && typeof matched.formData === "object") {
        const hydrated = hydrateProductFormFromDraft(matched.formData);
        const restoredVariants = Array.isArray(hydrated.variants) && hydrated.variants.length
          ? hydrated.variants
          : [{ id: Date.now(), name: "", price: "", salePrice: "", stock: "", sku: "", media: [] }];
        setFormData((prev) => ({
          ...prev,
          ...hydrated,
          pharmacyDetails: {
            ...prev.pharmacyDetails,
            ...(hydrated.pharmacyDetails || {}),
          },
          variants: restoredVariants,
        }));
      }
    }

    setDraftReady(true);
  }, [sellerId]);

  useEffect(() => {
    if (!draftReady) return;
    setClientRequestId((prev) => prev || newProductPublishId());
  }, [draftReady]);

  // Persist while editing so refresh keeps single/bulk + filled fields + tab.
  useEffect(() => {
    if (!sellerId || !draftReady) return;
    const timer = window.setTimeout(() => {
      const pendingBlobPreview = (formData.variants || []).some((variant) =>
        (variant.media || []).some((item) => String(item?.preview || "").startsWith("blob:")),
      );
      // Wait until blob previews become data URLs so refresh can restore them.
      if (pendingBlobPreview) return;
      writeSellerProductAddDraft({
        sellerId,
        addMethod,
        modalTab,
        pharmacyVariantsEnabled,
        clientRequestId,
        submitStatus,
        formData: serializeProductFormForDraft(formData),
        updatedAt: Date.now(),
      });
    }, 250);
    return () => window.clearTimeout(timer);
  }, [
    sellerId,
    draftReady,
    addMethod,
    modalTab,
    pharmacyVariantsEnabled,
    clientRequestId,
    submitStatus,
    formData,
  ]);

  React.useEffect(() => {
    const fetchCats = async () => {
      try {
        const res = await sellerApi.getCategoryTree();
        if (res.data.success) {
          setDbCategories(res.data.results || res.data.result || []);
        }
      } catch (error) {
        toast.error("Failed to load categories");
      } finally {
        setIsLoadingCats(false);
      }
    };
    fetchCats();
  }, []);

  const categories = dbCategories;

  const getCategoryNodeId = (node) => String(node?._id || node?.id || "");

  // Keep all three levels in sync. Selects have no empty placeholder, so when a
  // parent change clears child IDs the browser still shows the first option —
  // re-fill empty/invalid IDs so UI and form state stay aligned.
  React.useEffect(() => {
    if (isLoadingCats) return;
    if (!Array.isArray(categories) || categories.length === 0) return;

    setFormData((prev) => {
      const currentHeaderId = String(prev.header || "");
      const headerObj =
        categories.find((h) => getCategoryNodeId(h) === currentHeaderId) || categories[0];

      const nextHeaderId = getCategoryNodeId(headerObj);
      const children = headerObj?.children || [];

      const currentCategoryId = String(prev.category || "");
      const categoryObj =
        children.find((c) => getCategoryNodeId(c) === currentCategoryId) || children[0];

      const nextCategoryId = getCategoryNodeId(categoryObj);
      const subList = categoryObj?.children || [];

      const currentSubId = String(prev.subcategory || "");
      const subObj =
        subList.find((sc) => getCategoryNodeId(sc) === currentSubId) || subList[0];

      const nextSubId = getCategoryNodeId(subObj);

      const shouldUpdateHeader = !currentHeaderId || getCategoryNodeId(headerObj) !== currentHeaderId;
      const shouldUpdateCategory = !currentCategoryId || getCategoryNodeId(categoryObj) !== currentCategoryId;
      const shouldUpdateSub = !currentSubId || getCategoryNodeId(subObj) !== currentSubId;

      if (!shouldUpdateHeader && !shouldUpdateCategory && !shouldUpdateSub) return prev;

      return {
        ...prev,
        header: shouldUpdateHeader ? nextHeaderId : prev.header,
        category: shouldUpdateCategory ? nextCategoryId : prev.category,
        subcategory: shouldUpdateSub ? nextSubId : prev.subcategory,
      };
    });
  }, [categories, isLoadingCats, formData.header, formData.category, formData.subcategory]);

  const handleSave = async () => {
    if (isSaving || saveLockRef.current) return;

    // Validate required fields
    if (!formData.name) {
      toast.error("Please fill in the Product Title");
      return;
    }

    // Validate all three category levels are selected
    if (!formData.header || !formData.category || !formData.subcategory) {
      toast.error("Please select all three category levels: Main Group, Specific Category, and Sub-Category");
      return;
    }

    if (sellerBusinessType === "pharmacy") {
      const pd = formData.pharmacyDetails || {};
      if (!pd.genericName || !pd.manufacturer) {
        toast.error("Please fill Generic Name and Manufacturer in Medicine Details");
        return;
      }
      if (!pd.dosageForm || !pd.packType || !pd.unit || !pd.packQuantity || Number(pd.packQuantity) < 1) {
        toast.error("Please fill Dosage Form, Pack Type, Pack Quantity and Unit in Medicine Details");
        return;
      }

      // Pharmacy numeric/format validation
      if (pd.hsnCode) {
        const digitsOnly = sanitizeDigits(pd.hsnCode);
        if (digitsOnly !== String(pd.hsnCode)) {
          toast.error("HSN Code must contain digits only");
          return;
        }
        // Common HSN length is 4/6/8 digits. Keep it flexible but block too-short values.
        if (digitsOnly.length < 4 || digitsOnly.length > 8) {
          toast.error("HSN Code must be 4 to 8 digits");
          return;
        }
      }

      if (pd.drugLicenseNumber) {
        const normalized = sanitizeLicense(pd.drugLicenseNumber);
        if (normalized !== String(pd.drugLicenseNumber).toUpperCase().replace(/\s+/g, "")) {
          toast.error("Drug License Number format is invalid");
          return;
        }
      }

      if (pd.batchNumber) {
        const normalized = sanitizeBatch(pd.batchNumber);
        if (normalized !== String(pd.batchNumber).toUpperCase().replace(/\s+/g, "")) {
          toast.error("Batch Number format is invalid");
          return;
        }
      }

      if (pd.mfgDate && pd.mfgDate > TODAY_ISO) {
        toast.error("Manufacturing date cannot be in the future");
        setModalTab("medicine");
        return;
      }
      if (pd.expDate && pd.expDate <= TODAY_ISO) {
        toast.error("Expiry date must be a future date");
        setModalTab("medicine");
        return;
      }
      if (pd.mfgDate && pd.expDate && pd.expDate <= pd.mfgDate) {
        toast.error("Expiry date must be after manufacturing date");
        setModalTab("medicine");
        return;
      }
    }

    const variants = Array.isArray(formData.variants) ? formData.variants : [];
    if (!variants.length) {
      toast.error("Add at least one variant with price and stock");
      setModalTab("variants");
      return;
    }

    for (const variant of variants) {
      if (!String(variant.name || "").trim()) {
        toast.error("Each variant needs a name (e.g. 1kg, 500ml)");
        setModalTab("variants");
        return;
      }
      if (!variant.price || Number(variant.price) < 1) {
        toast.error(`Variant "${variant.name}": price must be at least ₹1`);
        setModalTab("variants");
        return;
      }
      if (variant.stock === "" || variant.stock == null || Number(variant.stock) < 0) {
        toast.error(`Variant "${variant.name}": stock is required`);
        setModalTab("variants");
        return;
      }
      if (variant.salePrice && Number(variant.salePrice) > 0 && Number(variant.salePrice) > Number(variant.price)) {
        toast.error(`Variant "${variant.name}": sale price cannot be higher than price`);
        setModalTab("variants");
        return;
      }
      if (countVariantMedia(variant) < MIN_VARIANT_IMAGES) {
        toast.error(`Variant "${variant.name || `#${variants.indexOf(variant) + 1}`}": add at least ${MIN_VARIANT_IMAGES} photo`);
        setModalTab("variants");
        return;
      }
      if (countVariantMedia(variant) > MAX_VARIANT_IMAGES) {
        toast.error(`Variant "${variant.name}": maximum ${MAX_VARIANT_IMAGES} photos allowed`);
        setModalTab("variants");
        return;
      }
    }

    if (variants.length > MAX_PRODUCT_VARIANTS) {
      toast.error(`Maximum ${MAX_PRODUCT_VARIANTS} variants allowed`);
      setModalTab("variants");
      return;
    }

    const firstVariant = variants[0] || {};
    const publishId = clientRequestId || newProductPublishId();
    if (!clientRequestId) setClientRequestId(publishId);

    saveLockRef.current = true;
    setIsSaving(true);
    setSubmitStatus("publishing");
    writeSellerProductAddDraft({
      sellerId,
      addMethod,
      modalTab,
      pharmacyVariantsEnabled,
      clientRequestId: publishId,
      submitStatus: "publishing",
      formData: serializeProductFormForDraft(formData),
      updatedAt: Date.now(),
    });
    try {
      const data = new FormData();

      // Basic fields
      data.append("name", formData.name);
      data.append("slug", formData.slug);
      data.append("sku", formData.sku);
      data.append("description", formData.description);
      data.append("brand", formData.brand);
      data.append("weight", formData.weight);
      data.append("status", formData.status);

      // Parent price/stock derived from variants (backend also re-derives).
      data.append("price", firstVariant.price || 0);
      data.append("salePrice", firstVariant.salePrice || 0);
      data.append("packingFee", formData.packingFee || 0);
      data.append(
        "stock",
        variants.reduce((sum, v) => sum + (Number(v.stock) || 0), 0),
      );
      data.append("lowStockAlert", formData.lowStockAlert || 5);

      // Category IDs
      data.append("headerId", formData.header);
      data.append("categoryId", formData.category);
      data.append("subcategoryId", formData.subcategory);

      // Tags
      data.append("tags", formData.tags);

      // Pharmacy Details
      if (sellerBusinessType === "pharmacy") {
        data.append("pharmacyDetails", JSON.stringify(formData.pharmacyDetails));
      }

      // Variants + per-variant images
      data.append("variants", JSON.stringify(serializeVariantsForApi(formData.variants)));
      appendVariantImageFiles(data, formData.variants);
      data.append("clientRequestId", publishId);

      await sellerApi.createProduct(data);
      toast.success("Product saved successfully!");
      clearSellerProductAddDraft();
      saveLockRef.current = false;
      setSubmitStatus("idle");
      navigate("/seller/products");
    } catch (error) {
      saveLockRef.current = false;
      setSubmitStatus("idle");
      toast.error(error.response?.data?.message || "Failed to save product");
    } finally {
      setIsSaving(false);
    }
  };

  const [csvFile, setCsvFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [validationErrors, setValidationErrors] = useState([]);
  const [criticalError, setCriticalError] = useState(null);

  const downloadTemplate = () => {
    let headers = [
      "name", "description", "brand", "price", "salePrice", "stock", "lowStockAlert",
      "header", "category", "subcategory", "mainImage", "galleryImages", "status",
      "variantName", "variantPrice", "variantSalePrice", "variantStock"
    ];
    let sampleRow = [
      "Organic Baby Puree",
      "Delicious organic baby puree mix",
      "NutriBaby",
      "110",
      "89",
      "120",
      "10",
      "Kids",
      "Kids Food",
      "Baby Food",
      "https://images.unsplash.com/photo-1596263576925-d90d63691097",
      "https://images.unsplash.com/photo-1596263576925-d90d63691097",
      "active",
      "200g Pack",
      "110",
      "89",
      "120"
    ];

    if (sellerBusinessType === "pharmacy") {
      headers = [
        ...headers,
        "genericName", "manufacturer", "composition", "strength", "dosageForm", "packType",
        "packQuantity", "unit", "storageCondition", "prescriptionRequired",
        "drugClassification", "drugLicenseNumber", "hsnCode", "batchNumber",
        "mfgDate", "expDate", "packSize"
      ];
      sampleRow = [
        "Paracetamol 500mg Strip",
        "Effective pain relief and fever reduction",
        "GSK Pharma",
        "15",
        "12",
        "200",
        "50",
        "Pharmacy",
        "Medicines",
        "Pain Relief",
        "https://images.unsplash.com/photo-1584308666744-24d5e4719bbd",
        "https://images.unsplash.com/photo-1584308666744-24d5e4719bbd",
        "active",
        "Strip of 10",
        "15",
        "12",
        "200",
        "Paracetamol", "GSK Pharma", "Paracetamol 500mg", "500mg", "tablet", "strip",
        "10", "tablet", "Store in a cool dry place", "No",
        "otc", "DL-123456", "300490", "B-9988",
        "2023-01", "2025-01", "10 tablets"
      ];
    }

    // Escaping commas by quoting values
    const escapedRow = sampleRow.map(val => `"${String(val).replace(/"/g, '""')}"`);
    const csvContent = [headers.join(","), escapedRow.join(",")].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "product_bulk_upload_template.csv");
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleBulkUpload = async (e) => {
    e.preventDefault();
    if (!csvFile) {
      toast.error("Please select a CSV file first");
      return;
    }

    setIsUploading(true);
    setValidationErrors([]);
    setCriticalError(null);

    try {
      const data = new FormData();
      data.append("csvFile", csvFile);

      const res = await sellerApi.bulkUploadProducts(data);
      if (res.data.success) {
        toast.success(res.data.message || "Products imported successfully!");
        clearSellerProductAddDraft();
        navigate("/seller/products");
      }
    } catch (error) {
      const resData = error.response?.data;
      if (resData?.errors && Array.isArray(resData.errors)) {
        setValidationErrors(resData.errors);
        toast.error("CSV Validation Failed. Please review the errors.");
      } else {
        setCriticalError(resData?.message || "Failed to upload and import products due to an unexpected server error.");
        toast.error("Failed to upload and import products.");
      }
    } finally {
      setIsUploading(false);
    }
  };

  if (!sellerId || !draftReady) {
    return (
      <div className="max-w-4xl mx-auto py-20 flex justify-center text-sm font-medium text-slate-400">
        Loading...
      </div>
    );
  }

  if (addMethod === null) {
    return (
      <div className="w-full max-w-4xl md:max-w-none mx-auto space-y-4 pb-20 px-3.5 md:px-4 animate-in fade-in duration-300">
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            className="pl-0 hover:bg-transparent hover:text-red-600"
            onClick={leaveAddProduct}>
            <HiOutlineArrowLeft className="mr-2 h-5 w-5" />
            Back to Products
          </Button>
        </div>

        <div className="text-center space-y-0.5 py-1">
          <h2 className="text-lg sm:text-xl font-semibold text-[#1c1c1e] tracking-tight">Add New Product</h2>
          <p className="text-xs text-slate-500 font-normal">
            Choose how you want to add products to your store.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          {/* Card 1: Single Add */}
          <div
            onClick={() => selectAddMethod("single")}
            className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200/80 shadow-2xs hover:border-slate-300 transition-all cursor-pointer group flex flex-col items-center text-center space-y-2"
          >
            <div className="h-9 w-9 rounded-lg bg-red-50 border border-red-200/60 text-red-600 flex items-center justify-center shrink-0 shadow-2xs group-hover:bg-red-600 group-hover:text-white transition-colors">
              <HiOutlineCube className="h-5 w-5" />
            </div>
            <h3 className="text-sm font-semibold text-[#1c1c1e]">Single Product</h3>
            <p className="text-xs text-slate-500 font-normal leading-relaxed">
              Add a single product manually with custom photos, descriptions, and variant configurations.
            </p>
            <span className="text-[11px] font-semibold text-red-600 group-hover:translate-x-0.5 transition-transform inline-flex items-center gap-1 pt-1">
              PROCEED <HiOutlineArrowLeft className="h-3 w-3 rotate-180" />
            </span>
          </div>

          {/* Card 2: Bulk Upload */}
          <div
            onClick={() => selectAddMethod("bulk")}
            className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200/80 shadow-2xs hover:border-slate-300 transition-all cursor-pointer group flex flex-col items-center text-center space-y-2"
          >
            <div className="h-9 w-9 rounded-lg bg-red-50 border border-red-200/60 text-red-600 flex items-center justify-center shrink-0 shadow-2xs group-hover:bg-red-600 group-hover:text-white transition-colors">
              <HiOutlineSquaresPlus className="h-5 w-5" />
            </div>
            <h3 className="text-sm font-semibold text-[#1c1c1e]">Bulk CSV Upload</h3>
            <p className="text-xs text-slate-500 font-normal leading-relaxed">
              Upload a spreadsheet in CSV format. Ideal for importing dozens or hundreds of items at once.
            </p>
            <span className="text-[11px] font-semibold text-red-600 group-hover:translate-x-0.5 transition-transform inline-flex items-center gap-1 pt-1">
              PROCEED <HiOutlineArrowLeft className="h-3 w-3 rotate-180" />
            </span>
          </div>
        </div>
      </div>
    );
  }

  if (addMethod === "bulk") {
    return (
      <div className="w-full max-w-4xl md:max-w-none mx-auto space-y-4 pb-20 px-3.5 md:px-4 animate-in fade-in duration-300">
        <div className="flex items-center justify-between pb-2 border-b border-slate-200/60">
          <button
            onClick={() => selectAddMethod(null)}
            className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-900 cursor-pointer">
            <HiOutlineArrowLeft className="h-3.5 w-3.5" />
            <span>Change Method</span>
          </button>
        </div>

        <div className="bg-white rounded-xl shadow-2xs border border-slate-200/80 p-3.5 sm:p-5 space-y-4">
          <div>
            <h3 className="text-base sm:text-lg font-semibold text-[#1c1c1e] tracking-tight">Bulk Product Upload</h3>
            <p className="text-xs text-slate-500 font-normal mt-0.5">
              Upload a CSV file to import products in bulk.
            </p>
          </div>

          <form onSubmit={handleBulkUpload} className="space-y-4">
            {/* Compact Executive Warning Banner */}
            <div className="bg-amber-50/70 border border-amber-200/70 rounded-lg p-3 space-y-2 text-xs font-normal text-amber-900">
              <h4 className="font-semibold text-amber-900 text-xs flex items-center gap-1.5">
                <span>⚠️ Upload & SKU Guidelines</span>
              </h4>
              <p className="text-[11px] text-amber-800 leading-relaxed font-normal">
                <strong>Upload Limit:</strong> Upload at most <strong>100 products</strong> per CSV file to avoid processing timeouts.
              </p>
              <div className="pt-1.5 border-t border-amber-200/60 text-[11px] text-amber-800 space-y-1 font-normal">
                <p className="font-medium text-amber-900">💡 Automatic SKU Generation:</p>
                <p className="leading-relaxed">
                  Product & variant SKUs are automatically generated (e.g. <code>SKU-PRODUCT-[ID]</code>). Do <strong>not</strong> include <code>sku</code> columns in your CSV.
                </p>
              </div>
            </div>

            {/* Drag & Drop selector */}
            <div className="border border-dashed border-slate-300 bg-slate-50/50 rounded-xl p-5 sm:p-6 flex flex-col items-center justify-center text-center hover:border-red-500 hover:bg-red-50/20 transition-all relative cursor-pointer">
              <input
                type="file"
                accept=".csv"
                onChange={(e) => {
                  if (e.target.files?.[0]) {
                    setCsvFile(e.target.files[0]);
                    setValidationErrors([]);
                  }
                }}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
              <HiOutlineSquaresPlus className="h-8 w-8 text-slate-400 mb-1.5" />
              {csvFile ? (
                <div className="space-y-0.5">
                  <p className="text-xs font-semibold text-[#1c1c1e]">{csvFile.name}</p>
                  <p className="text-[10px] text-slate-400 font-normal">
                    {(csvFile.size / 1024).toFixed(2)} KB
                  </p>
                </div>
              ) : (
                <div className="space-y-0.5">
                  <p className="text-xs font-medium text-slate-700">
                    Click to browse or drag & drop CSV file
                  </p>
                  <p className="text-[10px] text-slate-400 font-normal">
                    Spreadsheet file (.csv) only
                  </p>
                </div>
              )}
            </div>

            {/* Template Download & Instructions */}
            <div className="bg-slate-50/80 rounded-xl p-3.5 sm:p-4 border border-slate-200/60 space-y-3">
              <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                <div>
                  <h4 className="text-xs font-semibold text-[#1c1c1e]">
                    CSV Structure Template
                  </h4>
                  <p className="text-[11px] text-slate-500 font-normal mt-0.5">
                    Ensure your CSV file matches the template headers and structure.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={downloadTemplate}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-semibold hover:bg-red-700 transition-all shadow-xs shrink-0 cursor-pointer"
                >
                  Download CSV Template
                </button>
              </div>

              <div className="border-t border-slate-200/60 pt-2.5 space-y-1.5 text-xs">
                <p className="font-semibold text-slate-700 text-[11px]">
                  Supported Fields & Formats:
                </p>
                <ul className="text-[11px] text-slate-600 font-normal space-y-1 list-disc list-inside leading-relaxed">
                  <li><strong className="text-slate-800">General Info</strong>: <code>name</code> (required), <code>description</code>, <code>brand</code>.</li>
                  <li><strong className="text-slate-800">Categories</strong>: <code>header</code>, <code>category</code>, <code>subcategory</code> (by names) OR <code>headerId</code>, <code>categoryId</code>, <code>subcategoryId</code>.</li>
                  <li><strong className="text-slate-800">Photos</strong>: <code>mainImage</code> (URL), <code>galleryImages</code> (comma-separated URLs).</li>
                  <li><strong className="text-slate-800">Variants</strong> (required): <code>variantName</code>, <code>variantPrice</code>, <code>variantSalePrice</code>, <code>variantStock</code>. Optional <code>packingFee</code> / <code>lowStockAlert</code>.</li>
                </ul>
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
              <button
                type="button"
                onClick={() => selectAddMethod(null)}
                className="px-3.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-medium text-slate-700 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!csvFile || isUploading}
                className="px-4 py-1.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold transition-all shadow-xs cursor-pointer"
              >
                {isUploading ? "Importing..." : "Upload & Import"}
              </button>
            </div>

            {/* Uploading loading overlay modal */}
            {isUploading && (
              <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
                <div className="bg-white rounded-3xl p-8 max-w-md w-full text-center space-y-6 shadow-2xl border border-slate-100 scale-in duration-200">
                  <div className="flex justify-center">
                    <div className="relative flex items-center justify-center animate-bounce">
                      <div className="w-16 h-16 border-4 border-red-500/20 border-t-orange-500 rounded-full animate-spin"></div>
                      <HiOutlineArrowPath className="absolute h-6 w-6 text-red-500 animate-spin" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-lg font-black text-slate-800">Uploading & Processing</h3>
                    <p className="text-sm text-slate-500 font-medium leading-relaxed">
                      Please wait while we validate your CSV data, process categories, verify SKU integrity, and create your products in bulk.
                    </p>
                  </div>
                  <div className="bg-red-50/50 rounded-xl py-2 px-4 inline-flex items-center gap-2 text-xs font-bold text-red-600">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                    </span>
                    Do not close this page
                  </div>
                </div>
              </div>
            )}

            {/* Compact CSV Validation errors overlay modal */}
            {validationErrors.length > 0 && (
              <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-[100] flex items-center justify-center p-3.5 sm:p-4 animate-in fade-in duration-200">
                <div className="bg-white rounded-xl p-3.5 sm:p-4 max-w-md w-full text-left space-y-3 shadow-xl border border-slate-200/80 flex flex-col max-h-[80vh]">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 shrink-0">
                    <div className="flex items-center gap-2.5">
                      <div className="h-8 w-8 rounded-lg bg-rose-50 border border-rose-200/60 text-rose-600 flex items-center justify-center shrink-0 shadow-2xs font-semibold text-xs">
                        ⚠️
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-[#1c1c1e] tracking-tight">CSV Validation Failed</h3>
                        <p className="text-[11px] text-slate-500 font-normal">
                          Found {validationErrors.length} {validationErrors.length === 1 ? "error" : "errors"} in your CSV file.
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setValidationErrors([])}
                      className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
                    >
                      ✕
                    </button>
                  </div>

                  <div className="flex-1 overflow-y-auto space-y-2 py-1 scrollbar-hide">
                    {validationErrors.map((err, idx) => (
                      <div key={idx} className="p-2.5 bg-rose-50/70 border border-rose-200/70 rounded-lg flex items-start gap-2 text-xs">
                        <span className="text-rose-500 font-bold mt-0.5 text-xs shrink-0">•</span>
                        <p className="text-[11px] text-rose-900 font-normal leading-relaxed">{err}</p>
                      </div>
                    ))}
                  </div>

                  <div className="flex justify-end pt-2.5 border-t border-slate-100 shrink-0">
                    <button
                      type="button"
                      onClick={() => setValidationErrors([])}
                      className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-medium shadow-2xs transition-all cursor-pointer"
                    >
                      Go Back & Fix
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Compact Critical server error overlay modal */}
            {criticalError && (
              <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-[100] flex items-center justify-center p-3.5 sm:p-4 animate-in fade-in duration-200">
                <div className="bg-white rounded-xl p-4 max-w-sm w-full text-center space-y-3 shadow-xl border border-slate-200/80">
                  <div className="h-9 w-9 rounded-lg bg-rose-50 border border-rose-200/60 text-rose-600 flex items-center justify-center shrink-0 mx-auto shadow-2xs text-base">
                    🚫
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-sm font-semibold text-[#1c1c1e] tracking-tight">Import Failed</h3>
                    <p className="text-xs text-slate-500 font-normal leading-relaxed">
                      {criticalError}
                    </p>
                  </div>
                  <div className="flex justify-center pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setCriticalError(null)}
                      className="px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-all cursor-pointer"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              </div>
            )}
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-5xl md:max-w-none mx-auto space-y-3 sm:space-y-4 pb-28 md:pb-20 px-3.5 md:px-4 min-w-0 max-w-full overflow-x-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-2.5 pb-1">
        <Button
          variant="ghost"
          className="pl-0 text-xs sm:text-sm font-medium hover:bg-transparent hover:text-red-600 justify-start h-8 min-h-0"
          onClick={leaveAddProduct}>
          <HiOutlineArrowLeft className="mr-1.5 h-4 w-4" />
          Back to Products
        </Button>
        <div className="flex gap-2 justify-end">
          <Button variant="outline" className="text-xs h-9 min-h-0 px-3.5 py-1.5 rounded-lg font-medium" onClick={leaveAddProduct}>
            Cancel
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-xs overflow-hidden flex flex-col md:flex-row border border-slate-200/80 min-w-0 max-w-full">
        {/* Sidebar Tabs */}
        <div className="md:w-56 bg-slate-50/70 border-b md:border-b-0 md:border-r border-slate-200/80 p-1.5 sm:p-3 flex flex-row md:flex-col overflow-x-auto md:overflow-y-auto gap-1 shrink-0 no-scrollbar">
          {[
            { id: "general", label: "General Info", icon: HiOutlineTag },
            ...(sellerBusinessType === "pharmacy" ? [{ id: "medicine", label: "Medicine Details", icon: HiOutlineTag }] : []),
            { id: "variants", label: "Item Variants", icon: HiOutlineSwatch },
            { id: "category", label: "Groups", icon: HiOutlineFolderOpen },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setModalTab(tab.id)}
              className={cn(
                "flex items-center space-x-2 px-3 py-2 rounded-lg text-xs font-medium transition-all text-left whitespace-nowrap shrink-0 md:w-full min-h-0",
                modalTab === tab.id
                  ? "bg-white text-red-600 shadow-xs border border-slate-200/80 font-semibold"
                  : "text-slate-600 hover:bg-slate-100/70",
              )}>
              <tab.icon className={cn("h-4 w-4 shrink-0", modalTab === tab.id ? "text-red-600" : "text-slate-400")} />
              <span>{tab.label}</span>
            </button>
          ))}

          <div className="hidden md:block pt-6 px-3">
            <div className="p-3 bg-emerald-50/80 rounded-lg border border-emerald-200/70">
              <p className="text-[10px] font-semibold text-emerald-700 uppercase tracking-wider mb-1">
                Status
              </p>
              <select
                value={formData.status}
                onChange={(e) =>
                  setFormData({ ...formData, status: e.target.value })
                }
                className="w-full bg-transparent border-none text-xs font-semibold text-emerald-800 outline-none p-0 cursor-pointer focus:ring-0">
                <option value="active">PUBLISHED</option>
                <option value="inactive">DRAFT</option>
              </select>
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 p-3.5 sm:p-5 lg:p-6 overflow-y-auto">
          {modalTab === "general" && (
            <div className="space-y-4 animate-in fade-in slide-in-from-right-2 duration-300">
              <div className="space-y-1 flex flex-col">
                <label className="text-xs font-medium text-slate-700">
                  Product Title
                </label>
                <input
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs sm:text-sm font-normal text-slate-900 outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500/20 transition-all placeholder:text-slate-400"
                  placeholder="e.g. Premium Basmati Rice"
                />
              </div>
              <div className="space-y-1 flex flex-col">
                <label className="text-xs font-medium text-slate-700">
                  About this item
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  onWheel={(e) => e.stopPropagation()}
                  onTouchMove={(e) => e.stopPropagation()}
                  className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-xs sm:text-sm font-normal text-slate-900 min-h-[120px] max-h-[220px] outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500/20 resize-none overflow-y-auto custom-scrollbar placeholder:text-slate-400"
                  placeholder="Describe the item here..."
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div className="space-y-1 flex flex-col">
                  <label className="text-xs font-medium text-slate-700">
                    Brand Name
                  </label>
                  <input
                    value={formData.brand}
                    onChange={(e) =>
                      setFormData({ ...formData, brand: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs sm:text-sm font-normal text-slate-900 outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500/20 transition-all placeholder:text-slate-400"
                    placeholder="e.g. Amul"
                  />
                </div>
                <div className="space-y-1 flex flex-col">
                  <label className="text-xs font-medium text-slate-700">
                    Product Code
                  </label>
                  <input
                    value={formData.sku}
                    readOnly
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-medium outline-none text-slate-400 cursor-not-allowed"
                    placeholder="AUTO-GENERATED"
                  />
                </div>
              </div>
              {renderContinueButton()}
            </div>
          )}

          {modalTab === "medicine" && sellerBusinessType === "pharmacy" && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-2 duration-300">
              <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100 space-y-6">

                <h3 className="text-sm font-black text-slate-800 uppercase tracking-wide border-b border-slate-200 pb-2">Medicine Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-1.5 flex flex-col">
                    <label className="text-[10px] sm:text-xs font-bold text-slate-600 uppercase tracking-widest ml-1">Generic Name</label>
                    <input type="text" value={formData.pharmacyDetails.genericName} onChange={(e) => setFormData({ ...formData, pharmacyDetails: { ...formData.pharmacyDetails, genericName: e.target.value } })} className="w-full px-4 py-2.5 bg-white border-none rounded-md text-sm font-bold outline-none ring-slate-100 ring-1 focus:ring-2 focus:ring-red-500/20" placeholder="e.g. Paracetamol" />
                  </div>
                  <div className="space-y-1.5 flex flex-col">
                    <label className="text-[10px] sm:text-xs font-bold text-slate-600 uppercase tracking-widest ml-1">Manufacturer</label>
                    <input type="text" value={formData.pharmacyDetails.manufacturer} onChange={(e) => setFormData({ ...formData, pharmacyDetails: { ...formData.pharmacyDetails, manufacturer: e.target.value } })} className="w-full px-4 py-2.5 bg-white border-none rounded-md text-sm font-bold outline-none ring-slate-100 ring-1 focus:ring-2 focus:ring-red-500/20" placeholder="Manufacturer Name" />
                  </div>
                  <div className="space-y-1.5 flex flex-col">
                    <label className="text-[10px] sm:text-xs font-bold text-slate-600 uppercase tracking-widest ml-1">Composition</label>
                    <input type="text" value={formData.pharmacyDetails.composition} onChange={(e) => setFormData({ ...formData, pharmacyDetails: { ...formData.pharmacyDetails, composition: e.target.value } })} className="w-full px-4 py-2.5 bg-white border-none rounded-md text-sm font-bold outline-none ring-slate-100 ring-1 focus:ring-2 focus:ring-red-500/20" placeholder="Active ingredients" />
                  </div>
                  <div className="space-y-1.5 flex flex-col">
                    <label className="text-[10px] sm:text-xs font-bold text-slate-600 uppercase tracking-widest ml-1">Strength</label>
                    <input type="text" value={formData.pharmacyDetails.strength} onChange={(e) => setFormData({ ...formData, pharmacyDetails: { ...formData.pharmacyDetails, strength: e.target.value } })} className="w-full px-4 py-2.5 bg-white border-none rounded-md text-sm font-bold outline-none ring-slate-100 ring-1 focus:ring-2 focus:ring-red-500/20" placeholder="e.g. 500mg" />
                  </div>
                  <div className="space-y-1.5 flex flex-col">
                    <label className="text-[10px] sm:text-xs font-bold text-slate-600 uppercase tracking-widest ml-1">Dosage Form</label>
                    <select
                      value={formData.pharmacyDetails.dosageForm}
                      onChange={(e) => setFormData({ ...formData, pharmacyDetails: { ...formData.pharmacyDetails, dosageForm: e.target.value } })}
                      className="w-full px-4 py-2.5 bg-white border-none rounded-md text-sm font-bold outline-none ring-slate-100 ring-1 focus:ring-2 focus:ring-red-500/20 cursor-pointer"
                    >
                      {PHARMACY_DOSAGE_FORM_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5 flex flex-col">
                    <label className="text-[10px] sm:text-xs font-bold text-slate-600 uppercase tracking-widest ml-1">Pack Type</label>
                    <select
                      value={formData.pharmacyDetails.packType}
                      onChange={(e) => setFormData({ ...formData, pharmacyDetails: { ...formData.pharmacyDetails, packType: e.target.value } })}
                      className="w-full px-4 py-2.5 bg-white border-none rounded-md text-sm font-bold outline-none ring-slate-100 ring-1 focus:ring-2 focus:ring-red-500/20 cursor-pointer"
                    >
                      {PHARMACY_PACK_TYPE_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5 flex flex-col">
                    <label className="text-[10px] sm:text-xs font-bold text-slate-600 uppercase tracking-widest ml-1">Pack Quantity</label>
                    <input
                      type="number"
                      min="1"
                      value={formData.pharmacyDetails.packQuantity}
                      onChange={(e) => setFormData({ ...formData, pharmacyDetails: { ...formData.pharmacyDetails, packQuantity: e.target.value } })}
                      className="w-full px-4 py-2.5 bg-white border-none rounded-md text-sm font-bold outline-none ring-slate-100 ring-1 focus:ring-2 focus:ring-red-500/20"
                      placeholder="e.g. 10"
                    />
                  </div>
                  <div className="space-y-1.5 flex flex-col">
                    <label className="text-[10px] sm:text-xs font-bold text-slate-600 uppercase tracking-widest ml-1">Unit</label>
                    <select
                      value={formData.pharmacyDetails.unit}
                      onChange={(e) => setFormData({ ...formData, pharmacyDetails: { ...formData.pharmacyDetails, unit: e.target.value } })}
                      className="w-full px-4 py-2.5 bg-white border-none rounded-md text-sm font-bold outline-none ring-slate-100 ring-1 focus:ring-2 focus:ring-red-500/20 cursor-pointer"
                    >
                      {PHARMACY_UNIT_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <h3 className="text-sm font-black text-slate-800 uppercase tracking-wide border-b border-slate-200 pb-2 mt-8">Classification & Regulatory</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-1.5 flex flex-col">
                    <label className="text-[10px] sm:text-xs font-bold text-slate-600 uppercase tracking-widest ml-1">Classification</label>
                    <select
                      value={formData.pharmacyDetails.drugClassification}
                      onChange={(e) => setFormData({ ...formData, pharmacyDetails: { ...formData.pharmacyDetails, drugClassification: e.target.value } })}
                      className="w-full px-4 py-2.5 bg-white border-none rounded-md text-sm font-bold outline-none ring-slate-100 ring-1 focus:ring-2 focus:ring-red-500/20 cursor-pointer"
                    >
                      {PHARMACY_CLASSIFICATION_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5 flex flex-col">
                    <label className="text-[10px] sm:text-xs font-bold text-slate-600 uppercase tracking-widest ml-1">Prescription Required</label>
                    <select
                      value={formData.pharmacyDetails.prescriptionRequired ? "Yes" : "No"}
                      onChange={(e) => setFormData({ ...formData, pharmacyDetails: { ...formData.pharmacyDetails, prescriptionRequired: e.target.value === "Yes" } })}
                      className="w-full px-4 py-2.5 bg-white border-none rounded-md text-sm font-bold outline-none ring-slate-100 ring-1 focus:ring-2 focus:ring-red-500/20 cursor-pointer"
                    >
                      <option value="No">No</option>
                      <option value="Yes">Yes</option>
                    </select>
                  </div>
                  <div className="space-y-1.5 flex flex-col">
                    <label className="text-[10px] sm:text-xs font-bold text-slate-600 uppercase tracking-widest ml-1">Drug License Number</label>
                    <input
                      type="text"
                      value={formData.pharmacyDetails.drugLicenseNumber}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          pharmacyDetails: {
                            ...formData.pharmacyDetails,
                            drugLicenseNumber: sanitizeLicense(e.target.value),
                          },
                        })
                      }
                      className="w-full px-4 py-2.5 bg-white border-none rounded-md text-sm font-bold outline-none ring-slate-100 ring-1 focus:ring-2 focus:ring-red-500/20"
                      placeholder="License Number"
                      autoCapitalize="characters"
                    />
                  </div>
                  <div className="space-y-1.5 flex flex-col">
                    <label className="text-[10px] sm:text-xs font-bold text-slate-600 uppercase tracking-widest ml-1">HSN Code</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={formData.pharmacyDetails.hsnCode}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          pharmacyDetails: {
                            ...formData.pharmacyDetails,
                            hsnCode: sanitizeDigits(e.target.value),
                          },
                        })
                      }
                      className="w-full px-4 py-2.5 bg-white border-none rounded-md text-sm font-bold outline-none ring-slate-100 ring-1 focus:ring-2 focus:ring-red-500/20"
                      placeholder="HSN Code"
                    />
                  </div>
                </div>

                <h3 className="text-sm font-black text-slate-800 uppercase tracking-wide border-b border-slate-200 pb-2 mt-8">Batch Details & Storage</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-1.5 flex flex-col">
                    <label className="text-[10px] sm:text-xs font-bold text-slate-600 uppercase tracking-widest ml-1">Batch Number</label>
                    <input
                      type="text"
                      value={formData.pharmacyDetails.batchNumber}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          pharmacyDetails: {
                            ...formData.pharmacyDetails,
                            batchNumber: sanitizeBatch(e.target.value),
                          },
                        })
                      }
                      className="w-full px-4 py-2.5 bg-white border-none rounded-md text-sm font-bold outline-none ring-slate-100 ring-1 focus:ring-2 focus:ring-red-500/20"
                      placeholder="Batch Number"
                      autoCapitalize="characters"
                    />
                  </div>
                  <div className="space-y-1.5 flex flex-col">
                    <label className="text-[10px] sm:text-xs font-bold text-slate-600 uppercase tracking-widest ml-1">Manufacturing Date</label>
                    <input
                      type="date"
                      max={TODAY_ISO}
                      value={formData.pharmacyDetails.mfgDate}
                      onChange={(e) => {
                        const next = e.target.value;
                        if (next && next > TODAY_ISO) {
                          toast.error("Manufacturing date cannot be in the future");
                          return;
                        }
                        setFormData({ ...formData, pharmacyDetails: { ...formData.pharmacyDetails, mfgDate: next } });
                      }}
                      className="w-full px-4 py-2.5 bg-white border-none rounded-md text-sm font-bold outline-none ring-slate-100 ring-1 focus:ring-2 focus:ring-red-500/20"
                    />
                  </div>
                  <div className="space-y-1.5 flex flex-col">
                    <label className="text-[10px] sm:text-xs font-bold text-slate-600 uppercase tracking-widest ml-1">Expiry Date</label>
                    <input
                      type="date"
                      min={TOMORROW_ISO}
                      value={formData.pharmacyDetails.expDate}
                      onChange={(e) => {
                        const next = e.target.value;
                        if (next && next <= TODAY_ISO) {
                          toast.error("Expiry date must be a future date");
                          return;
                        }
                        setFormData({ ...formData, pharmacyDetails: { ...formData.pharmacyDetails, expDate: next } });
                      }}
                      className="w-full px-4 py-2.5 bg-white border-none rounded-md text-sm font-bold outline-none ring-slate-100 ring-1 focus:ring-2 focus:ring-red-500/20"
                    />
                  </div>
                  <div className="space-y-1.5 flex flex-col">
                    <label className="text-[10px] sm:text-xs font-bold text-slate-600 uppercase tracking-widest ml-1">Storage Condition</label>
                    <input type="text" value={formData.pharmacyDetails.storageCondition} onChange={(e) => setFormData({ ...formData, pharmacyDetails: { ...formData.pharmacyDetails, storageCondition: e.target.value } })} className="w-full px-4 py-2.5 bg-white border-none rounded-md text-sm font-bold outline-none ring-slate-100 ring-1 focus:ring-2 focus:ring-red-500/20" placeholder="e.g. Store below 25°C" />
                  </div>
                </div>

              </div>
              {renderContinueButton()}
            </div>
          )}

          {modalTab === "variants" && (
            <div className="space-y-4 animate-in fade-in slide-in-from-right-2 duration-300">
              <div className="p-3.5 sm:p-4 bg-slate-50/70 rounded-xl border border-slate-200/80 grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div className="space-y-1 flex flex-col">
                  <label className="text-xs font-medium text-slate-700">
                    Packing Fee (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formData.packingFee}
                    onChange={(e) => setFormData({ ...formData, packingFee: e.target.value })}
                    placeholder="e.g. 10"
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm sm:text-base font-semibold outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500/20"
                  />
                  <p className="text-[10px] text-slate-500 font-medium ml-1">
                    One packing fee for the whole product (applies to all variants).
                  </p>
                </div>
                <div className="space-y-1 flex flex-col">
                  <label className="text-xs font-medium text-rose-600">
                    Alert me when stock is below
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formData.lowStockAlert}
                    onChange={(e) => setFormData({ ...formData, lowStockAlert: e.target.value })}
                    className="w-full px-3 py-2 bg-rose-50/40 border border-rose-200 rounded-lg text-xs sm:text-sm font-medium text-rose-700 outline-none focus:border-rose-400 focus:ring-1 focus:ring-rose-400/20"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <h4 className="text-sm font-bold text-slate-900">
                    Product Variants
                  </h4>
                  <p className="text-xs text-slate-600 font-medium">
                    Price and stock live on each variant. Max {MAX_PRODUCT_VARIANTS} variants, {MIN_VARIANT_IMAGES}–{MAX_VARIANT_IMAGES} photos each.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if ((formData.variants || []).length >= MAX_PRODUCT_VARIANTS) {
                      toast.error(`Maximum ${MAX_PRODUCT_VARIANTS} variants allowed`);
                      return;
                    }
                    setFormData({
                      ...formData,
                      variants: [
                        ...(formData.variants || []),
                        {
                          id: Date.now(),
                          name: "",
                          price: "",
                          salePrice: "",
                          stock: "",
                          sku: "",
                          media: [],
                        },
                      ],
                    });
                  }}
                  disabled={(formData.variants || []).length >= MAX_PRODUCT_VARIANTS}
                  className="inline-flex items-center justify-center gap-2 shrink-0 self-start sm:self-auto px-3.5 py-2 bg-red-500/10 text-red-600 rounded-lg text-[10px] font-bold uppercase tracking-wide hover:bg-red-500/20 transition-all whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed">
                  <HiOutlineSquaresPlus className="h-4 w-4 shrink-0" />
                  <span>Add Variant</span>
                </button>
              </div>

              {sellerBusinessType === "pharmacy" && (formData.variants || []).length === 0 ? (
                <div className="p-6 bg-slate-50 rounded-2xl border border-dashed border-slate-200 flex flex-col items-center justify-center text-center">
                  <div className="p-4 bg-white shadow-sm rounded-full mb-3 text-slate-300">
                    <HiOutlineCube className="h-8 w-8" />
                  </div>
                  <h5 className="text-sm font-bold text-slate-700">No variants added yet</h5>
                  <p className="text-xs font-semibold text-slate-500 mt-2 max-w-sm">
                    Add at least one pack size with price and stock using Add Variant.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {(formData.variants || []).map((variant, index) => (
                    <div
                      key={variant.id}
                      className="p-4 bg-slate-50 rounded-2xl border border-slate-100 grid grid-cols-1 md:grid-cols-12 gap-4 items-end group relative">
                      <div className="col-span-12 md:col-span-3 space-y-1">
                        <label className="text-xs font-bold text-slate-600 uppercase tracking-widest ml-1">
                          Variant Name
                        </label>
                        <input
                          value={variant.name}
                          onChange={(e) => {
                            const newVariants = [...formData.variants];
                            newVariants[index].name = e.target.value;
                            setFormData({ ...formData, variants: newVariants });
                          }}
                          placeholder="e.g. 1kg Bag"
                          className="w-full px-3 py-2 bg-white ring-1 ring-slate-200 border-none rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-red-500/10"
                        />
                      </div>
                      <div className="col-span-6 md:col-span-2 space-y-1">
                        <label className="text-xs font-bold text-slate-600 uppercase tracking-widest ml-1">
                          Price
                        </label>
                        <input
                          type="number"
                          value={variant.price}
                          onChange={(e) => {
                            const newVariants = [...formData.variants];
                            newVariants[index].price = e.target.value;
                            setFormData({ ...formData, variants: newVariants });
                          }}
                          placeholder="500"
                          className="w-full px-3 py-2 bg-white ring-1 ring-slate-200 border-none rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-red-500/10"
                        />
                      </div>
                      <div className="col-span-6 md:col-span-2 space-y-1">
                        <label className="text-[8px] font-bold text-emerald-500 uppercase tracking-widest ml-1">
                          Sale
                        </label>
                        <input
                          type="number"
                          min="1"
                          value={variant.salePrice}
                          onChange={(e) => {
                            const newVariants = [...formData.variants];
                            newVariants[index].salePrice = e.target.value;
                            setFormData({ ...formData, variants: newVariants });
                          }}
                          placeholder="450"
                          className={`w-full px-3 py-2 border-none rounded-xl text-xs font-bold outline-none focus:ring-2 ${variant.salePrice && Number(variant.salePrice) < 1 ? "bg-red-50 ring-1 ring-red-300 text-red-600 focus:ring-red-300" : "bg-emerald-50 ring-1 ring-emerald-100 text-emerald-700 focus:ring-emerald-200"}`}
                        />
                        {variant.salePrice && Number(variant.salePrice) < 1 && (
                          <p className="text-[9px] font-semibold text-red-500 ml-1">Min value is 1</p>
                        )}
                      </div>
                      <div className="col-span-6 md:col-span-2 space-y-1">
                        <label className="text-xs font-bold text-slate-600 uppercase tracking-widest ml-1">
                          Stock
                        </label>
                        <input
                          type="number"
                          min="1"
                          value={variant.stock}
                          onChange={(e) => {
                            const newVariants = [...formData.variants];
                            newVariants[index].stock = e.target.value;
                            setFormData({ ...formData, variants: newVariants });
                          }}
                          placeholder="10"
                          className={`w-full px-3 py-2 border-none rounded-xl text-xs font-bold outline-none focus:ring-2 ${variant.stock && Number(variant.stock) < 1 ? "bg-red-50 ring-1 ring-red-300 text-red-600 focus:ring-red-300" : "bg-white ring-1 ring-slate-200 focus:ring-red-500/10"}`}
                        />
                        {variant.stock && Number(variant.stock) < 1 && (
                          <p className="text-[9px] font-semibold text-red-500 ml-1">Min value is 1</p>
                        )}
                      </div>
                      <div className="col-span-5 md:col-span-2 space-y-1">
                        <label className="text-xs font-bold text-slate-600 uppercase tracking-widest ml-1">
                          Product Code
                        </label>
                        <input
                          value={variant.sku}
                          readOnly
                          placeholder="AUTO-GENERATED"
                          className="w-full px-3 py-2 bg-slate-100 ring-1 ring-slate-200 border-none rounded-xl text-xs font-mono font-bold text-slate-400 cursor-not-allowed outline-none"
                        />
                      </div>
                      <div className="col-span-1 flex justify-end pb-1">
                        <button
                          type="button"
                          onClick={() => {
                            if (sellerBusinessType === "pharmacy") {
                              const newVariants = formData.variants.filter((_, i) => i !== index);
                              setFormData({ ...formData, variants: newVariants });
                              return;
                            }
                            if ((formData.variants || []).length <= 1) {
                              toast.error("At least one variant is required");
                              return;
                            }
                            const newVariants = formData.variants.filter((_, i) => i !== index);
                            setFormData({ ...formData, variants: newVariants });
                          }}
                          className="p-2 text-slate-300 hover:text-rose-500 transition-colors">
                          <HiOutlineTrash className="h-4 w-4" />
                        </button>
                      </div>
                      <VariantImageSlots
                        variant={variant}
                        compact
                        onChange={(nextVariant) => {
                          setFormData((prev) => {
                            const variants = [...(prev.variants || [])];
                            const matchedIndex = variants.findIndex(
                              (item) => String(item.id) === String(nextVariant.id),
                            );
                            const at = matchedIndex >= 0 ? matchedIndex : index;
                            if (!variants[at]) return prev;
                            variants[at] = { ...variants[at], media: nextVariant.media };
                            return { ...prev, variants };
                          });
                        }}
                      />
                    </div>
                  ))}
                </div>
              )}
              {renderContinueButton()}
            </div>
          )}

          {modalTab === "category" && (
            <div className="space-y-4 animate-in fade-in slide-in-from-right-2 duration-300 min-w-0 max-w-full overflow-hidden">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 min-w-0 max-w-full">
                <div className="space-y-1 flex flex-col min-w-0 max-w-full">
                  <label className="text-xs font-medium text-slate-700">
                    Main Group <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formData.header}
                    onChange={(e) => {
                      const nextHeaderId = e.target.value;
                      const headerObj = categories.find(
                        (h) => getCategoryNodeId(h) === String(nextHeaderId),
                      );
                      const firstCategory = headerObj?.children?.[0];
                      const nextCategoryId = getCategoryNodeId(firstCategory);
                      const firstSub = firstCategory?.children?.[0];
                      setFormData({
                        ...formData,
                        header: nextHeaderId,
                        category: nextCategoryId,
                        subcategory: getCategoryNodeId(firstSub),
                      });
                    }}
                    className="w-full max-w-full truncate px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs sm:text-sm font-medium text-slate-900 outline-none cursor-pointer focus:border-red-500 focus:ring-1 focus:ring-red-500/20 transition-all">
                    {categories.map((h) => (
                      <option key={h._id || h.id} value={h._id || h.id} className="truncate">
                        {h.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1 flex flex-col min-w-0 max-w-full">
                  <label className="text-xs font-medium text-slate-700">
                    Specific Category <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => {
                      const nextCategoryId = e.target.value;
                      const headerObj = categories.find(
                        (h) => getCategoryNodeId(h) === String(formData.header || ""),
                      );
                      const categoryObj = headerObj?.children?.find(
                        (c) => getCategoryNodeId(c) === String(nextCategoryId),
                      );
                      const firstSub = categoryObj?.children?.[0];
                      setFormData({
                        ...formData,
                        category: nextCategoryId,
                        subcategory: getCategoryNodeId(firstSub),
                      });
                    }}
                    disabled={!formData.header}
                    className="w-full max-w-full truncate px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs sm:text-sm font-medium text-slate-900 outline-none cursor-pointer focus:border-red-500 focus:ring-1 focus:ring-red-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                    {categories
                      .find((h) => getCategoryNodeId(h) === String(formData.header || ""))
                      ?.children?.map((c) => (
                        <option key={c._id || c.id} value={c._id || c.id} className="truncate">
                          {c.name}
                        </option>
                      ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:gap-4 min-w-0 max-w-full">
                <div className="space-y-1 flex flex-col min-w-0 max-w-full">
                  <label className="text-xs font-medium text-slate-700">
                    Sub-Category <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formData.subcategory}
                    onChange={(e) =>
                      setFormData({ ...formData, subcategory: e.target.value })
                    }
                    disabled={!formData.category}
                    className="w-full max-w-full truncate px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs sm:text-sm font-medium text-slate-900 outline-none cursor-pointer focus:border-red-500 focus:ring-1 focus:ring-red-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                    {categories
                      .find((h) => getCategoryNodeId(h) === String(formData.header || ""))
                      ?.children?.find((c) => getCategoryNodeId(c) === String(formData.category || ""))
                      ?.children?.map((sc) => (
                        <option key={sc._id || sc.id} value={sc._id || sc.id} className="truncate">
                          {sc.name}
                        </option>
                      ))}
                  </select>
                </div>
              </div>
              {renderContinueButton()}
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default AddProduct;
