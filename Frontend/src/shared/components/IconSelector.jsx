import React, { useState } from 'react';
import { categoryIcons } from '../constants/categoryIcons';
import { CATEGORY_ICON_COMPONENTS } from '../constants/categoryIconComponents';
import { Search, X } from 'lucide-react';
import { motion } from 'framer-motion';

const IconSelector = ({ selectedIcon, onSelect, onClose }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const iconComponents = CATEGORY_ICON_COMPONENTS;

  const filteredIcons = categoryIcons.filter(icon =>
    icon.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="p-6 border-b border-gray-100 flex justify-between items-center shrink-0">
          <h2 className="text-lg font-bold text-gray-900">Select Category Icon</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-gray-100 shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search icons..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            />
          </div>
        </div>

        {/* Icon Grid */}
        <div className="p-6 overflow-y-auto flex-1 min-h-0">
          <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-3">
            {filteredIcons.map((icon) => (
              <button
                key={icon.id}
                onClick={() => onSelect(icon.id)}
                className={`
                  flex flex-col items-center justify-center p-4 rounded-lg border-2 transition-all
                  hover:border-indigo-500 hover:bg-indigo-50 group
                  ${selectedIcon === icon.id 
                    ? 'border-indigo-600 bg-indigo-50' 
                    : 'border-gray-200 bg-white'
                  }
                `}
                title={icon.name}>
                <div
                  className={`w-8 h-8 flex items-center justify-center transition-colors ${
                    selectedIcon === icon.id
                      ? 'text-indigo-600'
                      : 'text-gray-600 group-hover:text-indigo-600'
                  }`}
                >
                  {iconComponents[icon.id] ? (
                    (() => {
                      const IconComp = iconComponents[icon.id];
                      return <IconComp fontSize="medium" />;
                    })()
                  ) : (
                    <div
                      className="w-6 h-6"
                      dangerouslySetInnerHTML={{ __html: icon.svg }}
                    />
                  )}
                </div>
                <span className="text-xs text-gray-500 mt-2 text-center line-clamp-1">
                  {icon.name}
                </span>
              </button>
            ))}
          </div>

          {filteredIcons.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              No icons found matching "{searchTerm}"
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium transition-colors">
            Done
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default IconSelector;
