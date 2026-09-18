import React, { useState, useRef, useEffect } from 'react';
import { motion, useAnimation } from 'framer-motion';
import { ChevronRight, Check } from 'lucide-react';

const SlideButton = React.memo(function SlideButton({ text, successText, onComplete, icon: Icon, color = "bg-orange-500" }) {
  const [isComplete, setIsComplete] = useState(false);
  const containerRef = useRef(null);
  const [maxWidth, setMaxWidth] = useState(0);
  const controls = useAnimation();

  useEffect(() => {
    if (containerRef.current) {
      // Thumb width is 40px (10 * 4), padding is ~4px. So max drag is container width - 48px
      setMaxWidth(containerRef.current.offsetWidth - 48);
    }
  }, []);

  const handleDragEnd = async (event, info) => {
    if (info.offset.x >= maxWidth * 0.75) {
      setIsComplete(true);
      await controls.start({ x: maxWidth, transition: { duration: 0.2 } });
      if (onComplete) onComplete();
    } else {
      controls.start({ x: 0, transition: { type: "spring", stiffness: 300, damping: 20 } });
    }
  };

  return (
    <div 
      ref={containerRef}
      className="relative w-full h-12 bg-white border border-gray-200 rounded-full overflow-hidden flex items-center shadow-sm select-none"
    >
      <div 
        className={`absolute left-0 top-0 bottom-0 ${color} transition-all duration-300 ease-out`} 
        style={{ width: isComplete ? '100%' : '0%', opacity: isComplete ? 1 : 0.1 }} 
      />
      
      <span className={`absolute w-full text-center font-semibold text-sm z-0 pointer-events-none transition-colors duration-300 ${isComplete ? 'text-white drop-shadow-sm' : 'text-gray-500'}`}>
        {isComplete ? (successText || "Completed") : text}
      </span>
      
      {!isComplete ? (
        <motion.div
          drag="x"
          dragConstraints={{ left: 0, right: maxWidth }}
          dragElastic={0.05}
          dragMomentum={false}
          onDragEnd={handleDragEnd}
          animate={controls}
          className={`absolute left-1 w-10 h-10 ${color} rounded-full flex items-center justify-center cursor-grab active:cursor-grabbing z-10 shadow-md`}
        >
          {Icon ? <Icon className="text-white w-5 h-5" /> : <ChevronRight className="text-white w-5 h-5" />}
        </motion.div>
      ) : (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="absolute right-1 w-10 h-10 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center z-10"
        >
          <Check className="text-white w-5 h-5" />
        </motion.div>
      )}
    </div>
  );
});

export default SlideButton;
