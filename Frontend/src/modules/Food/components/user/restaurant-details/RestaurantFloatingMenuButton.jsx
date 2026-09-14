import { useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@food/components/ui/button";
import { motion } from "framer-motion";
import { Utensils } from "lucide-react";

export default function RestaurantFloatingMenuButton({ hidden, onOpen }) {
  const [isTurning, setIsTurning] = useState(false);

  if (hidden) return null;

  const handleClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    onOpen(e);
  };

  const buttonContent = (
    <button
      className="fixed bottom-[80px] right-6 z-[100] bg-[#0a0a0a] hover:bg-black dark:bg-[#0a0a0a] dark:hover:bg-black text-white flex flex-col items-center justify-center gap-1 shadow-[0_10px_25px_rgba(0,0,0,0.3)] h-[70px] w-[70px] rounded-full p-0 transform transition-all duration-200 hover:scale-105 active:scale-95 group border-none cursor-pointer outline-none pointer-events-auto"
      onClick={handleClick}
    >
      <Utensils className="h-[22px] w-[22px] text-white group-hover:-translate-y-0.5 transition-transform stroke-[2.5]" />
      <span className="text-[11px] font-bold tracking-wider uppercase mt-[2px]">MENU</span>
    </button>
  );

  if (typeof window === "undefined") return null;
  return createPortal(buttonContent, document.body);
}
