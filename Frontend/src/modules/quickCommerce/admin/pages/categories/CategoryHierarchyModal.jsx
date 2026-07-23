import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Upload, Image as ImageIcon, Sparkles, FolderOpen, Folder, Tag } from 'lucide-react';
import { toast } from 'sonner';
import { adminApi } from '../../services/adminApi';

export default function CategoryHierarchyModal({ isOpen, onClose, onSuccess }) {
  const [isSaving, setIsSaving] = useState(false);
  
  const [headerData, setHeaderData] = useState({ name: '', slug: '', description: '' });
  const [level2Data, setLevel2Data] = useState({ name: '', slug: '', description: '' });
  const [subData, setSubData] = useState({ name: '', slug: '', description: '' });

  const [headerImage, setHeaderImage] = useState(null);
  const [level2Image, setLevel2Image] = useState(null);
  const [subImage, setSubImage] = useState(null);

  const [headerPreview, setHeaderPreview] = useState(null);
  const [level2Preview, setLevel2Preview] = useState(null);
  const [subPreview, setSubPreview] = useState(null);

  const headerFileRef = useRef(null);
  const level2FileRef = useRef(null);
  const subFileRef = useRef(null);

  if (!isOpen) return null;

  const handleImageChange = (e, setFile, setPreview) => {
    const file = e.target.files[0];
    if (file) {
      setFile(file);
      setPreview(URL.createObjectURL(file));
    }
  };

  const handleSave = async () => {
    if (!headerData.name || !level2Data.name || !subData.name) {
      toast.error('Name is required for all three category levels');
      return;
    }

    setIsSaving(true);
    try {
      const formData = new FormData();
      formData.append('headerData', JSON.stringify(headerData));
      formData.append('level2Data', JSON.stringify(level2Data));
      formData.append('subData', JSON.stringify(subData));

      if (headerImage) formData.append('headerImage', headerImage);
      if (level2Image) formData.append('level2Image', level2Image);
      if (subImage) formData.append('subImage', subImage);

      const res = await adminApi.createCategoryHierarchy(formData);
      if (res.data?.success) {
        toast.success('Category hierarchy created successfully!');
        
        // Reset state
        setHeaderData({ name: '', slug: '', description: '' });
        setLevel2Data({ name: '', slug: '', description: '' });
        setSubData({ name: '', slug: '', description: '' });
        setHeaderImage(null); setLevel2Image(null); setSubImage(null);
        setHeaderPreview(null); setLevel2Preview(null); setSubPreview(null);
        
        onSuccess();
        onClose();
      }
    } catch (error) {
      console.error('Failed to create hierarchy', error);
      toast.error(error.response?.data?.message || 'Failed to create category hierarchy');
    } finally {
      setIsSaving(false);
    }
  };

  const renderSection = (title, icon, data, setData, previewUrl, fileRef, setFile, setPreview) => (
    <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 space-y-4">
      <div className="flex items-center gap-2 text-gray-700 font-bold mb-2">
        {icon}
        <span>{title} <span className="text-red-500">*</span></span>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Name <span className="text-red-500">*</span></label>
          <input
            type="text"
            value={data.name}
            onChange={(e) => setData({ ...data, name: e.target.value })}
            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary/20 outline-none"
            placeholder={`Enter ${title.toLowerCase()} name`}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Description (Optional)</label>
          <input
            type="text"
            value={data.description}
            onChange={(e) => setData({ ...data, description: e.target.value })}
            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary/20 outline-none"
            placeholder="Brief description"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Image (Optional)</label>
        <div className="flex items-start gap-4">
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
              onChange={(e) => handleImageChange(e, setFile, setPreview)}
              accept="image/*"
              className="hidden"
            />
          </div>
        </div>
      </div>
    </div>
  );

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
          className="relative bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
        >
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-800">Create Category Hierarchy</h2>
                <p className="text-sm text-gray-500">Add a Header, Level 2, and Subcategory atomically</p>
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
            {renderSection("1. Header Category", <FolderOpen className="w-5 h-5 text-indigo-500" />, headerData, setHeaderData, headerPreview, headerFileRef, setHeaderImage, setHeaderPreview)}
            {renderSection("2. Level 2 Category", <Folder className="w-5 h-5 text-purple-500" />, level2Data, setLevel2Data, level2Preview, level2FileRef, setLevel2Image, setLevel2Preview)}
            {renderSection("3. Subcategory", <Tag className="w-5 h-5 text-emerald-500" />, subData, setSubData, subPreview, subFileRef, setSubImage, setSubPreview)}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex items-center justify-end gap-3 shrink-0">
            <button
              onClick={onClose}
              className="px-6 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-200 bg-gray-100 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving || !headerData.name || !level2Data.name || !subData.name}
              className="px-6 py-2.5 text-sm font-medium text-white bg-primary hover:bg-primary-hover rounded-xl shadow-sm hover:shadow transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isSaving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Create Complete Hierarchy
                </>
              )}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
