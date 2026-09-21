import React, { useState, useEffect, useMemo } from "react";
import Card from "@shared/components/ui/Card";
import Badge from "@shared/components/ui/Badge";
import {
  Plus,
  Search,
  Edit,
  Trash,
  Trash2,
  X,
  Image,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { adminApi } from "../../services/adminApi";
import { toast } from "sonner";
import IconSelector from "@shared/components/IconSelector";
import Pagination from "@shared/components/ui/Pagination";
import { PAGINATION_CONFIG } from "@/shared/constants/pagination";
import { getIconSvg } from "@shared/constants/categoryIcons";
import { CATEGORY_ICON_COMPONENTS } from "@shared/constants/categoryIconComponents";
import { useAuth } from "@core/context/AuthContext";
import { getCurrentUser } from "@food/utils/auth";
import { canPerformAdminPermissionAction, extractAdminPermissions, extractAdminRoleId, fetchAdminRolePermissions } from "@food/utils/adminPermissions";
import {
  buildCategoryFormData,
  bulkDeleteCategories,
  describeCategoryCascade,
  describeCategoryDelete,
  extractCategoryApiError,
} from "../../utils/categoryHelpers";
import {
  RETURN_WINDOW_DAY_PRESETS,
  hoursToReturnWindowDays,
  returnWindowDaysToHours,
} from "@/shared/utils/returnWindow";

const EMPTY_HEADER_FORM = {
  name: "",
  slug: "",
  description: "",
  status: "active",
  type: "header",
  parentId: null,
  iconId: "",
  adminCommission: 0,
  gst: 0,
  handlingFees: 0,
  headerColor: "#FF1E1E",
  returnsEnabled: true,
  returnWindowDays: 3,
};

const HeaderCategories = () => {
  const { user: authUser } = useAuth();
  const currentUser = useMemo(() => authUser || getCurrentUser("admin"), [authUser]);
  const [resolvedPermissions, setResolvedPermissions] = useState({});

  useEffect(() => {
    let isMounted = true;

    const resolvePermissions = async () => {
      if (!currentUser || currentUser.role === "ADMIN") {
        if (isMounted) setResolvedPermissions({});
        return;
      }

      const existingPermissions = extractAdminPermissions(currentUser);
      if (Object.keys(existingPermissions).length > 0) {
        if (isMounted) setResolvedPermissions(existingPermissions);
        return;
      }

      const roleId = extractAdminRoleId(currentUser);
      if (!roleId) {
        if (isMounted) setResolvedPermissions({});
        return;
      }

      try {
        const rolePermissions = await fetchAdminRolePermissions(roleId);
        if (isMounted) setResolvedPermissions(rolePermissions);
      } catch {
        if (isMounted) setResolvedPermissions({});
      }
    };

    resolvePermissions();
    return () => {
      isMounted = false;
    };
  }, [currentUser]);

  const permissionKey = "quick::core_management::categories::header";
  const canCreate = canPerformAdminPermissionAction(currentUser, resolvedPermissions, permissionKey, "create");
  const canEdit = canPerformAdminPermissionAction(currentUser, resolvedPermissions, permissionKey, "edit");
  const canDelete = canPerformAdminPermissionAction(currentUser, resolvedPermissions, permissionKey, "delete");

  const [categories, setCategories] = useState([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGINATION_CONFIG.defaultPageSize);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isIconSelectorOpen, setIsIconSelectorOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedItems, setSelectedItems] = useState([]);

  const [formData, setFormData] = useState(EMPTY_HEADER_FORM);

  // Shared MUI map — same icons as customer app & IconSelector.
  const iconComponents = CATEGORY_ICON_COMPONENTS;

  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
      fetchCategories(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchTerm, pageSize]);

  const fetchCategories = async (requestedPage = 1) => {
    setIsLoading(true);
    try {
      const params = { type: "header", page: requestedPage, limit: pageSize };
      if (searchTerm) params.search = searchTerm;
      const res = await adminApi.getCategories(params);
      if (res.data.success) {
        const payload = res.data.result || {};
        const list = Array.isArray(payload.items) ? payload.items : [];
        const allCats = res.data.results || [];
        const headers = list.length > 0 ? list : allCats.filter((c) => c.type === "header");
        setCategories(headers);
        setTotal(typeof payload.total === "number" ? payload.total : headers.length);
        setPage(typeof payload.page === "number" ? payload.page : requestedPage);
      }
    } catch (error) {
      toast.error("Failed to fetch header categories");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedItems(categories.map((c) => c._id || c.id));
    } else {
      setSelectedItems([]);
    }
  };

  const handleSelect = (id) => {
    if (selectedItems.includes(id)) {
      setSelectedItems(selectedItems.filter((item) => item !== id));
    } else {
      setSelectedItems([...selectedItems, id]);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedItems.length === 0) return;

    if (
      !window.confirm(
        `Are you sure you want to delete ${selectedItems.length} header categor${selectedItems.length === 1 ? "y" : "ies"}?`,
      )
    ) {
      return;
    }

    try {
      const { deleted, failed, firstError } = await bulkDeleteCategories(adminApi, selectedItems);
      if (failed > 0) {
        toast.error(
          extractCategoryApiError(firstError, `Deleted ${deleted}, but ${failed} could not be removed`),
        );
      } else {
        toast.success(`${deleted} header categor${deleted === 1 ? "y" : "ies"} deleted`);
      }
      setSelectedItems([]);
      fetchCategories(page);
    } catch (error) {
      toast.error(extractCategoryApiError(error, "Failed to delete categories"));
    }
  };

  const handleSave = async () => {
    if (!formData.name || !formData.slug) {
      toast.error("Name and slug are required");
      return;
    }

    if (!formData.iconId) {
      toast.error("Please select an icon");
      return;
    }

    const commission = Number(formData.adminCommission);
    const gst = Number(formData.gst);
    if (!Number.isFinite(commission) || commission < 0 || commission > 100) {
      toast.error("Commission (%) must be between 0 and 100");
      return;
    }
    if (!Number.isFinite(gst) || gst < 0 || gst > 100) {
      toast.error("GST (%) must be between 0 and 100");
      return;
    }

    setIsSaving(true);
    try {
      const { returnWindowDays, ...headerFields } = formData;
      const data = buildCategoryFormData(
        {
          ...headerFields,
          adminCommission: commission,
          gst,
          returnsEnabled: Boolean(formData.returnsEnabled),
          returnWindowHours: returnWindowDaysToHours(returnWindowDays),
        },
        "header",
        null,
      );

      if (editingItem) {
        const res = await adminApi.updateCategory(editingItem._id || editingItem.id, data);
        toast.success(describeCategoryCascade(res?.data?.cascade, "Header category updated"));
      } else {
        await adminApi.createCategory(data);
        toast.success("Header category created");
      }
      setIsAddModalOpen(false);
      setEditingItem(null);
      fetchCategories(page);
    } catch (error) {
      toast.error(
        extractCategoryApiError(error, editingItem ? "Failed to update" : "Failed to create"),
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;

    try {
      const res = await adminApi.deleteCategory(deleteTarget._id || deleteTarget.id);
      toast.success(describeCategoryDelete(res?.data?.result, "Header category"));
      setIsDeleteModalOpen(false);
      setDeleteTarget(null);
      fetchCategories(page);
    } catch (error) {
      toast.error(extractCategoryApiError(error, "Failed to delete category"));
    }
  };

  const openAddModal = () => {
    setEditingItem(null);
    setFormData({ ...EMPTY_HEADER_FORM });
    setIsAddModalOpen(true);
  };

  const openEditModal = (item) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      slug: item.slug,
      description: item.description || "",
      status: item.status,
      type: "header",
      parentId: null,
      iconId: item.iconId || "",
      adminCommission: item.adminCommission ?? item.commission ?? 0,
      gst: item.gst ?? 0,
      handlingFees: item.handlingFees || 0,
      headerColor: item.headerColor || "#FF1E1E",
      returnsEnabled: item.returnsEnabled !== false,
      returnWindowDays: hoursToReturnWindowDays(item.returnWindowHours),
    });
    setIsAddModalOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">
            Header Categories
          </h1>
          <p className="text-gray-500 mt-1">
            Manage top-level categories, commission, GST and return window
          </p>
        </div>
        {canCreate && (
          <button
            onClick={openAddModal}
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors">
            <Plus className="w-5 h-5" />
            Add New Header
          </button>
        )}
      </div>

      <Card className="border-none shadow-sm">
        <div className="p-4 border-b border-gray-100 flex gap-4 items-center">
          {selectedItems.length > 0 && canDelete && (
            <button
              onClick={handleBulkDelete}
              className="flex items-center gap-2 px-4 py-2 bg-purple-50 text-purple-600 rounded-xl hover:bg-purple-100 transition-colors text-sm font-medium">
              <Trash2 className="w-4 h-4" />
              Delete ({selectedItems.length})
            </button>
          )}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search header categories..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="w-12 py-3 px-4 text-left">
                  <input
                    type="checkbox"
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    checked={
                      selectedItems.length > 0 &&
                      categories.length > 0 &&
                      selectedItems.length === categories.length
                    }
                    onChange={handleSelectAll}
                  />
                </th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Image
                </th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Name
                </th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Slug
                </th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Commission %
                </th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  GST %
                </th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Returns
                </th>
                <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                <tr>
                  <td colSpan="9" className="text-center py-8 text-gray-500">
                    Loading...
                  </td>
                </tr>
              ) : categories.length === 0 ? (
                <tr>
                  <td colSpan="9" className="text-center py-8 text-gray-500">
                    No header categories found
                  </td>
                </tr>
              ) : (
                categories.map((cat) => (
                  <tr
                    key={cat._id || cat.id}
                    className="hover:bg-gray-50/50 transition-colors">
                    <td className="py-3 px-4">
                      <input
                        type="checkbox"
                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        checked={selectedItems.includes(cat._id || cat.id)}
                        onChange={() => handleSelect(cat._id || cat.id)}
                      />
                    </td>
                    <td className="py-3 px-4">
                      <div className="w-10 h-10 rounded-lg bg-gray-100 overflow-hidden flex items-center justify-center border border-gray-200">
                        {cat.iconId && iconComponents[cat.iconId] ? (
                          <div className="w-6 h-6 text-indigo-600 flex items-center justify-center">
                            {(() => {
                              const IconComp = iconComponents[cat.iconId];
                              return <IconComp fontSize="medium" />;
                            })()}
                          </div>
                        ) : cat.iconId && getIconSvg(cat.iconId) ? (
                          <div
                            className="w-6 h-6 text-indigo-600"
                            dangerouslySetInnerHTML={{
                              __html: getIconSvg(cat.iconId),
                            }}
                          />
                        ) : cat.image?.url || cat.image ? (
                          <img
                            src={cat.image?.url || cat.image}
                            alt={cat.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <Image className="w-5 h-5 text-gray-400" />
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 font-medium text-gray-900">
                      {cat.name}
                    </td>
                    <td className="py-3 px-4 text-gray-500">{cat.slug}</td>
                    <td className="py-3 px-4">
                      <Badge
                        variant={
                          cat.status === "active" ? "success" : "warning"
                        }>
                        {cat.status}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-gray-700 text-sm">
                      {Number(cat.adminCommission ?? cat.commission ?? 0)}%
                    </td>
                    <td className="py-3 px-4 text-gray-700 text-sm">
                      {Number(cat.gst ?? 0)}%
                    </td>
                    <td className="py-3 px-4 text-sm">
                      {cat.returnsEnabled === false ? (
                        <span className="text-rose-600 font-medium">Off</span>
                      ) : (
                        <span className="text-emerald-700 font-medium">
                          {hoursToReturnWindowDays(cat.returnWindowHours)} day
                          {hoursToReturnWindowDays(cat.returnWindowHours) === 1 ? "" : "s"}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right space-x-2">
                      {canEdit && (
                        <button
                          onClick={() => openEditModal(cat)}
                          className="p-1 text-gray-500 hover:text-indigo-600 transition-colors">
                          <Edit className="w-5 h-5" />
                        </button>
                      )}
                      {canDelete && (
                        <button
                          onClick={() => {
                            setDeleteTarget(cat);
                            setIsDeleteModalOpen(true);
                          }}
                          className="p-1 text-gray-500 hover:text-purple-600 transition-colors">
                          <Trash2 className="w-5 h-5" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 border-t border-gray-100">
          <Pagination
            page={page}
            totalPages={Math.ceil(total / pageSize) || 1}
            total={total}
            pageSize={pageSize}
            onPageChange={(p) => fetchCategories(p)}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setPage(1);
            }}
            loading={isLoading}
          />
        </div>
      </Card>

      {/* Add/Edit Modal */}
      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
              <div className="p-6 border-b border-gray-100 flex justify-between items-center shrink-0">
                <h2 className="text-lg font-bold text-gray-900">
                  {editingItem ? "Edit Header Category" : "Add Header Category"}
                </h2>
                <button
                  onClick={() => setIsAddModalOpen(false)}
                  className="text-gray-400 hover:text-gray-600">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div
                className="p-6 space-y-4 overflow-y-auto flex-1 min-h-0 overscroll-contain touch-pan-y"
                tabIndex={0}
                onWheel={(e) => e.stopPropagation()}
                onTouchMove={(e) => e.stopPropagation()}
              >
                {/* Icon Selection */}
                <div className="flex flex-col items-center gap-4">
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-24 h-24 rounded-full bg-linear-to-br from-indigo-50 to-purple-50 border-2 border-indigo-200 flex items-center justify-center">
                      {formData.iconId && iconComponents[formData.iconId] ? (
                        <div className="w-12 h-12 text-indigo-600 flex items-center justify-center">
                          {(() => {
                            const IconComp = iconComponents[formData.iconId];
                            return <IconComp fontSize="large" />;
                          })()}
                        </div>
                      ) : formData.iconId && getIconSvg(formData.iconId) ? (
                        <div
                          className="w-12 h-12 text-indigo-600"
                          dangerouslySetInnerHTML={{
                            __html: getIconSvg(formData.iconId),
                          }}
                        />
                      ) : (
                        <Sparkles className="w-10 h-10 text-indigo-300" />
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsIconSelectorOpen(true)}
                      className="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">
                      {formData.iconId ? "Change Icon" : "Select Icon"}
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 text-center">
                    Choose an SVG icon for this header category
                  </p>
                </div>

                {/* Header Color Picker */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-gray-700">
                      Header Color
                    </label>
                    <span className="text-xs text-gray-400">
                      Used for this header&apos;s theme
                    </span>
                  </div>
                  <div className="flex items-center gap-4">
                    <div
                      className="flex-1 h-10 rounded-lg border border-gray-200 shadow-inner"
                      style={{
                        background:
                          formData.headerColor || "#FF1E1E",
                      }}
                    />
                    <input
                      type="color"
                      value={formData.headerColor || "#FF1E1E"}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          headerColor: e.target.value,
                        })
                      }
                      className="w-12 h-10 rounded-md border border-gray-300 cursor-pointer bg-transparent p-0"
                    />
                    <input
                      type="text"
                      value={formData.headerColor || "#FF1E1E"}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          headerColor: e.target.value,
                        })
                      }
                      className="w-28 px-2 py-2 rounded-lg border border-gray-300 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                      placeholder="#FF1E1E"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">
                    Name
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    placeholder="e.g., Electronics"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">
                    Slug
                  </label>
                  <input
                    type="text"
                    value={formData.slug}
                    onChange={(e) =>
                      setFormData({ ...formData, slug: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    placeholder="e.g., electronics"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">
                    Status
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) =>
                      setFormData({ ...formData, status: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500">
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                  <p className="text-xs text-gray-400">
                    Deactivating also hides this header&apos;s categories, sub-categories and their
                    products from customers and sellers. Reactivating restores the ones that were
                    switched off with it.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">
                      Commission (%)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={formData.adminCommission}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          adminCommission: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                      placeholder="e.g., 10"
                    />
                    <p className="text-xs text-gray-400">0 – 100</p>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">
                      GST (%)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={formData.gst}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          gst: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                      placeholder="e.g., 18"
                    />
                    <p className="text-xs text-gray-400">0 – 100</p>
                  </div>
                </div>

                <div className="rounded-xl border border-gray-200 bg-slate-50 p-4 space-y-4">
                  <div>
                    <p className="text-sm font-medium text-gray-700">Return Settings</p>
                    <p className="text-xs text-gray-400 mt-1">
                      Applies to every product under this header category.
                    </p>
                  </div>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(formData.returnsEnabled)}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          returnsEnabled: e.target.checked,
                        })
                      }
                      className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-sm font-medium text-gray-700">Enable Returns</span>
                  </label>
                  <div className={`space-y-2 ${formData.returnsEnabled ? "" : "opacity-50 pointer-events-none"}`}>
                    <span className="text-sm font-medium text-gray-700">Return Window (Days)</span>
                    <div className="flex flex-wrap gap-2">
                      {RETURN_WINDOW_DAY_PRESETS.map((days) => (
                        <button
                          key={days}
                          type="button"
                          onClick={() =>
                            setFormData({ ...formData, returnWindowDays: days })
                          }
                          className={cn(
                            "rounded-lg border px-3 py-1.5 text-sm font-semibold transition-colors",
                            Number(formData.returnWindowDays) === days
                              ? "border-indigo-600 bg-indigo-600 text-white"
                              : "border-gray-200 bg-white text-gray-700 hover:border-gray-300",
                          )}
                        >
                          {days}
                        </button>
                      ))}
                    </div>
                    <p className="text-xs text-gray-400">
                      Customers can return products in this category for{" "}
                      {formData.returnWindowDays} day
                      {Number(formData.returnWindowDays) === 1 ? "" : "s"} after delivery.
                    </p>
                  </div>
                </div>

              </div>

              <div className="p-6 border-t border-gray-100 flex justify-end gap-3 bg-gray-50 shrink-0">
                <button
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800 font-medium">
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium disabled:opacity-50 flex items-center gap-2">
                  {isSaving && (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  )}
                  {editingItem ? "Update Header" : "Create Header"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Icon Selector Modal */}
      <AnimatePresence>
        {isIconSelectorOpen && (
          <IconSelector
            selectedIcon={formData.iconId}
            onSelect={(iconId) => {
              setFormData({ ...formData, iconId });
              setIsIconSelectorOpen(false);
            }}
            onClose={() => setIsIconSelectorOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {isDeleteModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden">
              <div className="p-6 text-center">
                <div className="w-12 h-12 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center mx-auto mb-4">
                  <Trash2 className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">
                  Delete Category?
                </h3>
                <p className="text-gray-500 text-sm mb-4">
                  Are you sure you want to delete{" "}
                  <span className="font-semibold text-gray-900">
                    {deleteTarget?.name}
                  </span>
                  ? This action cannot be undone.
                </p>
                <div className="mb-6 rounded-lg bg-amber-50 px-3 py-2 text-left text-xs font-medium text-amber-800">
                  <p className="font-bold">What happens if you remove this:</p>
                  <ul className="mt-1.5 list-disc space-y-1 pl-4">
                    <li>This header and all categories / sub-categories under it are permanently deleted.</li>
                    <li>Products under them are <span className="font-bold">not deleted</span> — they become inactive and stop showing to customers.</li>
                    <li>Admin or seller can later assign those products to another header / category / sub-category and make them active again.</li>
                    <li>To only hide everything temporarily, set status to Inactive instead of deleting.</li>
                  </ul>
                </div>
                <div className="flex gap-3 justify-center">
                  <button
                    onClick={() => setIsDeleteModalOpen(false)}
                    className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium transition-colors">
                    Cancel
                  </button>
                  <button
                    onClick={handleDelete}
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium transition-colors">
                    Delete
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default HeaderCategories;
