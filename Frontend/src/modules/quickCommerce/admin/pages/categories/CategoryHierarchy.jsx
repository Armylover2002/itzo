import React, { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import {
  LayoutGrid,
  List,
  ChevronRight,
  Search,
  FolderOpen,
  Folder,
  Tag,
  Layers,
  ArrowRight,
  Package,
  Plus,
  Trash2,
  Power,
  Link2,
} from "lucide-react";
import { adminApi } from "../../services/adminApi";
import Card from "@shared/components/ui/Card";
import Badge from "@shared/components/ui/Badge";
import { toast } from "sonner";
import { getIconSvg } from "@shared/constants/categoryIcons";
import CategoryHierarchyModal from "./CategoryHierarchyModal";
import CategoryDeleteDialog from "./CategoryDeleteDialog";

const CategoryHierarchy = () => {
  const [categories, setCategories] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  // What the create modal should open on (level + preselected parents).
  const [addModalSeed, setAddModalSeed] = useState({
    level: "header",
    headerId: "",
    parentId: "",
  });

  // Delete flow — the shared dialog loads the branch impact itself.
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [togglingId, setTogglingId] = useState(null);
  const [relinkTarget, setRelinkTarget] = useState(null);
  const [isRelinking, setIsRelinking] = useState(false);

  // Selection State for Miller Columns
  const [selectedHeader, setSelectedHeader] = useState(null);
  const [selectedLevel2, setSelectedLevel2] = useState(null);

  // Stats
  const stats = useMemo(() => {
    let headers = 0;
    let l2 = 0;
    let subs = 0;

    const traverse = (items) => {
      items.forEach((item) => {
        if (item.type === "header") headers++;
        if (item.type === "category") l2++;
        if (item.type === "subcategory") subs++;
        if (item.children) traverse(item.children);
      });
    };
    traverse(categories);
    return { headers, l2, subs, total: headers + l2 + subs };
  }, [categories]);

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    setIsLoading(true);
    try {
      const res = await adminApi.getCategoryTree();
      if (res.data.success) {
        const tree = res.data.results || res.data.result || [];
        setCategories(tree);

        // Keep the open columns pointing at fresh objects (or close them if the
        // selection was just deleted) so the view never shows stale children.
        setSelectedHeader((prev) => {
          if (!prev) return null;
          return (
            tree.find(
              (item) => String(item._id || item.id) === String(prev._id || prev.id),
            ) || null
          );
        });
      }
    } catch (error) {
      toast.error("Failed to fetch category hierarchy");
    } finally {
      setIsLoading(false);
    }
  };

  // Re-point the Level 2 selection at the refreshed header's children.
  useEffect(() => {
    setSelectedLevel2((prev) => {
      if (!prev) return null;
      if (!selectedHeader) return null;
      return (
        (selectedHeader.children || []).find(
          (item) => String(item._id || item.id) === String(prev._id || prev.id),
        ) || null
      );
    });
  }, [selectedHeader]);

  const openAddModal = (seed) => {
    setAddModalSeed(seed);
    setIsAddModalOpen(true);
  };

  // The shared dialog loads the impact itself, so opening it is just setting the target.
  const openDeleteDialog = (item) => setDeleteTarget(item);

  const handleDeleted = async () => {
    setDeleteTarget(null);
    await fetchCategories();
  };

  const isItemActive = (item) =>
    (item?.status ? item.status !== "inactive" : true) && item?.isActive !== false;

  // Switching a category on or off takes its whole branch (and those products)
  // with it — the API does the cascade and reports what it touched.
  const toggleStatus = async (item) => {
    const id = item._id || item.id;
    const goingActive = !isItemActive(item);
    setTogglingId(id);
    try {
      const payload = new FormData();
      payload.append("status", goingActive ? "active" : "inactive");
      const res = await adminApi.updateCategory(id, payload);
      const cascade = res.data?.cascade;
      const productNote =
        cascade?.productCount > 0
          ? ` · ${cascade.productCount} product${cascade.productCount === 1 ? "" : "s"} ${goingActive ? "back on" : "switched off"}`
          : "";
      toast.success(
        `"${item.name}" ${goingActive ? "activated" : "deactivated"}${productNote}`,
      );
      await fetchCategories();
    } catch (error) {
      toast.error(error.response?.data?.message || "Could not change the status");
    } finally {
      setTogglingId(null);
    }
  };

  // Re-link an unlinked category under a new parent — this also brings it and its
  // products back online when the chosen parent is active.
  const submitRelink = async (parentId) => {
    if (!relinkTarget || !parentId) return;
    setIsRelinking(true);
    try {
      const payload = new FormData();
      payload.append("parentId", parentId);
      await adminApi.updateCategory(relinkTarget._id || relinkTarget.id, payload);
      toast.success(`"${relinkTarget.name}" moved and reactivated`);
      setRelinkTarget(null);
      await fetchCategories();
    } catch (error) {
      toast.error(error.response?.data?.message || "Could not move the category");
    } finally {
      setIsRelinking(false);
    }
  };

  // Anything at the root that is not a header lost its parent when that parent was
  // deleted. It stays switched off until it is linked somewhere again.
  const unlinkedCategories = useMemo(
    () => categories.filter((c) => (c.type || "header") !== "header"),
    [categories],
  );

  // Valid new parents for the category being moved: one level above its own type.
  const relinkParentOptions = useMemo(() => {
    if (!relinkTarget) return [];
    const headers = categories.filter((c) => (c.type || "header") === "header");
    if (relinkTarget.type === "subcategory") {
      return headers.flatMap((header) =>
        (header.children || []).filter((child) => (child.type || "") === "category"),
      );
    }
    return headers;
  }, [categories, relinkTarget]);

  // Filter Logic
  const filteredHeaders = useMemo(() => {
    if (!searchTerm) return categories.filter((c) => c.type === "header");

    // If searching, we want to show path to matches
    // But for Miller columns, simple filtering of top level might be confusing
    // So we'll just filter the current list being viewed
    return categories.filter(
      (c) =>
        c.type === "header" &&
        c.name.toLowerCase().includes(searchTerm.toLowerCase()),
    );
  }, [categories, searchTerm]);

  const activeLevel2 = useMemo(() => {
    if (!selectedHeader) return [];
    return selectedHeader.children || [];
  }, [selectedHeader]);

  const activeSubs = useMemo(() => {
    if (!selectedLevel2) return [];
    return selectedLevel2.children || [];
  }, [selectedLevel2]);

  // Handle Selection
  const handleHeaderSelect = (header) => {
    setSelectedHeader(header);
    setSelectedLevel2(null);
  };

  const handleLevel2Select = (l2) => {
    setSelectedLevel2(l2);
  };

  // Components
  const ColumnHeader = ({ title, icon: Icon, count, color, onAdd, addLabel, addDisabled }) => (
    <div
      className={`p-4 border-b border-gray-100 bg-white sticky top-0 z-10 flex items-center justify-between ${color}`}>
      <div className="flex items-center gap-2 font-bold text-gray-700">
        <Icon className="w-4 h-4" />
        <span>{title}</span>
      </div>
      <div className="flex items-center gap-2">
        <Badge variant="neutral" className="bg-gray-100 text-gray-600 font-mono">
          {count}
        </Badge>
        {onAdd && (
          <button
            type="button"
            onClick={onAdd}
            disabled={addDisabled}
            title={addLabel}
            className="p-1.5 rounded-lg text-primary hover:bg-primary/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <Plus className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );

  const ListItem = ({ item, isSelected, onClick, hasChildren, type, onDelete, onToggle }) => {
    const activeClass = isSelected
      ? "bg-orange-50 border-orange-200 text-orange-700 shadow-sm z-10"
      : "hover:bg-gray-50 border-transparent text-gray-600";

    const iconColor = isSelected ? "text-primary" : "text-gray-400";
    const live = isItemActive(item);
    const isBusy = togglingId === (item._id || item.id);

    return (
      <motion.div
        layout
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        onClick={onClick}
        className={`
                    group flex items-center justify-between p-3 mx-2 my-1 rounded-lg border cursor-pointer transition-all duration-200
                    ${activeClass}
                `}>
        <div className="flex items-center gap-3 overflow-hidden">
          <div
            className={`
                        w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors
                        ${isSelected ? "bg-white shadow-sm" : "bg-gray-100 group-hover:bg-white group-hover:shadow-sm"}
                    `}>
            {type === "header" && item.iconId && getIconSvg(item.iconId) ? (
              <div
                className={`w-4 h-4 ${iconColor}`}
                dangerouslySetInnerHTML={{ __html: getIconSvg(item.iconId) }}
              />
            ) : item.image?.url || item.image ? (
              <img
                src={item.image?.url || item.image}
                alt=""
                className="w-full h-full object-cover rounded-lg"
              />
            ) : type === "header" ? (
              <FolderOpen className={`w-4 h-4 ${iconColor}`} />
            ) : type === "category" ? (
              <Folder className={`w-4 h-4 ${iconColor}`} />
            ) : (
              <Tag className={`w-4 h-4 ${iconColor}`} />
            )}
          </div>
          <div className="flex flex-col overflow-hidden">
            <span className="font-semibold text-sm truncate flex items-center gap-1.5">
              {item.name}
              {!live && (
                <span className="shrink-0 rounded px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider bg-gray-200 text-gray-600">
                  Off
                </span>
              )}
            </span>
            <span className="text-[10px] uppercase tracking-wider opacity-60 truncate">
              {item.slug}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            title={live ? `Switch off ${item.name}` : `Switch on ${item.name}`}
            disabled={isBusy}
            onClick={(e) => {
              e.stopPropagation();
              onToggle?.(item);
            }}
            className={`p-1.5 rounded-lg transition-all disabled:opacity-40 ${
              live
                ? "text-gray-300 hover:text-amber-600 hover:bg-amber-50 opacity-0 group-hover:opacity-100 focus:opacity-100"
                : "text-emerald-600 hover:bg-emerald-50"
            }`}
          >
            <Power className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            title={`Delete ${item.name}`}
            onClick={(e) => {
              e.stopPropagation();
              onDelete?.(item);
            }}
            className="p-1.5 rounded-lg text-gray-300 hover:text-red-600 hover:bg-red-50 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-all"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          {hasChildren && (
            <ChevronRight
              className={`w-4 h-4 ${isSelected ? "text-orange-400" : "text-gray-300"}`}
            />
          )}
        </div>
      </motion.div>
    );
  };

  return (
    <div className="h-[calc(100vh-100px)] flex flex-col gap-4 animate-in fade-in duration-500">
      {/* Top Bar */}
      <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-gray-100 shadow-sm shrink-0">
        <div>
          <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <Layers className="w-6 h-6 text-primary" />
            Category Hierarchy Explorer
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Visual overview of your catalog structure ({stats.total} items)
          </p>
        </div>

        <div className="flex items-center gap-6">
          <button
            onClick={() => openAddModal({ level: "header", headerId: "", parentId: "" })}
            className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary-hover transition-colors"
          >
            <Plus className="w-5 h-5" />
            Create Category
          </button>
          
          <div className="flex items-center gap-4 text-sm text-gray-500 bg-gray-50 px-4 py-2 rounded-xl">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-primary"></span>
              <span>
                Headers: <b>{stats.headers}</b>
              </span>
            </div>
            <div className="w-px h-4 bg-gray-300"></div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-primary"></span>
              <span>
                Level 2: <b>{stats.l2}</b>
              </span>
            </div>
            <div className="w-px h-4 bg-gray-300"></div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span>
                Subcategories: <b>{stats.subs}</b>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Categories whose parent was deleted — switched off until re-linked */}
      {unlinkedCategories.length > 0 && (
        <div className="shrink-0 rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-start gap-3">
            <Link2 className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-amber-900">
                {unlinkedCategories.length} categor
                {unlinkedCategories.length === 1 ? "y is" : "ies are"} unlinked
              </p>
              <p className="text-xs text-amber-800 mt-0.5">
                Their parent was deleted, so they and their products are switched off.
                Move them under a parent to bring them back.
              </p>
              <div className="flex flex-wrap gap-2 mt-3">
                {unlinkedCategories.map((item) => (
                  <button
                    key={item._id || item.id}
                    type="button"
                    onClick={() => setRelinkTarget(item)}
                    className="inline-flex items-center gap-2 rounded-xl bg-white border border-amber-200 px-3 py-1.5 text-xs font-bold text-amber-900 hover:bg-amber-100 transition-colors"
                  >
                    {item.type === "subcategory" ? (
                      <Tag className="w-3.5 h-3.5" />
                    ) : (
                      <Folder className="w-3.5 h-3.5" />
                    )}
                    {item.name}
                    <span className="text-[10px] font-medium text-amber-600">Move</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Miller Columns View */}
      <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-3 md:grid-rows-[minmax(0,1fr)] gap-4 overflow-hidden">
        {/* Column 1: Headers */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm flex flex-col overflow-hidden min-h-0 h-full">
          <ColumnHeader
            title="Header Categories"
            icon={LayoutGrid}
            count={filteredHeaders.length}
            color="border-l-4 border-l-indigo-500"
            addLabel="Add header category"
            onAdd={() => openAddModal({ level: "header", headerId: "", parentId: "" })}
          />

          <div className="p-2 border-b border-gray-100">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Filter headers..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-gray-50 border-none rounded-lg text-sm focus:ring-2 focus:ring-orange-100 transition-all"
              />
            </div>
          </div>

          <div
            className="flex-1 min-h-0 overflow-y-auto py-2 custom-scrollbar overscroll-contain touch-pan-y"
            tabIndex={0}
            onWheel={(e) => e.stopPropagation()}
            onTouchMove={(e) => e.stopPropagation()}
          >
            {isLoading ? (
              <div className="p-8 text-center text-gray-400 text-sm">
                Loading structure...
              </div>
            ) : filteredHeaders.length === 0 ? (
              <div className="p-8 text-center text-gray-400 text-sm">
                No headers found
              </div>
            ) : (
              filteredHeaders.map((header) => (
                <ListItem
                  key={header._id || header.id}
                  item={header}
                  type="header"
                  isSelected={
                    selectedHeader &&
                    (selectedHeader._id || selectedHeader.id) ===
                    (header._id || header.id)
                  }
                  onClick={() => handleHeaderSelect(header)}
                  hasChildren={header.children && header.children.length > 0}
                  onDelete={openDeleteDialog}
                  onToggle={toggleStatus}
                />
              ))
            )}
          </div>
        </div>

        {/* Column 2: Level 2 */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm flex flex-col overflow-hidden min-h-0 h-full transition-all duration-300">
          <ColumnHeader
            title="Level 2 Categories"
            icon={Folder}
            count={activeLevel2.length}
            color="border-l-4 border-l-purple-500"
            addLabel={
              selectedHeader
                ? `Add main category in "${selectedHeader.name}"`
                : "Select a header first"
            }
            addDisabled={!selectedHeader}
            onAdd={() =>
              openAddModal({
                level: "category",
                headerId: selectedHeader?._id || selectedHeader?.id || "",
                parentId: "",
              })
            }
          />

          {!selectedHeader ? (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-400 p-8 text-center bg-gray-50/50">
              <ArrowRight className="w-12 h-12 mb-3 opacity-20" />
              <p className="text-sm">
                Select a Header Category
                <br />
                to view its contents
              </p>
            </div>
          ) : (
            <div
              className="flex-1 min-h-0 overflow-y-auto py-2 custom-scrollbar overscroll-contain touch-pan-y"
              tabIndex={0}
              onWheel={(e) => e.stopPropagation()}
              onTouchMove={(e) => e.stopPropagation()}
            >
              {activeLevel2.length === 0 ? (
                <div className="p-8 text-center text-gray-400 text-sm">
                  No Level 2 categories in <br />
                  <span className="font-bold text-gray-600">
                    "{selectedHeader.name}"
                  </span>
                </div>
              ) : (
                activeLevel2.map((l2) => (
                  <ListItem
                    key={l2._id || l2.id}
                    item={l2}
                    type="category"
                    isSelected={
                      selectedLevel2 &&
                      (selectedLevel2._id || selectedLevel2.id) ===
                      (l2._id || l2.id)
                    }
                    onClick={() => handleLevel2Select(l2)}
                    hasChildren={l2.children && l2.children.length > 0}
                    onDelete={openDeleteDialog}
                  onToggle={toggleStatus}
                  />
                ))
              )}
            </div>
          )}
        </div>

        {/* Column 3: Subcategories */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm flex flex-col overflow-hidden min-h-0 h-full">
          <ColumnHeader
            title="Subcategories"
            icon={Tag}
            count={activeSubs.length}
            color="border-l-4 border-l-emerald-500"
            addLabel={
              selectedLevel2
                ? `Add subcategory in "${selectedLevel2.name}"`
                : "Select a main category first"
            }
            addDisabled={!selectedLevel2}
            onAdd={() =>
              openAddModal({
                level: "subcategory",
                headerId: selectedHeader?._id || selectedHeader?.id || "",
                parentId: selectedLevel2?._id || selectedLevel2?.id || "",
              })
            }
          />

          {!selectedLevel2 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-400 p-8 text-center bg-gray-50/50">
              <ArrowRight className="w-12 h-12 mb-3 opacity-20" />
              <p className="text-sm">
                Select a Level 2 Category
                <br />
                to view subcategories
              </p>
            </div>
          ) : (
            <div
              className="flex-1 min-h-0 overflow-y-auto py-2 custom-scrollbar overscroll-contain touch-pan-y"
              tabIndex={0}
              onWheel={(e) => e.stopPropagation()}
              onTouchMove={(e) => e.stopPropagation()}
            >
              {activeSubs.length === 0 ? (
                <div className="p-8 text-center text-gray-400 text-sm">
                  No subcategories in <br />
                  <span className="font-bold text-gray-600">
                    "{selectedLevel2.name}"
                  </span>
                </div>
              ) : (
                activeSubs.map((sub) => (
                  <ListItem
                    key={sub._id || sub.id}
                    item={sub}
                    type="subcategory"
                    isSelected={false}
                    onClick={() => { }}
                    hasChildren={false}
                    onDelete={openDeleteDialog}
                  onToggle={toggleStatus}
                  />
                ))
              )}
            </div>
          )}
        </div>
      </div>

      <CategoryHierarchyModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={fetchCategories}
        categoryTree={categories}
        defaultLevel={addModalSeed.level}
        defaultHeaderId={addModalSeed.headerId}
        defaultParentId={addModalSeed.parentId}
      />

      <CategoryDeleteDialog
        target={deleteTarget}
        onCancel={() => setDeleteTarget(null)}
        onDeleted={handleDeleted}
      />

      {/* Pick a new parent for an unlinked category */}
      {relinkTarget && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => !isRelinking && setRelinkTarget(null)}
          />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-slate-900">Move category</h3>
            <p className="text-sm text-slate-600 mt-1">
              Choose a new{" "}
              {relinkTarget.type === "subcategory" ? "main category" : "header category"} for{" "}
              <strong>&quot;{relinkTarget.name}&quot;</strong>. It and its products come back
              online if the new parent is active.
            </p>

            <div className="mt-4 max-h-64 overflow-y-auto space-y-1.5">
              {relinkParentOptions.length === 0 ? (
                <p className="text-sm text-slate-500 py-4 text-center">
                  No {relinkTarget.type === "subcategory" ? "main categories" : "header categories"}{" "}
                  available. Create one first.
                </p>
              ) : (
                relinkParentOptions.map((option) => (
                  <button
                    key={option._id || option.id}
                    type="button"
                    disabled={isRelinking}
                    onClick={() => submitRelink(option._id || option.id)}
                    className="w-full flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-4 py-3 text-left hover:border-primary hover:bg-primary/5 transition-colors disabled:opacity-50"
                  >
                    <span className="text-sm font-semibold text-slate-800 truncate">
                      {option.name}
                    </span>
                    {!isItemActive(option) && (
                      <span className="shrink-0 rounded px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider bg-gray-200 text-gray-600">
                        Off
                      </span>
                    )}
                  </button>
                ))
              )}
            </div>

            <button
              type="button"
              onClick={() => setRelinkTarget(null)}
              disabled={isRelinking}
              className="mt-4 w-full px-4 py-2.5 text-sm font-medium rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CategoryHierarchy;
