import React, { useState } from 'react';

const LazyImage = ({ src, alt = '', className = '', ...rest }) => {
  const [loaded, setLoaded] = useState(false);

  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      onLoad={() => setLoaded(true)}
      className={`${className} ${loaded ? 'opacity-100' : 'opacity-0'} transition-opacity duration-300`}
      {...rest}
    />
  );
};

export default LazyImage;

