import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { adminApi } from "../../services/adminApi";

/**
 * Shared confirmation for deleting any category level.
 *
 * Only the chosen category is removed. Everything nested under it is switched off
 * and unlinked (so it can be moved under another parent later), and the products
 * in that branch are switched off too. The dialog loads the real impact from the
 * API first so the admin sees exactly what will change before confirming.
 */
export default function CategoryDeleteDialog({ target, onCancel, onDeleted }) {
  const [impact, setImpact] = useState(null);
  const [isLoadingImpact, setIsLoadingImpact] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const targetId = target ? target._id || target.id : null;

  useEffect(() => {
    if (!targetId) {
      setImpact(null);
      return;
    }

    let cancelled = false;
    setImpact(null);
    setIsLoadingImpact(true);

    adminApi
      .getCategoryDeleteImpact(targetId)
      .then((res) => {
        if (!cancelled) setImpact(res.data?.result || null);
      })
      .catch(() => {
        if (!cancelled) toast.error("Could not load what this delete will affect");
      })
      .finally(() => {
        if (!cancelled) setIsLoadingImpact(false);
      });

    return () => {
      cancelled = true;
    };
  }, [targetId]);

  if (!target) return null;

  const handleConfirm = async () => {
    setIsDeleting(true);
    try {
      const res = await adminApi.deleteCategory(targetId);
      const result = res.data?.result || {};
      const deactivated = result.deactivatedProductCount || 0;
      toast.success(
        deactivated > 0
          ? `Deleted "${target.name}" — ${deactivated} product${deactivated === 1 ? "" : "s"} switched off`
          : `Deleted "${target.name}"`,
      );
      onDeleted?.(result);
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to delete category");
    } finally {
      setIsDeleting(false);
    }
  };

  const hasNested = impact && impact.totalCategoryCount > 1;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => !isDeleting && onCancel?.()}
          className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
        >
          <div className="p-6">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
              <div className="min-w-0">
                <h3 className="text-lg font-bold text-slate-900">Delete category</h3>
                <p className="text-sm text-slate-600 truncate">{target.name}</p>
              </div>
            </div>

            {isLoadingImpact ? (
              <div className="flex items-center gap-2 text-sm text-slate-500 py-4">
                <Loader2 className="w-4 h-4 animate-spin" />
                Checking what this will affect...
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-slate-700">
                  Only <strong>&quot;{target.name}&quot;</strong> is deleted
                  {hasNested
                    ? ". Everything under it is switched off and unlinked, so you can move it under another parent later."
                    : "."}
                </p>

                {impact && (
                  <div className="rounded-xl border border-red-100 bg-red-50 p-4 space-y-2">
                    {impact.mainCategoryCount > 0 && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-red-900 font-medium">Main categories switched off</span>
                        <span className="font-bold text-red-700">{impact.mainCategoryCount}</span>
                      </div>
                    )}
                    {impact.subcategoryCount > 0 && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-red-900 font-medium">Subcategories switched off</span>
                        <span className="font-bold text-red-700">{impact.subcategoryCount}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-red-900 font-medium">Products switched off</span>
                      <span className="font-bold text-red-700">{impact.productCount}</span>
                    </div>
                  </div>
                )}

                <p className="text-xs text-slate-500">
                  Nothing else is deleted — categories and products are only set to inactive
                  and hidden from the storefront. They come back when you re-link them under
                  an active category.
                </p>
              </div>
            )}

            <div className="flex items-center gap-3 mt-6">
              <button
                onClick={() => onCancel?.()}
                disabled={isDeleting}
                className="flex-1 px-4 py-2.5 text-sm font-medium rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                disabled={isDeleting || isLoadingImpact}
                className="flex-1 px-4 py-2.5 text-sm font-medium rounded-xl bg-red-600 hover:bg-red-700 text-white transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  "Delete"
                )}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
