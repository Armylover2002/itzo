import React, { memo, useCallback, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import ProductCard from "../shared/ProductCard";
import { cn } from "@/lib/utils";
import ExperienceBannerCarousel from "./ExperienceBannerCarousel";
import { resolveQuickImageUrl } from "../../utils/image";
import { getCloudinarySrcSet } from "@/shared/utils/cloudinaryUtils";
import { motion } from "framer-motion";
import { CheckCircle2, ShoppingBag } from "lucide-react";
import { getQuickCategoryPath } from "../../utils/routes";

// ─── Static constants bahar rakhe — har render pe recreate nahi hoga ──────────
const CATEGORY_CARD_THEMES = [
  { bg: "bg-[#ffd1d1]", ring: "ring-[#ffbdbd]/80" },
  { bg: "bg-[#d1dcff]", ring: "ring-[#b8c6ff]/80" },
  { bg: "bg-[#ffdbb3]", ring: "ring-[#ffc98a]/80" },
  { bg: "bg-[#d8f5e5]", ring: "ring-[#b8ebcf]/80" },
  { bg: "bg-[#efe4ff]", ring: "ring-[#dbc7ff]/80" },
  { bg: "bg-[#dff7f7]", ring: "ring-[#c2eded]/80" },
];

const GRID_COLS_MAP = {
  1: "grid-cols-1",
  2: "grid-cols-2",
  3: "grid-cols-3",
  4: "grid-cols-4",
  5: "grid-cols-5",
};

const MOTION_TRANSITION = {
  type: "spring",
  stiffness: 260,
  damping: 20,
};

const MOTION_VIEWPORT = { once: true, amount: 0.2 };

const isFastFavSection = (section) =>
  /fast\s*(fav|av)/i.test(String(section?.title || ""));

// ─── Banner Section ────────────────────────────────────────────────────────────
const BannerSection = memo(({ section, items: itemsProp }) => {
  const items =
    itemsProp ||
    section.config?.banners?.items ||
    section.config?.items ||
    [];
  if (!items.length) return null;

  return (
    <div className="mb-2 md:mb-3">
      <ExperienceBannerCarousel section={section} items={items} />
    </div>
  );
});
BannerSection.displayName = "BannerSection";

// ─── Categories Section (Explore Collection–style cards) ───────────────────────
const CategoryItem = memo(({ cat, idx, onClick }) => {
  const theme = CATEGORY_CARD_THEMES[idx % CATEGORY_CARD_THEMES.length];
  const motionInitial = useMemo(
    () => ({ opacity: 0, y: 16, scale: 0.96 }),
    []
  );
  const motionAnimate = { opacity: 1, y: 0, scale: 1 };
  const motionTransition = useMemo(
    () => ({ ...MOTION_TRANSITION, delay: (idx % 4) * 0.05 }),
    [idx]
  );

  return (
    <motion.button
      type="button"
      initial={motionInitial}
      whileInView={motionAnimate}
      viewport={MOTION_VIEWPORT}
      transition={motionTransition}
      whileHover={{ y: -4, scale: 1.02 }}
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      className={cn(
        "relative flex flex-col items-stretch text-left rounded-[18px] md:rounded-[22px] p-2 md:p-2.5 overflow-hidden shadow-[0_8px_20px_rgba(15,23,42,0.06)] ring-1 transition-shadow hover:shadow-[0_14px_28px_rgba(15,23,42,0.10)]",
        theme.bg,
        theme.ring,
      )}
    >
      <div className="relative w-full aspect-[4/3] rounded-[14px] md:rounded-[16px] bg-white/85 overflow-hidden shadow-sm flex items-center justify-center">
        {cat.image ? (
          <img
            src={cat.image}
            srcSet={getCloudinarySrcSet(cat.image)}
            sizes="(max-width: 768px) 40vw, 180px"
            alt={cat.name}
            className="w-full h-full object-cover transition-transform duration-500"
            loading="lazy"
          />
        ) : (
          <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm">
            <ShoppingBag className="w-5 h-5 text-[#FF0000]" strokeWidth={2.5} />
          </div>
        )}
      </div>
      <div className="pt-2 pb-0.5 px-0.5 flex items-center justify-center">
        <span className="text-[11px] md:text-[13px] font-extrabold text-[#1c1c1e] text-center leading-tight line-clamp-2">
          {cat.name}
        </span>
      </div>
    </motion.button>
  );
});
CategoryItem.displayName = "CategoryItem";

const CategoriesSection = memo(({ section }) => {
  const navigate = useNavigate();
  const categoryConfig = section.config?.categories || {};
  const rows = categoryConfig.rows || 1;
  const visibleCount = Math.max(rows * 4, 8);

  const items = useMemo(
    () =>
      (categoryConfig.items || [])
        .slice(0, visibleCount)
        .map((c) => ({
          ...c,
          id: c.id || c._id,
          image: resolveQuickImageUrl(c.image || c.mainImage),
        })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [categoryConfig.items, visibleCount]
  );

  const handleClick = useCallback(
    (id) => () => navigate(getQuickCategoryPath(id)),
    [navigate]
  );

  const gridColsClass = useMemo(() => {
    if (items.length <= 1) return "grid-cols-1 max-w-[180px]";
    if (items.length === 2) return "grid-cols-2";
    if (items.length === 3) return "grid-cols-3";
    return "grid-cols-2 sm:grid-cols-4";
  }, [items.length]);

  if (!items.length) return null;

  const isFast = isFastFavSection(section);

  return (
    <div
      id={`section-${section._id}`}
      className={cn(
        "mt-0 rounded-[20px] p-3 md:p-4",
        isFast
          ? "bg-white/70 border border-sky-100/80 shadow-[0_10px_24px_rgba(14,165,233,0.08)]"
          : "bg-transparent",
      )}
    >
      {section.title && (
        <div className="flex items-center justify-between gap-3 mb-3 md:mb-4">
          <div className="flex items-center gap-2 min-w-0">
            {isFast && (
              <span className="text-[#FF0000] text-[12px] md:text-[14px] opacity-90 leading-none shrink-0">
                ⇋
              </span>
            )}
            <h3 className="text-[15px] md:text-xl font-extrabold text-[#1c1c1e] dark:text-white tracking-tight truncate">
              {/fast\s*av/i.test(section.title) ? "Fast Fav" : section.title}
            </h3>
            {isFast && (
              <span className="text-[#FF0000] text-[12px] md:text-[14px] opacity-90 leading-none shrink-0">
                ⇌
              </span>
            )}
          </div>
          <span className="text-[11px] md:text-xs font-semibold text-sky-500 shrink-0">
            {items.length} {items.length === 1 ? "category" : "categories"}
          </span>
        </div>
      )}
      <div className={cn("grid gap-2.5 md:gap-4", gridColsClass)}>
        {items.map((cat, idx) => (
          <CategoryItem
            key={cat.id || `cat-${idx}`}
            cat={cat}
            idx={idx}
            onClick={handleClick(cat.id)}
          />
        ))}
      </div>
    </div>
  );
});
CategoriesSection.displayName = "CategoriesSection";

// ─── More products (Recommended-style), injected after Fast Fav categories ─────
const MoreProductsSection = memo(({
  heading = "More",
  products = [],
}) => {
  if (!products.length) return null;

  return (
    <section className="mt-5 md:mt-6" data-purpose="more-after-fast-fav">
      <div className="mb-3 sm:mb-4">
        <h3 className="text-[15px] md:text-xl font-semibold text-[#1c1c1e] dark:text-white tracking-tight">
          {heading}
        </h3>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 md:mt-2">
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5 text-[#0c831f] shrink-0" />
            <span className="text-[11px] md:text-[13px] font-medium text-slate-600">
              Picked for you
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5 text-[#0c831f] shrink-0" />
            <span className="text-[11px] md:text-[13px] font-medium text-slate-600">
              Fresh finds
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5 text-[#0c831f] shrink-0" />
            <span className="text-[11px] md:text-[13px] font-medium text-slate-600">
              Fast delivery
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 md:gap-4">
        {products.map((product) => (
          <div
            key={`more-${product.id || product._id}`}
            className="min-w-0"
          >
            <ProductCard product={product} compact />
          </div>
        ))}
      </div>
    </section>
  );
});
MoreProductsSection.displayName = "MoreProductsSection";

// ─── Subcategories Section ─────────────────────────────────────────────────────
const SubcategoryItem = memo(({ cat, onClick }) => (
  <button
    className="flex flex-col items-center gap-2 w-20 shrink-0 group"
    onClick={onClick}
  >
    <div className="relative aspect-square w-full rounded-2xl bg-card dark:bg-background border border-border flex items-center justify-center overflow-hidden p-1 transition-all duration-200 group-hover:border-[#0c831f]/40 group-hover:bg-accent group-hover:shadow-[0_10px_25px_rgba(15,23,42,0.08)]">
      {cat.image ? (
        <img
          src={resolveQuickImageUrl(cat.image)}
          srcSet={getCloudinarySrcSet(cat.image)}
          sizes="80px"
          alt={cat.name}
          className="w-full h-full object-contain object-center mix-blend-multiply transition-transform duration-200 group-hover:scale-105"
          loading="lazy"
        />
      ) : (
        <div className="h-6 w-6 rounded-full bg-slate-100" />
      )}
    </div>
    <div className="text-[11px] font-semibold text-foreground text-center leading-snug line-clamp-2 group-hover:text-[#0c831f]">
      {cat.name}
    </div>
  </button>
));
SubcategoryItem.displayName = "SubcategoryItem";

const SubcategoriesSection = memo(({ section }) => {
  const navigate = useNavigate();
  const items = section.config?.subcategories?.items || [];

  const handleSubcategoryClick = useCallback(
    (cat) => () => {
      const parentId =
        cat.parentId?._id ||
        cat.parentId ||
        cat.categoryId?._id ||
        cat.categoryId ||
        null;

      if (parentId) {
        navigate(getQuickCategoryPath(parentId), {
          state: { activeSubcategoryId: cat._id },
        });
      } else {
        navigate(getQuickCategoryPath(cat._id));
      }
    },
    [navigate]
  );

  if (!items.length) return null;

  return (
    <div id={`section-${section._id}`}>
      <div className="flex items-center justify-between mb-3">
        {section.title && (
          <h3 className="text-[15px] md:text-xl font-semibold text-[#1c1c1e] dark:text-white tracking-tight">{section.title}</h3>
        )}
        <span className="text-[11px] font-semibold text-slate-400">
          {items.length} items
        </span>
      </div>
      <div className="overflow-x-auto no-scrollbar -mx-4 px-4">
        <div className="flex gap-4 pb-2">
          {items.map((cat, idx) => (
            <SubcategoryItem
              key={cat._id || cat.id || `subcat-${idx}`}
              cat={cat}
              onClick={handleSubcategoryClick(cat)}
            />
          ))}
        </div>
      </div>
    </div>
  );
});
SubcategoriesSection.displayName = "SubcategoriesSection";

// ─── Products Section ──────────────────────────────────────────────────────────
const ProductsSection = memo(({ section }) => {
  const productConfig = section.config?.products || {};
  const rows = productConfig.rows || 1;
  const columns = productConfig.columns || 3;
  const singleRowScrollable = !!productConfig.singleRowScrollable;

  const allProducts = useMemo(
    () =>
      (productConfig.items || []).map((p) => ({
        ...p,
        id: p._id || p.id,
        image: resolveQuickImageUrl(
          p.mainImage ||
          p.image ||
          "https://images.unsplash.com/photo-1550989460-0adf9ea622e2"
        ),
        price: Number(p.price || p.salePrice || 0),
        originalPrice: Number(
          p.originalPrice || p.mrp || p.price || p.salePrice || 0
        ),
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [productConfig.items]
  );

  if (!allProducts.length) return null;

  const heading = section.title;

  if (singleRowScrollable) {
    return (
      <div id={`section-${section._id}`} className="mb-2">
        <div className="flex items-center justify-between mb-3">
          {heading && (
            <h3 className="text-[15px] md:text-xl font-semibold text-[#1c1c1e] dark:text-white tracking-tight">{heading}</h3>
          )}
          <span className="text-[11px] font-semibold text-slate-400">
            {allProducts.length} items
          </span>
        </div>
        <div className="relative z-10 flex overflow-x-auto gap-3 pb-4 no-scrollbar">
          {allProducts.map((product, idx) => (
            <div key={product._id || product.id || `prod1-${idx}`} className="w-[165px] shrink-0">
              <ProductCard product={product} compact={true} neutralBg={true} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const items = allProducts.slice(0, rows * columns);
  const gridClass = GRID_COLS_MAP[columns] || "grid-cols-2";

  return (
    <div id={`section-${section._id}`}>
      <div className="flex items-center justify-between mb-3">
        {heading && (
          <h3 className="text-[15px] md:text-xl font-semibold text-[#1c1c1e] dark:text-white tracking-tight">{heading}</h3>
        )}
        <span className="text-[11px] font-semibold text-slate-400">
          {items.length} items
        </span>
      </div>
      <div className={cn("grid gap-2 md:gap-4", gridClass)}>
        {items.map((product, idx) => (
          <div key={product._id || product.id || `prod2-${idx}`}>
            <ProductCard
              product={product}
              compact={true}
              neutralBg={true}
            />
          </div>
        ))}
      </div>
    </div>
  );
});
ProductsSection.displayName = "ProductsSection";

// ─── Main SectionRenderer ──────────────────────────────────────────────────────
const SectionRenderer = ({
  sections = [],
  moreProducts = [],
  moreHeading = "More",
}) => {
  // Merge consecutive banner sections into one Food-style auto-rotating carousel
  // instead of stacking each banner block one-by-one.
  const normalizedSections = useMemo(() => {
    const result = [];
    let bannerBucket = null;

    const flushBanners = () => {
      if (!bannerBucket) return;
      result.push(bannerBucket);
      bannerBucket = null;
    };

    sections.forEach((section, idx) => {
      if (section.displayType === "banners") {
        const items =
          section.config?.banners?.items || section.config?.items || [];
        if (!bannerBucket) {
          bannerBucket = {
            ...section,
            _id: section._id || `merged-banners-${idx}`,
            displayType: "banners",
            config: {
              ...(section.config || {}),
              banners: { items: [...items] },
            },
            __mergedBannerItems: [...items],
          };
        } else {
          bannerBucket.__mergedBannerItems.push(...items);
          bannerBucket.config.banners.items = bannerBucket.__mergedBannerItems;
        }
        return;
      }

      flushBanners();
      result.push(section);
    });

    flushBanners();
    return result;
  }, [sections]);

  const fastFavIndex = useMemo(
    () =>
      normalizedSections.findIndex(
        (s) => s.displayType === "categories" && isFastFavSection(s),
      ),
    [normalizedSections],
  );

  // If no titled Fast Fav, still attach More after the first categories block
  const moreAfterIndex = useMemo(() => {
    if (fastFavIndex >= 0) return fastFavIndex;
    return normalizedSections.findIndex((s) => s.displayType === "categories");
  }, [fastFavIndex, normalizedSections]);

  return (
    <div className="space-y-6 md:space-y-8">
      {normalizedSections.map((section, idx) => {
        const sectionKey = section._id || `sec-${idx}`;
        let block = null;

        switch (section.displayType) {
          case "banners":
            block = (
              <BannerSection
                section={section}
                items={section.__mergedBannerItems || section.config?.banners?.items}
              />
            );
            break;

          case "categories":
            block = <CategoriesSection section={section} />;
            break;

          case "subcategories":
            block = <SubcategoriesSection section={section} />;
            break;

          case "products":
            block = <ProductsSection section={section} />;
            break;

          default:
            block = null;
        }

        if (!block) return null;

        return (
          <React.Fragment key={sectionKey}>
            {block}
            {idx === moreAfterIndex && moreProducts.length > 0 && (
              <MoreProductsSection
                heading={moreHeading}
                products={moreProducts}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};

export default memo(SectionRenderer);
