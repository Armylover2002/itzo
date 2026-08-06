import React, { useState } from 'react';

const LazyImage = ({ src, alt = '', className = '', ...rest }) => {
  const [loaded, setLoaded] = useState(false);
  const [errorCount, setErrorCount] = useState(0);

  // Determine if src is an array of fallbacks or a single string
  const sources = Array.isArray(src) ? src : [src];
  
  // Reset state when src changes
  React.useEffect(() => {
    setLoaded(false);
    setErrorCount(0);
  }, [src]);

  const currentSrc = errorCount < sources.length ? sources[errorCount] : "/itzo-quick-logo.png";

  return (
    <img
      src={currentSrc || "/itzo-quick-logo.png"}
      alt={alt}
      loading="lazy"
      onLoad={() => setLoaded(true)}
      onError={() => {
        if (errorCount < sources.length) {
          setErrorCount(prev => prev + 1);
        }
      }}
      className={`${className} ${loaded ? 'opacity-100' : 'opacity-0'} transition-opacity duration-300`}
      {...rest}
    />
  );
};

export default LazyImage;

