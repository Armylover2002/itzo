import React, { createContext, useContext, useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

const CartAnimationContext = createContext({
  animateAddToCart: () => {},
  animateRemoveFromCart: () => {},
});

export const useCartAnimation = () => useContext(CartAnimationContext);

export const CartAnimationProvider = ({ children }) => {
  const [flyingItems, setFlyingItems] = useState([]);
  const [droppingItems, setDroppingItems] = useState([]);

  const animateAddToCart = (rect, imageSrc) => {
    const id = Date.now() + Math.random();
    setFlyingItems((prev) => [...prev, { id, rect, imageSrc }]);

    // Remove item after animation
    setTimeout(() => {
      setFlyingItems((prev) => prev.filter((item) => item.id !== id));
    }, 1600); // Buffer for 1.5s animation
  };

  const animateRemoveFromCart = (imageSrc) => {
    const id = Date.now() + Math.random();

    // Calculate start position immediately to handle unmounting
    const miniCart = document.getElementById("mini-cart-target");
    let startPos;

    if (miniCart) {
      const rect = miniCart.getBoundingClientRect();
      startPos = {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      };
    } else {
      // Fallback
      const isMd = window.innerWidth >= 768;
      const bottomOffset = isMd ? 96 : 74;
      startPos = {
        x: window.innerWidth / 2,
        y: window.innerHeight - bottomOffset - 25,
      };
    }

    setDroppingItems((prev) => [...prev, { id, imageSrc, startPos }]);

    // Remove item after animation
    setTimeout(() => {
      setDroppingItems((prev) => prev.filter((item) => item.id !== id));
    }, 600);
  };

  return (
    <CartAnimationContext.Provider
      value={{ animateAddToCart, animateRemoveFromCart }}>
      {children}
      <FlyingItemsOverlay items={flyingItems} />
      <DroppingItemsOverlay items={droppingItems} />
    </CartAnimationContext.Provider>
  );
};

const FlyingItemsOverlay = ({ items }) => {
  return (
    <div className="fixed inset-0 pointer-events-none z-600 overflow-hidden">
      <AnimatePresence>
        {items.map((item) => (
          <FlyingItem key={item.id} item={item} />
        ))}
      </AnimatePresence>
    </div>
  );
};

const FlyingItem = ({ item }) => {
  const [target, setTarget] = useState(null);

  useEffect(() => {
    // Function to find target
    const findTarget = () => {
      const miniCart = document.getElementById("mini-cart-target");
      const headerCart = document.getElementById("header-cart-icon");

      if (miniCart) {
        const rect = miniCart.getBoundingClientRect();
        return {
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2,
        };
      } else if (headerCart) {
        const rect = headerCart.getBoundingClientRect();
        return {
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2,
        };
      } else {
        // Fallback
        const isMd = window.innerWidth >= 768;
        const bottomOffset = isMd ? 96 : 74;
        return {
          x: window.innerWidth / 2,
          y: window.innerHeight - bottomOffset - 25,
        };
      }
    };

    // Initial calculation
    setTarget(findTarget());

    // Update target after a short delay to account for entrance animations
    const timer = setTimeout(() => {
      setTarget(findTarget());
    }, 100);

    return () => clearTimeout(timer);
  }, []);

  if (!target) return null;

  const initialSize = 48; // Start small
  const startX = item.rect.left + item.rect.width / 2 - initialSize / 2;
  const startY = item.rect.top + item.rect.height / 2 - initialSize / 2;

  return (
    <motion.img
      src={item.imageSrc}
      initial={{
        position: "fixed",
        left: startX,
        top: startY,
        width: initialSize,
        height: initialSize,
        opacity: 0,
        scale: 0.5,
        borderRadius: "50%",
        boxShadow:
          "inset 0 4px 8px rgba(255, 255, 255, 0.8), inset 0 -4px 8px rgba(0, 0, 0, 0.1), 0 8px 20px rgba(0, 0, 0, 0.3)",
      }}
      animate={{
        left: target.x - initialSize / 2,
        top: target.y - initialSize / 2,
        width: initialSize,
        height: initialSize,
        opacity: [0, 1, 1, 0], // Fade in, stay visible, fade out
        scale: [0.5, 1.2, 1, 0.2], // Pop up, settle, then shrink into cart
        borderRadius: "50%",
      }}
      transition={{
        left: { type: "spring", stiffness: 120, damping: 20 },
        top: { type: "spring", stiffness: 120, damping: 20 },
        opacity: { duration: 1.2, times: [0, 0.2, 0.8, 1] },
        scale: { duration: 1.2, times: [0, 0.2, 0.8, 1] },
      }}
      className="object-cover bg-white pointer-events-none z-650"
    />
  );
};

const DroppingItemsOverlay = ({ items }) => {
  return (
    <div className="fixed inset-0 pointer-events-none z-600 overflow-hidden">
      <AnimatePresence>
        {items.map((item) => (
          <DroppingItem key={item.id} item={item} />
        ))}
      </AnimatePresence>
    </div>
  );
};

const DroppingItem = ({ item }) => {
  const { startPos } = item;
  const size = 40;

  if (!startPos) return null;

  return (
    <motion.img
      src={item.imageSrc}
      initial={{
        position: "fixed",
        left: startPos.x - size / 2,
        top: startPos.y - size / 2,
        width: size,
        height: size,
        opacity: 0,
        scale: 0.5,
        borderRadius: "50%",
        boxShadow:
          "inset 0 4px 8px rgba(255, 255, 255, 0.8), inset 0 -4px 8px rgba(0, 0, 0, 0.1), 0 8px 20px rgba(0, 0, 0, 0.3)",
      }}
      animate={{
        y: -100, // Float up
        x: Math.random() * 100 - 50, // Random drift
        opacity: [0, 1, 0],
        scale: [0.5, 1.2, 0.5],
        rotate: 15,
      }}
      transition={{
        duration: 0.8,
        ease: "easeOut",
      }}
      className="object-cover bg-white pointer-events-none z-650"
    />
  );
};
