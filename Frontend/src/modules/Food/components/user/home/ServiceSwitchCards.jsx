import React from "react";
import { UtensilsCrossed, ShoppingBasket, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

const SERVICES = [
  {
    id: "food",
    title: "FOOD",
    subtitle: "FROM RESTAURANTS",
    icon: UtensilsCrossed,
    image: "/super-app/food.png",
    alt: "Food Delivery",
  },
  {
    id: "quick",
    title: "QUICK",
    subtitle: "INSTANT GROCERY",
    icon: ShoppingBasket,
    image: "/super-app/grocery.png",
    alt: "Instant Grocery",
  },
];

export default function ServiceSwitchCards({
  activeTab = "food",
  onTabChange,
  className = "",
}) {
  return (
    <section
      aria-label="Service Selector"
      className={cn("w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 sm:py-4", className)}
    >
      <div className="grid grid-cols-2 gap-3 sm:gap-5 max-w-3xl mx-auto">
        {SERVICES.map((service) => {
          const isActive = activeTab === service.id;
          const Icon = service.icon;

          return (
            <div
              key={service.id}
              role="button"
              tabIndex={0}
              onClick={() => onTabChange?.(service.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onTabChange?.(service.id);
                }
              }}
              className={cn(
                "group relative flex items-center justify-between overflow-hidden",
                "h-[110px] sm:h-[130px] md:h-[140px] px-3.5 py-3 sm:px-5 sm:py-4",
                "rounded-2xl sm:rounded-3xl cursor-pointer select-none transition-all duration-200",
                "active:scale-[0.98]",
                isActive
                  ? "bg-gradient-to-br from-orange-50/80 via-white to-white dark:from-orange-950/20 dark:via-neutral-900 dark:to-neutral-900 border-2 border-[#FE5502]/80 shadow-md shadow-orange-500/10 ring-2 ring-[#FE5502]/20"
                  : "bg-white dark:bg-neutral-900 border border-gray-200/80 dark:border-neutral-800 shadow-sm hover:shadow-md hover:border-gray-300 dark:hover:border-neutral-700"
              )}
            >
              {/* Left Details */}
              <div className="flex flex-col justify-between h-full min-w-0 pr-1 z-10">
                {/* Header: Icon + Title */}
                <div>
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-[#FE5502] flex items-center justify-center text-white shrink-0 shadow-xs">
                      <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" strokeWidth={2.5} />
                    </div>
                    <h3 className="text-sm sm:text-base md:text-lg font-black text-gray-900 dark:text-white tracking-tight leading-none uppercase">
                      {service.title}
                    </h3>
                  </div>
                  <p className="text-[8.5px] sm:text-[10px] md:text-[11px] font-bold text-gray-400 dark:text-gray-400 tracking-wider uppercase mt-1 sm:mt-1.5 whitespace-nowrap pl-0.5">
                    {service.subtitle}
                  </p>
                </div>

                {/* Bottom Orange Arrow Circle Button */}
                <div className="mt-2">
                  <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-[#FE5502] text-white flex items-center justify-center shadow-xs group-hover:scale-110 group-hover:translate-x-0.5 transition-all duration-200">
                    <ArrowRight className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-white" strokeWidth={2.6} />
                  </div>
                </div>
              </div>

              {/* Right 3D Illustration */}
              <div className="shrink-0 flex items-center justify-center z-10 self-center sm:self-end">
                <img
                  src={service.image}
                  alt={service.alt}
                  className="h-16 sm:h-20 md:h-24 w-auto object-contain drop-shadow-sm pointer-events-none group-hover:scale-105 transition-transform duration-300"
                  loading="lazy"
                />
              </div>

              {/* Subtle active background glow */}
              {isActive && (
                <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-[#FE5502]/10 rounded-full blur-xl pointer-events-none" />
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
