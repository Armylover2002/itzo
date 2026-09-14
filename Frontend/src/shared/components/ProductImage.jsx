import React, { useEffect, useState } from 'react';
import {
  DEFAULT_PRODUCT_IMAGE,
  handleProductImageError,
  resolveProductImageSrc,
} from '@/shared/utils/productImage';

/**
 * Product thumbnail with default image when missing or broken.
 * Pass `product` (object) or `src` (string).
 */
const ProductImage = ({
  product,
  src,
  alt = 'Product',
  className = '',
  loading = 'lazy',
  ...props
}) => {
  const [imageSrc, setImageSrc] = useState(() =>
    product ? resolveProductImageSrc(product) : resolveProductImageSrc(src),
  );

  useEffect(() => {
    setImageSrc(product ? resolveProductImageSrc(product) : resolveProductImageSrc(src));
  }, [product, src]);

  const onError = (event) => {
    handleProductImageError(event);
    setImageSrc(DEFAULT_PRODUCT_IMAGE);
  };

  return (
    <img
      {...props}
      src={imageSrc}
      alt={alt}
      className={className}
      loading={loading}
      onError={onError}
    />
  );
};

export default ProductImage;
