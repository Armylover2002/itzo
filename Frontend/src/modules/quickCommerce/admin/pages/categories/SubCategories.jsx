import React, { useState, useEffect, useMemo, useRef } from "react";
import Card from "@shared/components/ui/Card";
import Badge from "@shared/components/ui/Badge";
import {
  Plus,
  Search,
  Edit,
  Trash,
  Trash2,
  X,
  Upload,
  Image,
  Filter,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { adminApi } from "../../services/adminApi";
import { toast } from "sonner";
import { useAuth } from "@core/context/AuthContext";
import { getCurrentUser } from "@food/utils/auth";
import { canPerformAdminPermissionAction, extractAdminPermissions, extractAdminRoleId, fetchAdminRolePermissions } from "@food/utils/adminPermissions";
import {
  buildCategoryFormData,
  bulkDeleteCategories,
  describeCategoryCascade,
  describeCategoryDelete,
  extractCategoryApiError,
  fetchAllCategoriesByType,
  removeCategoriesFromList,
  upsertCategoryInList,
  validateCategoryImage,
} from "../../utils/categoryHelpers";


const SubCategories = () => {
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

  const permissionKey = "quick::core_management::categories::sub";
  const canCreate = canPerformAdminPermissionAction(currentUser, resolvedPermissions, permissionKey, "create");
  const canEdit = canPerformAdminPermissionAction(currentUser, resolvedPermissions, permissionKey, "edit");
  const canDelete = canPerformAdminPermissionAction(currentUser, resolvedPermissions, permissionKey, "delete");

  const [categories, setCategories] = useState([]);
  const [level2Categories, setLevel2Categories] = useState([]);
  const [headerCategories, setHeaderCategories] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterLevel2, setFilterLevel2] = useState("all");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedItems, setSelectedItems] = useState([]);

  const [formData, setFormData] = useState({
    name: "",
    slug: "",
    description: "",
    status: "active",
    type: "subcategory",
    parentId: "",
  });

  const [imageFile, setImageFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    setIsLoading(true);
    try {
      const [subcategories, level2, headers] = await Promise.all([
        fetchAllCategoriesByType(adminApi, "subcategory"),
        fetchAllCategoriesByType(adminApi, "category"),
        fetchAllCategoriesByType(adminApi, "header"),
      ]);
      setCategories(subcategories);
      setLevel2Categories(level2);
      setHeaderCategories(headers);
    } catch (error) {
      toast.error(extractCategoryApiError(error, "Failed to fetch categories"));
    } finally {
      setIsLoading(false);
    }
  };

  const getParentInfo = (parentId) => {
    const id = parentId?._id || parentId;
    const parent = level2Categories.find((c) => (c._id || c.id) === id);
    if (!parent) return { name: "Unknown", headerName: "Unknown" };

    const headerId = parent.parentId?._id || parent.parentId;
    const header = headerCategories.find((h) => (h._id || h.id) === headerId);

    return {
      name: parent.name,
      headerName: header ? header.name : "Unknown",
    };
  };

  const filteredCategories = useMemo(() => {
    return categories.filter((cat) => {
      const matchesSearch = cat.name
        .toLowerCase()
        .includes(searchTerm.toLowerCase());
      const matchesParent =
        filterLevel2 === "all" ||
        (cat.parentId && cat.parentId._id === filterLevel2) ||
        cat.parentId === filterLevel2;
      return matchesSearch && matchesParent;
    });
  }, [categories, searchTerm, filterLevel2]);

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const imageError = validateCategoryImage(file);
    if (imageError) {
      toast.error(imageError);
      e.target.value = "";
      return;
    }

    setImageFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const handleSave = async () => {
    if (!formData.name || !formData.slug || !formData.parentId) {
      toast.error("Name, slug and parent category are required");
      return;
    }

    if (!imageFile && !previewUrl) {
      toast.error("Subcategory image is required");
      return;
    }

    if (!level2Categories.length) {
      toast.error("Create a level 2 category before adding subcategories");
      return;
    }

    setIsSaving(true);
    try {
      const data = buildCategoryFormData(formData, "subcategory", imageFile);

      if (editingItem) {
        const res = await adminApi.updateCategory(editingItem._id || editingItem.id, data);
        const updated = res?.data?.result;
        toast.success(describeCategoryCascade(res?.data?.cascade, "Subcategory updated"));
        if (updated) {
          setCategories((prev) => upsertCategoryInList(prev, updated));
        } else {
          await fetchCategories();
        }
      } else {
        const res = await adminApi.createCategory(data);
        const created = res?.data?.result;
        toast.success("Subcategory created");
        if (created) {
          setCategories((prev) => upsertCategoryInList(prev, created));
        } else {
          await fetchCategories();
        }
      }
      setIsAddModalOpen(false);
      setEditingItem(null);
      setImageFile(null);
      setPreviewUrl(null);
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
      const id = deleteTarget._id || deleteTarget.id;
      const res = await adminApi.deleteCategory(id);
      toast.success(describeCategoryDelete(res?.data?.result, "Subcategory"));
      setCategories((prev) => removeCategoriesFromList(prev, [id]));
      setIsDeleteModalOpen(false);
      setDeleteTarget(null);
    } catch (error) {
      toast.error(extractCategoryApiError(error, "Failed to delete subcategory"));
    }
  };

  const openAddModal = () => {
    setEditingItem(null);
    const defaultParentId =
      level2Categories[0]?._id || level2Categories[0]?.id || "";
    setFormData({
      name: "",
      slug: "",
      description: "",
      status: "active",
      type: "subcategory",
      parentId: defaultParentId,
    });
    setImageFile(null);
    setPreviewUrl(null);
    setIsAddModalOpen(true);
  };

  const openEditModal = (item) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      slug: item.slug,
      description: item.description || "",
      status: item.status,
      type: "subcategory",
      parentId: item.parentId?._id || item.parentId || "",
    });
    setImageFile(null);
    setPreviewUrl(item.image?.url || item.image || null);
    setIsAddModalOpen(true);
  };

  const handleSelect = (id) => {
    setSelectedItems((prev) => {
      if (prev.includes(id)) {
        return prev.filter((item) => item !== id);
      } else {
        return [...prev, id];
      }
    });
  };

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedItems(filteredCategories.map((c) => c._id || c.id));
    } else {
      setSelectedItems([]);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedItems.length === 0) return;

    if (
      !window.confirm(
        `Are you sure you want to delete ${selectedItems.length} items?`,
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
        await fetchCategories();
      } else {
        toast.success(`${deleted} subcategor${deleted === 1 ? "y" : "ies"} deleted`);
        setCategories((prev) => removeCategoriesFromList(prev, selectedItems));
      }
      setSelectedItems([]);
    } catch (error) {
      toast.error(extractCategoryApiError(error, "Failed to delete subcategories"));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Subcategories</h1>
          <p className="text-gray-500 mt-1">
            Manage level 3 categories linked to secondary categories
          </p>
        </div>
        {canCreate && (
          <button
            onClick={openAddModal}
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors">
            <Plus className="w-5 h-5" />
            Add New Subcategory
          </button>
        )}
      </div>

      <Card className="border-none shadow-sm">
        <div className="p-4 border-b border-gray-100 flex gap-4 items-center flex-wrap">
          {selectedItems.length > 0 && canDelete && (
            <button
              onClick={handleBulkDelete}
              className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors text-sm font-medium">
              <Trash2 className="w-4 h-4" />
              Delete ({selectedItems.length})
            </button>
          )}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search subcategories..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            />
          </div>
          <div className="flex items-center gap-2 min-w-[200px]">
            <Filter className="text-gray-400 w-5 h-5" />
            <select
              value={filterLevel2}
              onChange={(e) => setFilterLevel2(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500">
              <option value="all">All Level 2 Categories</option>
              {level2Categories.map((c) => (
                <option key={c._id || c.id} value={c._id || c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="py-3 px-4 text-left">
                  <input
                    type="checkbox"
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    checked={
                      selectedItems.length > 0 &&
                      selectedItems.length === filteredCategories.length
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
                  Parent Chain
                </th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Slug
                </th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                <tr>
                  <td colSpan="7" className="text-center py-8 text-gray-500">
                    Loading...
                  </td>
                </tr>
              ) : filteredCategories.length === 0 ? (
                <tr>
                  <td colSpan="7" className="text-center py-8 text-gray-500">
                    No subcategories found
                  </td>
                </tr>
              ) : (
                filteredCategories.map((cat) => {
                  const parentInfo = getParentInfo(cat.parentId);
                  return (
                    <tr
                      key={cat._id || cat.id}
                      className="hover:bg-gray-50/50 transition-colors">
                      <td className="py-3 px-4">
                        <input
                          type="checkbox"
                          className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                        checked={selectedItems.includes(cat._id || cat.id)}
                        onChange={() => handleSelect(cat._id || cat.id)}
                        />
                      </td>
                      <td className="py-3 px-4">
                        <div className="w-10 h-10 rounded-lg bg-gray-100 overflow-hidden flex items-center justify-center border border-gray-200">
                          {cat.image?.url || cat.image ? (
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
                      <td className="py-3 px-4">
                        <div className="flex flex-col gap-1">
                          <span className="text-xs text-gray-500 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-gray-300"></span>
                            {parentInfo.headerName}
                          </span>
                          <span className="text-sm text-gray-700 font-medium pl-2.5 border-l-2 border-gray-200">
                            {parentInfo.name}
                          </span>
                        </div>
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
                            className="p-1 text-gray-500 hover:text-red-600 transition-colors">
                            <Trash className="w-5 h-5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Add/Edit Modal */}
      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden">
              <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                <h2 className="text-lg font-bold text-gray-900">
                  {editingItem ? "Edit Subcategory" : "Add Subcategory"}
                </h2>
                <button
                  onClick={() => setIsAddModalOpen(false)}
                  className="text-gray-400 hover:text-gray-600">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="p-6 space-y-4">
                {/* Image Upload */}
                <div className="space-y-2">
                  <label className="block text-center text-sm font-medium text-gray-700">
                    Image <span className="text-red-500">*</span>
                  </label>
                  <div className="flex justify-center">
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="w-24 h-24 rounded-full bg-gray-50 border-2 border-dashed border-gray-300 flex items-center justify-center cursor-pointer hover:border-indigo-500 overflow-hidden transition-colors">
                    {previewUrl ? (
                      <img
                        src={previewUrl}
                        alt="Preview"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="text-center">
                        <Image className="w-8 h-8 text-gray-400 mx-auto" />
                        <span className="text-xs text-gray-500 mt-1">
                          Upload
                        </span>
                      </div>
                    )}
                  </div>
                  <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    onChange={handleImageChange}
                    accept="image/*"
                  />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">
                    Parent Category (Level 2)
                  </label>
                  <select
                    value={formData.parentId}
                    onChange={(e) =>
                      setFormData({ ...formData, parentId: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500">
                    {level2Categories.map((c) => {
                      const parentInfo = getParentInfo(c._id || c.id);
                      // Since getParentInfo uses level2Categories state which might be same as c,
                      // we actually need header info.
                      // But getParentInfo looks up in headerCategories which we have.
                      // However, `c` is the category itself (level 2). We need its parent (header).
                      const headerId = c.parentId?._id || c.parentId;
                      const header = headerCategories.find(
                        (h) => (h._id || h.id) === headerId,
                      );
                      const headerName = header ? header.name : "Unknown";

                      return (
                        <option key={c._id || c.id} value={c._id || c.id}>
                          {headerName} &gt; {c.name}
                        </option>
                      );
                    })}
                  </select>
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
                    placeholder="e.g., Gaming Laptops"
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
                    placeholder="e.g., gaming-laptops"
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
                    Deactivating also hides every product in this sub-category from customers and
                    sellers.
                  </p>
                </div>
              </div>

              <div className="p-6 border-t border-gray-100 flex justify-end gap-3 bg-gray-50">
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
                  {editingItem ? "Update Subcategory" : "Create Subcategory"}
                </button>
              </div>
            </motion.div>
          </div>
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
                <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-4">
                  <Trash className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">
                  Delete Subcategory?
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
                    <li>This sub-category is permanently deleted.</li>
                    <li>Products under it are <span className="font-bold">not deleted</span> — they become inactive and stop showing to customers.</li>
                    <li>Admin or seller can later assign those products to another sub-category and make them active again.</li>
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
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium transition-colors">
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

export default SubCategories;
