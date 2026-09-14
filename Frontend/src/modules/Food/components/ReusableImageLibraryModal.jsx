import React, { useState, useEffect, useCallback } from "react";
import { Search, Loader2, X, ChevronLeft, ChevronRight, Image as ImageIcon } from "lucide-react";
import { mediaAPI } from "@food/api";

export default function ReusableImageLibraryModal({
  isOpen,
  onClose,
  onSelect,
  initialCategory = "",
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState(initialCategory);
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Debounced search logic or fetch trigger
  const fetchImages = useCallback(async () => {
    if (!isOpen) return;
    try {
      setLoading(true);
      setError(null);
      
      const params = {
        page,
        limit: 10,
        category: selectedCategory === "all" ? "" : selectedCategory,
        search: searchTerm,
      };

      const response = await mediaAPI.getSharedMedia(params);
      if (response?.data?.success) {
        setImages(response.data.data.items || []);
        setTotalPages(response.data.data.pagination?.pages || 1);
      } else {
        throw new Error(response?.data?.message || "Failed to load images");
      }
    } catch (err) {
      console.error("Failed to load library images:", err);
      setError("Failed to load image library. Please try again.");
      setImages([]);
    } finally {
      setLoading(false);
    }
  }, [isOpen, page, selectedCategory, searchTerm]);

  useEffect(() => {
    if (isOpen) {
      fetchImages();
    }
  }, [fetchImages, isOpen]);

  // Reset page when category or search changes
  useEffect(() => {
    setPage(1);
  }, [selectedCategory, searchTerm]);

  // Sync category if initialCategory changes
  useEffect(() => {
    if (initialCategory) {
      setSelectedCategory(initialCategory);
    }
  }, [initialCategory]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden shadow-2xl border border-gray-100 animate-in fade-in zoom-in duration-200">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-red-50 to-red-100/50">
          <div>
            <h3 className="text-lg font-bold text-gray-900">Choose Food Image</h3>
            <p className="text-xs text-gray-500 mt-0.5">Select a high-quality pre-approved template for your dish</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/80 rounded-lg text-gray-400 hover:text-gray-600 transition-colors shadow-sm"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter and Search Bar */}
        <div className="p-4 bg-gray-50 border-b border-gray-100 flex flex-col md:flex-row gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search pizza, burger, pasta..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none transition-all shadow-sm"
            />
          </div>

          {/* Category Filter dropdown */}
          <div className="flex gap-2">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none transition-all shadow-sm cursor-pointer"
            >
              <option value="all">All Categories</option>
              {initialCategory && initialCategory !== "Select category" && (
                <option value={initialCategory}>{initialCategory} (Current)</option>
              )}
              <option value="Pizza">Pizza</option>
              <option value="Burger">Burger</option>
              <option value="Desserts">Desserts</option>
              <option value="Beverages">Beverages</option>
              <option value="Main Course">Main Course</option>
            </select>
          </div>
        </div>

        {/* Modal Content / Image Grid */}
        <div className="flex-1 overflow-y-auto p-6 min-h-[250px]">
          {error ? (
            /* Fallback State (Api failure) */
            <div className="flex flex-col items-center justify-center h-full text-center py-8">
              <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center text-red-500 mb-3">
                <X className="w-6 h-6" />
              </div>
              <p className="text-sm font-semibold text-gray-900">{error}</p>
              <p className="text-xs text-gray-500 mt-1">Please close the library and upload your own file instead.</p>
              <button
                onClick={fetchImages}
                className="mt-4 px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl text-xs font-semibold transition-all border border-red-200"
              >
                Retry Loading
              </button>
            </div>
          ) : loading ? (
            /* Loading State */
            <div className="flex items-center justify-center h-full py-12">
              <Loader2 className="w-8 h-8 text-red-500 animate-spin" />
            </div>
          ) : images.length === 0 ? (
            /* Friendly Empty State */
            <div className="flex flex-col items-center justify-center h-full text-center py-8">
              <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center text-red-500 mb-3">
                <ImageIcon className="w-6 h-6" />
              </div>
              <p className="text-sm font-semibold text-gray-900">No images found</p>
              <p className="text-xs text-gray-500 mt-1">Try changing your search terms or category filter.</p>
              <p className="text-xs text-gray-500 font-semibold mt-2">Or close this modal and upload your own image.</p>
            </div>
          ) : (
            /* Image Grid */
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {images.map((item) => (
                <div
                  key={item._id || item.id}
                  onClick={() => onSelect(item)}
                  className="group relative aspect-square rounded-xl overflow-hidden border border-gray-100 shadow-sm cursor-pointer hover:shadow-md hover:border-red-200 active:scale-95 transition-all"
                >
                  <img
                    src={item.thumbnailUrl || item.url}
                    alt={item.tags?.join(", ") || "Shared Food"}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    loading="lazy"
                  />
                  {/* Category overlay label */}
                  {item.category && (
                    <span className="absolute bottom-2 left-2 bg-black/60 text-white text-[10px] px-2 py-0.5 rounded-full backdrop-blur-sm">
                      {item.category}
                    </span>
                  )}
                  {/* Hover check effect */}
                  <div className="absolute inset-0 bg-red-500/10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center" />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer / Pagination Controls */}
        {!loading && !error && images.length > 0 && (
          <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between bg-gray-50">
            <span className="text-xs text-gray-500 font-medium">
              Page {page} of {totalPages}
            </span>
            <div className="flex gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage(p => Math.max(1, p - 1))}
                className="p-1.5 border border-gray-200 rounded-lg hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm bg-white"
              >
                <ChevronLeft className="w-4 h-4 text-gray-600" />
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                className="p-1.5 border border-gray-200 rounded-lg hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm bg-white"
              >
                <ChevronRight className="w-4 h-4 text-gray-600" />
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
