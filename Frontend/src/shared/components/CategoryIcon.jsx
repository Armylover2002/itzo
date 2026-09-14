import React from 'react';
import { getIconSvg } from '../constants/categoryIcons';
import { Image } from 'lucide-react';

const CategoryIcon = ({ iconId, imageUrl, alt = 'Category', className = 'w-6 h-6', fallbackClassName = 'w-5 h-5' }) => {
  // Priority: SVG icon > Image URL > Fallback
  if (iconId && getIconSvg(iconId)) {
    return (
      <div 
        className={className}
        dangerouslySetInnerHTML={{ __html: getIconSvg(iconId) }}
      />
    );
  }

  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt={alt}
        className={`${className} object-cover`}
      />
    );
  }

  return <Image className={`${fallbackClassName} text-gray-400`} />;
};

export default CategoryIcon;
