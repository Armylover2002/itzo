import React, { useMemo } from "react";
import { motion } from "framer-motion";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import ProductCard from "../shared/ProductCard";
import { useNavigate } from "react-router-dom";

const MOCK_PRODUCTS = [
  {
    id: "lowest_price_1",
    _id: "lowest_price_1",
    name: "yufyfhgvnbvnbvnbv...",
    image: "https://images.unsplash.com/photo-1627308595229-7830f5c90683?auto=format&fit=crop&q=80&w=400&fm=webp",
    price: 495,
    originalPrice: 500,
    discount: "1% OFF",
    weight: "1 unit",
    deliveryTime: "8-15 MINS",
    stock: 100,
  },
  {
    id: "lowest_price_2",
    _id: "lowest_price_2",
    name: "basmati",
    image: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&q=80&w=400&fm=webp",
    price: 450,
    originalPrice: null,
    weight: "packet",
    deliveryTime: "8-15 MINS",
    stock: 100,
  },
  {
    id: "lowest_price_3",
    _id: "lowest_price_3",
    name: "Allu",
    image: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&q=80&w=400&fm=webp",
    price: 400,
    originalPrice: 600,
    discount: "33% OFF",
    weight: "1 unit",
    deliveryTime: "8-15 MINS",
    stock: 100,
  },
];

const LowestPriceEverSection = ({ products = [] }) => {
  const navigate = useNavigate();

  // Try to find matching products from the actual live products
  const displayProducts = useMemo(() => {
    const findLiveProduct = (nameQuery) => {
      return products.find(p => p.name?.toLowerCase().includes(nameQuery.toLowerCase()));
    };

    const p1 = findLiveProduct("yufyfhg") || MOCK_PRODUCTS[0];
    const p2 = findLiveProduct("basmati") || MOCK_PRODUCTS[1];
    const p3 = findLiveProduct("allu") || MOCK_PRODUCTS[2];

    return [p1, p2, p3];
  }, [products]);

  return (
    <div className="w-full bg-[#F0F9FF] pt-6 pb-8 md:mt-2 shadow-[0_4px_20px_rgba(0,0,0,0.03)] border-b border-[#E2E8F0]">
      <div className="px-4 md:px-8 lg:px-[50px] mx-auto flex items-end justify-between mb-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-[20px] md:text-[28px] font-[900] text-[#0A2351] tracking-tighter leading-none">
            LOWEST PRICE EVER
          </h2>
          <p className="text-[9px] md:text-xs font-bold text-[#1C3A7A]/80 tracking-[0.05em]">
            <span className="text-[#FE5502] mr-1">•</span> UNBEATABLE SAVINGS <span className="text-[#FE5502] mx-1">•</span> UPDATED HOURLY
          </p>
        </div>
        <button 
          className="flex items-center gap-0.5 bg-white text-[#0A2351] px-3 md:px-4 py-1.5 md:py-2 rounded-full font-bold text-xs shadow-sm hover:shadow-md transition-shadow ring-1 ring-slate-100"
          onClick={() => { /* Placeholder for See all */ }}
        >
          See all
          <ChevronRight size={14} className="mt-[1px]" />
        </button>
      </div>

      <div className="px-4 md:px-8 lg:px-[50px] mx-auto">
        <div className="flex overflow-x-auto gap-3 md:gap-4 pb-2 no-scrollbar snap-x snap-mandatory -mx-4 px-4 md:mx-0 md:px-0">
          {displayProducts.map((product, idx) => (
            <motion.div
              key={product.id || product._id || `lp-prod-${idx}`}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: idx * 0.1 }}
              className="w-[145px] md:w-[165px] lg:w-[185px] flex-shrink-0 snap-start"
            >
              <ProductCard
                product={product}
                badge={product.discount}
                className="shadow-[0_8px_20px_-8px_rgba(0,0,0,0.08)] border-transparent"
                compact
              />
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default React.memo(LowestPriceEverSection);
