import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Upload, Image as ImageIcon, FolderOpen, Folder, Tag, Check } from 'lucide-react';
import { toast } from 'sonner';
import { adminApi } from '../../services/adminApi';
import IconSelector from '@shared/components/IconSelector';
import { getIconSvg } from '@shared/constants/categoryIcons';

/**
 * Each level is created on its own and linked to the level above it:
 *   header      -> stands alone, represented by an icon
 *   category    -> picks its header, needs an image
 *   subcategory -> picks its header (to narrow the list) and then its main category
 */
const LEVELS = [
  {
    key: 'header',
    type: 'header',
    label: 'Header Category',
    hint: 'Top level of the catalog',
    icon: FolderOpen,
  },
  {
    key: 'category',
    type: 'category',
    label: 'Main Category',
    hint: 'Sits inside a header',
    icon: Folder,
  },
  {
    key: 'subcategory',
    type: 'subcategory',
    label: 'Subcategory',
    hint: 'Sits inside a main category',
    icon: Tag,
  },
];

const emptyForm = { name: '', description: '' };

export default function CategoryHierarchyModal({
  isOpen,
  onClose,
  onSuccess,
  categoryTree = [],
  defaultLevel = 'header',
  defaultHeaderId = '',
  defaultParentId = '',
}) {
  const [level, setLevel] = useState(defaultLevel);
  const [form, setForm] = useState(emptyForm);
  const [headerId, setHeaderId] = useState(defaultHeaderId);
  const [parentId, setParentId] = useState(defaultParentId);
  const [iconId, setIconId] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [isIconSelectorOpen, setIsIconSelectorOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const fileRef = useRef(null);

  // Header list + the main categories under the chosen header, straight from the
  // tree the page already loaded (no extra network calls for the dropdowns).
  const headers = useMemo(
    () => (categoryTree || []).filter((item) => (item.type || 'header') === 'header'),
    [categoryTree],
  );

  const mainsUnderHeader = useMemo(() => {
    if (!headerId) return [];
    const header = headers.find((item) => String(item._id || item.id) === String(headerId));
    return (header?.children || []).filter((item) => (item.type || '') === 'category');
  }, [headers, headerId]);

  const resetState = () => {
    setForm(emptyForm);
    setIconId('');
    setImageFile(null);
    setPreviewUrl(null);
    setIsIconSelectorOpen(false);
  };

  // Re-seed whenever the modal is opened, so "add inside this header" opens
  // pre-filled and a plain open starts clean.
  useEffect(() => {
    if (!isOpen) return;
    setLevel(defaultLevel);
    setHeaderId(defaultHeaderId ? String(defaultHeaderId) : '');
    setParentId(defaultParentId ? String(defaultParentId) : '');
    resetState();
  }, [isOpen, defaultLevel, defaultHeaderId, defaultParentId]);

  // Dropping the header selection invalidates any main category chosen under it.
  useEffect(() => {
    if (!parentId) return;
    if (!mainsUnderHeader.some((item) => String(item._id || item.id) === String(parentId))) {
      setParentId('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [headerId]);

  if (!isOpen) return null;

  const handleLevelChange = (nextLevel) => {
    setLevel(nextLevel);
    resetState();
    if (nextLevel === 'header') {
      setHeaderId('');
      setParentId('');
    } else if (nextLevel === 'category') {
      setParentId('');
    }
  };

  const handleImageChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  // Mirrors the backend contract exactly, so the button state and the API agree.
  const validationError = (() => {
    if (!form.name.trim()) return 'Name is required';
    if (level === 'header') return iconId ? null : 'Icon is required';
    if (!headerId) return 'Select a header category';
    if (level === 'subcategory' && !parentId) return 'Select a main category';
    return imageFile ? null : 'Image is required';
  })();

  const handleSave = async () => {
    if (validationError) {
      toast.error(validationError);
      return;
    }

    setIsSaving(true);
    try {
      const payload = new FormData();
      payload.append('name', form.name.trim());
      payload.append('description', form.description.trim());
      payload.append('type', level);
      payload.append('status', 'active');

      if (level === 'header') {
        payload.append('iconId', iconId);
      } else {
        payload.append('parentId', level === 'category' ? headerId : parentId);
        payload.append('image', imageFile);
      }

      const res = await adminApi.createCategory(payload);
      if (res.data?.success) {
        const created = LEVELS.find((item) => item.type === level)?.label || 'Category';
        toast.success(`${created} created successfully`);
        resetState();
        onSuccess?.();
        onClose();
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to create category');
    } finally {
      setIsSaving(false);
    }
  };

  const activeLevel = LEVELS.find((item) => item.type === level) || LEVELS[0];

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        />

        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
        >
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <activeLevel.icon className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-800">Create Category</h2>
                <p className="text-sm text-gray-500">
                  Pick a level and link it to the category above it
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400 hover:text-gray-600"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div className="p-6 overflow-y-auto flex-1 space-y-6 custom-scrollbar">
            {/* Level picker */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                What are you creating?
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {LEVELS.map((item) => {
                  const isActive = item.type === level;
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => handleLevelChange(item.type)}
                      className={`text-left p-3 rounded-xl border-2 transition-all ${
                        isActive
                          ? 'border-primary bg-primary/5 shadow-sm'
                          : 'border-gray-100 hover:border-gray-200 bg-white'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <item.icon
                          className={`w-4 h-4 ${isActive ? 'text-primary' : 'text-gray-400'}`}
                        />
                        <span
                          className={`text-sm font-bold ${
                            isActive ? 'text-primary' : 'text-gray-700'
                          }`}
                        >
                          {item.label}
                        </span>
                      </div>
                      <p className="mt-1 text-[11px] text-gray-500">{item.hint}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Parent selection */}
            {level !== 'header' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-50 p-4 rounded-xl border border-gray-100">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Header Category <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={headerId}
                    onChange={(e) => setHeaderId(e.target.value)}
                    className="w-full px-4 py-2 border rounded-lg bg-white focus:ring-2 focus:ring-primary/20 outline-none"
                  >
                    <option value="">Select header category</option>
                    {headers.map((header) => (
                      <option key={header._id || header.id} value={header._id || header.id}>
                        {header.name}
                      </option>
                    ))}
                  </select>
                  {headers.length === 0 && (
                    <p className="mt-1 text-[11px] text-amber-600">
                      No header categories yet — create one first.
                    </p>
                  )}
                </div>

                {level === 'subcategory' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Main Category <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={parentId}
                      onChange={(e) => setParentId(e.target.value)}
                      disabled={!headerId}
                      className="w-full px-4 py-2 border rounded-lg bg-white focus:ring-2 focus:ring-primary/20 outline-none disabled:bg-gray-100 disabled:text-gray-400"
                    >
                      <option value="">
                        {headerId ? 'Select main category' : 'Select a header first'}
                      </option>
                      {mainsUnderHeader.map((main) => (
                        <option key={main._id || main.id} value={main._id || main.id}>
                          {main.name}
                        </option>
                      ))}
                    </select>
                    {headerId && mainsUnderHeader.length === 0 && (
                      <p className="mt-1 text-[11px] text-amber-600">
                        This header has no main categories yet.
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Name + description */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary/20 outline-none"
                  placeholder={`Enter ${activeLevel.label.toLowerCase()} name`}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description (Optional)
                </label>
                <input
                  type="text"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary/20 outline-none"
                  placeholder="Brief description"
                />
              </div>
            </div>

            {/* Icon (header) or image (main / sub) */}
            {level === 'header' ? (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Icon <span className="text-red-500">*</span>
                </label>
                <div className="flex items-center gap-4">
                  <div className="w-24 h-24 rounded-xl border-2 border-dashed border-gray-200 flex items-center justify-center bg-white">
                    {iconId && getIconSvg(iconId) ? (
                      <div
                        className="w-10 h-10 text-primary"
                        dangerouslySetInnerHTML={{ __html: getIconSvg(iconId) }}
                      />
                    ) : (
                      <span className="text-[10px] font-medium text-gray-400">No icon</span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsIconSelectorOpen(true)}
                    className="px-4 py-2 text-sm font-semibold rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors"
                  >
                    {iconId ? 'Change icon' : 'Choose icon'}
                  </button>
                </div>
                <p className="mt-2 text-[11px] text-gray-500">
                  Header categories are shown with an icon, not an image.
                </p>
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Image <span className="text-red-500">*</span>
                </label>
                <div
                  onClick={() => fileRef.current?.click()}
                  className="w-24 h-24 rounded-xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center cursor-pointer hover:bg-gray-50 hover:border-primary/30 transition-all bg-white relative overflow-hidden group"
                >
                  {previewUrl ? (
                    <>
                      <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <Upload className="w-6 h-6 text-white" />
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center mb-2">
                        <ImageIcon className="w-4 h-4 text-gray-400" />
                      </div>
                      <span className="text-[10px] font-medium text-gray-500">Upload</span>
                    </>
                  )}
                  <input
                    type="file"
                    ref={fileRef}
                    onChange={handleImageChange}
                    accept="image/*"
                    className="hidden"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex items-center justify-between gap-3 shrink-0">
            <p className="text-xs text-gray-500">
              {validationError ? validationError : 'Ready to create'}
            </p>
            <div className="flex items-center gap-3">
              <button
                onClick={onClose}
                className="px-6 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-200 bg-gray-100 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving || !!validationError}
                className="px-6 py-2.5 text-sm font-medium text-white bg-primary hover:bg-primary-hover rounded-xl shadow-sm hover:shadow transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isSaving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    Create {activeLevel.label}
                  </>
                )}
              </button>
            </div>
          </div>
        </motion.div>

        {isIconSelectorOpen && (
          <IconSelector
            selectedIcon={iconId}
            onSelect={(nextIconId) => {
              setIconId(nextIconId);
              setIsIconSelectorOpen(false);
            }}
            onClose={() => setIsIconSelectorOpen(false)}
          />
        )}
      </div>
    </AnimatePresence>
  );
}
