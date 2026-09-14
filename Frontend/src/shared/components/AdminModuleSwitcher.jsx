import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ShoppingBasket, UtensilsCrossed } from "lucide-react";
import { cn } from "@/lib/utils";

const ADMIN_MODULES = [
  {
    key: "food",
    label: "Food",
    shortLabel: "Food",
    path: "/ecs/food",
    icon: UtensilsCrossed,
    active: (pathname) => pathname.startsWith("/ecs/food"),
  },
  {
    key: "quick",
    label: "Quick",
    shortLabel: "Quick",
    path: "/ecs/quick-commerce",
    icon: ShoppingBasket,
    active: (pathname) => pathname.startsWith("/ecs/quick-commerce"),
  },


];

export default function AdminModuleSwitcher({ className = "" }) {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <div
      className={cn(
        "flex items-center gap-1 rounded-2xl border border-slate-200 bg-slate-50 p-1 shadow-sm",
        className,
      )}
      aria-label="Switch admin module"
    >
      {ADMIN_MODULES.map((module) => {
        const Icon = module.icon;
        const isActive = module.active(location.pathname);

        return (
          <button
            key={module.key}
            type="button"
            onClick={() => navigate(module.path)}
            className={cn(
              "flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-black uppercase tracking-wide transition-all",
              isActive
                ? "bg-slate-950 text-white shadow-lg shadow-slate-900/15"
                : "text-slate-500 hover:bg-white hover:text-slate-950",
            )}
            aria-current={isActive ? "page" : undefined}
          >
            <Icon className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{module.label}</span>
            <span className="sm:hidden">{module.shortLabel}</span>
          </button>
        );
      })}
    </div>
  );
}
