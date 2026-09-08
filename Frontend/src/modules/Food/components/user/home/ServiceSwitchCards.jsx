import React from "react";
import { UtensilsCrossed, ShoppingBasket, Store, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

const SERVICES = [
  {
    id: "food",
    title: "FOOD",
    subtitle: "FROM RESTAURANTS",
    icon: UtensilsCrossed,
    image: "/super-app/food.png",
    alt: "Food Delivery",
    activeBg: "bg-gradient-to-br from-orange-100 via-amber-50/80 to-orange-50/50 dark:from-orange-950/40 dark:via-neutral-900 dark:to-neutral-900 border-2 border-[#FE5502] shadow-md shadow-orange-500/15 ring-2 ring-[#FE5502]/20",
    inactiveBg: "bg-gradient-to-br from-orange-50/90 via-amber-50/50 to-white dark:from-neutral-900 dark:to-neutral-900 border border-orange-200/80 dark:border-neutral-800 hover:border-orange-300 hover:shadow-md",
    iconBg: "bg-[#FE5502]",
    arrowBg: "bg-[#FE5502]",
    glowBg: "bg-[#FE5502]/15",
  },
  {
    id: "streetfood",
    title: "STREET FOOD",
    subtitle: "LOCAL VENDORS",
    icon: Store,
    image: "/super-app/streetfood.png",
    alt: "Street Food",
  },
  {
    id: "quick",
    title: "QUICK",
    subtitle: "INSTANT GROCERY",
    icon: ShoppingBasket,
    image: "/super-app/grocery.png",
    alt: "Instant Grocery",
    activeBg: "bg-gradient-to-br from-emerald-100 via-teal-50/80 to-emerald-50/50 dark:from-emerald-950/40 dark:via-neutral-900 dark:to-neutral-900 border-2 border-emerald-500 shadow-md shadow-emerald-500/15 ring-2 ring-emerald-500/20",
    inactiveBg: "bg-gradient-to-br from-emerald-50/90 via-teal-50/50 to-white dark:from-neutral-900 dark:to-neutral-900 border border-emerald-200/80 dark:border-neutral-800 hover:border-emerald-300 hover:shadow-md",
    iconBg: "bg-emerald-600",
    arrowBg: "bg-emerald-600",
    glowBg: "bg-emerald-500/15",
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
      className={cn("w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 sm:py-4 md:py-6", className)}
    >
      <div className="grid grid-cols-3 gap-3 sm:gap-5 max-w-4xl mx-auto">
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
                "h-[110px] sm:h-[130px] md:h-[200px] px-3.5 py-3 sm:px-5 sm:py-4 md:px-8 md:py-6",
                "rounded-2xl sm:rounded-3xl cursor-pointer select-none transition-all duration-200",
                "active:scale-[0.98]",
                isActive ? service.activeBg : service.inactiveBg
              )}
            >
              {/* Left Details */}
              <div className="flex flex-col justify-between h-full min-w-0 pr-1 z-10">
                {/* Header: Icon + Title */}
                <div>
                  <div className="flex items-center gap-2 md:gap-3">
                    <div className={cn("w-6 h-6 sm:w-7 sm:h-7 md:w-10 md:h-10 rounded-full flex items-center justify-center text-white shrink-0 shadow-xs", service.iconBg)}>
                      <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4 md:w-5 md:h-5 text-white" strokeWidth={2.5} />
                    </div>
                    <h3 className="text-[11px] sm:text-sm md:text-base font-black text-gray-900 dark:text-white tracking-tight leading-tight uppercase truncate">
                      {service.title}
                    </h3>
                  </div>
                  <p className="text-[8.5px] sm:text-[10px] md:text-sm font-bold text-gray-500 dark:text-gray-400 tracking-wider uppercase mt-1 sm:mt-1.5 md:mt-2.5 whitespace-nowrap pl-0.5">
                    {service.subtitle}
                  </p>
                </div>

                {/* Bottom Arrow Circle Button */}
                <div className="mt-2 md:mt-4">
                  <div className={cn("w-6 h-6 sm:w-7 sm:h-7 md:w-10 md:h-10 rounded-full text-white flex items-center justify-center shadow-xs group-hover:scale-110 group-hover:translate-x-0.5 transition-all duration-200", service.arrowBg)}>
                    <ArrowRight className="w-3 h-3 sm:w-3.5 sm:h-3.5 md:w-5 md:h-5 text-white" strokeWidth={2.6} />
                  </div>
                </div>
              </div>

              {/* Right 3D Illustration (falls back to a large icon tile if no art exists yet) */}
              <div className="shrink-0 flex items-center justify-center z-10 self-center sm:self-end">
                {service.image ? (
                  <img
                    src={service.image}
                    alt={service.alt}
                    className="h-12 sm:h-16 md:h-20 w-auto object-contain drop-shadow-sm pointer-events-none group-hover:scale-105 transition-transform duration-300 mix-blend-multiply dark:mix-blend-normal"
                    loading="lazy"
                  />
                ) : (
                  <div className="h-12 w-12 sm:h-16 sm:w-16 md:h-20 md:w-20 rounded-2xl bg-[#FE5502]/10 flex items-center justify-center group-hover:scale-105 transition-transform duration-300">
                    <Icon className="h-6 w-6 sm:h-8 sm:w-8 md:h-9 md:w-9 text-[#FE5502]" strokeWidth={1.75} />
                  </div>
                )}
              </div>

              {/* Subtle active background glow */}
              {isActive && (
                <div className={cn("absolute -right-6 -bottom-6 w-24 h-24 md:w-40 md:h-40 rounded-full blur-xl pointer-events-none", service.glowBg)} />
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
