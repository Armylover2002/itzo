import React, { memo, useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { restaurantAPI } from "@food/api";
import { useCart } from "@food/context/CartContext";
import { useProfile } from "@food/context/ProfileContext";
import RestaurantItemDetailSheet from "@food/components/user/restaurant-details/sheets/RestaurantItemDetailSheet";
import ItemSlotAvailabilityNote from "@food/components/user/ItemSlotAvailabilityNote";
import {
  buildCartLineId,
  getDefaultFoodVariant,
  getFoodDisplayPrice,
  getFoodPriceLabel,
  getFoodVariants,
  hasFoodVariants,
} from "@food/utils/foodVariants";
import { Flame, Heart, Plus, ArrowRight } from "lucide-react";

const productsCache = new Map();
const MAX_RECOMMENDED_RESTAURANTS = 10;
const MAX_RECOMMENDED_PRODUCTS = 24;

const isVegMenuItem = (item = {}) =>
  item.isVeg === true || String(item.foodType || "").trim() === "Veg";

const RecommendedSection = memo(({ recommendedForYouRestaurants, isFavorite, onFavoriteToggle }) => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [showItemDetail, setShowItemDetail] = useState(false);
  const [selectedItemImageIndex, setSelectedItemImageIndex] = useState(0);
  const [selectedVariantId, setSelectedVariantId] = useState("");
  const { addToCart, updateQuantity, removeFromCart, getCartItem, cart } = useCart();
  const { isDishFavorite, addDishFavorite, removeDishFavorite, vegMode } = useProfile();
  const scrollRef = React.useRef(null);

  const restaurantIdsKey = useMemo(
    () => (recommendedForYouRestaurants || []).map((r) => r.mongoId || r.id).join(","),
    [recommendedForYouRestaurants],
  );

  const productsCacheKey = useMemo(
    () => `${restaurantIdsKey}|veg:${vegMode ? "1" : "0"}`,
    [restaurantIdsKey, vegMode],
  );

  useEffect(() => {
    if (!restaurantIdsKey) return;

    if (productsCache.has(productsCacheKey)) {
      setProducts(productsCache.get(productsCacheKey));
      return;
    }

    const fetchProducts = async () => {
      setLoading(true);
      try {
        const restaurantsToFetch = (recommendedForYouRestaurants || []).slice(
          0,
          MAX_RECOMMENDED_RESTAURANTS,
        );
        const fetchPromises = restaurantsToFetch.map(async (restaurant) => {
          try {
            const res = await restaurantAPI.getMenuByRestaurantId(restaurant.mongoId || restaurant.id);
            const menu = res.data?.data?.menu;
            const items = [];
            if (menu?.sections) {
              menu.sections.forEach((section) => {
                if (section.items) {
                  section.items.forEach((item) => {
                    items.push({
                      ...item,
                      restaurantId: restaurant.mongoId || restaurant.id,
                      restaurant: restaurant.name,
                      restaurantData: restaurant,
                    });
                  });
                }
              });
            }
            return items;
          } catch {
            return [];
          }
        });

        const results = await Promise.all(fetchPromises);
        const seen = new Set();
        const allProducts = results
          .flat()
          .filter((item) => {
            const key = String(item.id || item._id || "");
            if (!key || seen.has(key)) return false;
            seen.add(key);
            return true;
          })
          .filter((item) => !vegMode || isVegMenuItem(item))
          .sort((a, b) => {
            const aRec = a.isRecommended === true || String(a.isRecommended) === "true";
            const bRec = b.isRecommended === true || String(b.isRecommended) === "true";
            if (aRec !== bRec) return aRec ? -1 : 1;
            return 0;
          })
          .slice(0, MAX_RECOMMENDED_PRODUCTS);

        productsCache.set(productsCacheKey, allProducts);
        setProducts(allProducts);
      } catch {
        // Silently fail
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, [productsCacheKey, restaurantIdsKey, recommendedForYouRestaurants, vegMode]);

  useEffect(() => {
    if (!selectedProduct) {
      setSelectedVariantId("");
      return;
    }
    const defaultVariant = getDefaultFoodVariant(selectedProduct);
    setSelectedVariantId(defaultVariant?.id || "");
  }, [selectedProduct]);

  const getVariantForDish = (item, preferredVariantId = "") => {
    const variants = getFoodVariants(item);
    if (variants.length === 0) return null;
    return (
      variants.find((variant) => String(variant.id) === String(preferredVariantId || "")) ||
      variants[0]
    );
  };

  const getLineItemIdForDish = (item, variant = null) =>
    buildCartLineId(item?.id || item?._id || "", variant?.id || variant?._id || "");

  const getDishQuantity = (item, preferredVariantId = "") => {
    const variant = getVariantForDish(item, preferredVariantId);
    const lineItemId = getLineItemIdForDish(item, variant);
    const cartItem = cart.find((entry) => entry.id === lineItemId);
    return cartItem?.quantity || 0;
  };

  const updateItemQuantity = (item, newQuantity, event = null, preferredVariant = null) => {
    const resolvedVariant = preferredVariant || getDefaultFoodVariant(item);
    const lineItemId = getLineItemIdForDish(item, resolvedVariant);
    const itemId = String(item.id || item._id || "");

    const cartItem = {
      ...item,
      id: lineItemId,
      lineItemId,
      itemId,
      name: item.name,
      price: resolvedVariant?.price ?? getFoodDisplayPrice(item),
      otherPrice: resolvedVariant?.otherPrice ?? item.otherPrice ?? 0,
      variantId: resolvedVariant?.id || "",
      variantName: resolvedVariant?.name || "",
      variantPrice: resolvedVariant?.price ?? getFoodDisplayPrice(item),
      image: item.image,
      restaurant: item.restaurant,
      restaurantId: item.restaurantId,
      description: item.description,
      isVeg: item.foodType === "Veg" || item.isVeg === true,
      preparationTime: item.preparationTime,
    };

    if (newQuantity <= 0) {
      removeFromCart(lineItemId);
      return;
    }

    const existingCartItem = getCartItem(lineItemId);
    if (existingCartItem) {
      updateQuantity(lineItemId, newQuantity);
      return;
    }

    const result = addToCart(cartItem);
    if (result?.ok === false) {
      toast.error(result.error || "Cannot add item to cart.");
      return;
    }
    if (newQuantity > 1) {
      updateQuantity(lineItemId, newQuantity);
    }
  };

  const openProductDetail = (product) => {
    setSelectedProduct(product);
    setSelectedItemImageIndex(0);
    setShowItemDetail(true);
  };

  const handleProductAddClick = (product, event) => {
    event.stopPropagation();
    if (hasFoodVariants(product)) {
      openProductDetail(product);
      return;
    }
    updateItemQuantity(product, 1);
  };

  if (loading) {
    return (
      <section className="mt-4 px-4" data-purpose="recommended-section">
        <div className="flex justify-between items-center mb-4 sm:mb-5 pr-2">
          <h2 className="text-[15px] font-semibold text-[#1c1c1e] dark:text-white tracking-tight md:text-xl">
            Recommended For You
          </h2>
          <div className="w-16 h-3 bg-gray-200 rounded animate-pulse" />
        </div>
        <div className="flex overflow-x-auto gap-4 scrollbar-hide pb-2">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="w-[40%] sm:w-[30%] md:w-[22%] lg:w-[16%] bg-white rounded-[12px] border border-gray-100 overflow-hidden shadow-sm h-full flex flex-col animate-pulse flex-shrink-0"
            >
              <div className="h-20 sm:h-24 bg-gray-200 shrink-0" />
              <div className="p-2.5 flex flex-col flex-1">
                <div className="h-3 bg-gray-200 rounded w-3/4 mb-1" />
                <div className="h-2 bg-gray-200 rounded w-1/2 mt-1 mb-auto" />
                <div className="flex justify-between items-end mt-3 shrink-0">
                  <div className="flex flex-col gap-1 w-12">
                     <div className="h-2 bg-gray-200 rounded w-full" />
                     <div className="h-3 bg-gray-200 rounded w-full" />
                  </div>
                  <div className="h-6 w-14 bg-gray-200 rounded-lg" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (!products || products.length === 0) return null;

  const scrollRight = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: 300, behavior: 'smooth' });
    }
  };

  return (
    <motion.section
      className="mt-4 px-4"
      data-purpose="recommended-section"
      initial={false}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="flex justify-between items-center mb-4 sm:mb-5 pr-2">
        <h2 className="text-[15px] font-semibold text-[#1c1c1e] dark:text-white tracking-tight md:text-xl">
          Recommended For You
        </h2>
        <button onClick={scrollRight} className="h-7 w-7 sm:h-8 sm:w-8 rounded-full bg-gray-100 flex items-center justify-center cursor-pointer hover:bg-gray-200 transition-colors border-0 shrink-0">
          <ArrowRight className="h-4 w-4 text-gray-700" />
        </button>
      </div>

      <div ref={scrollRef} className="flex overflow-x-auto gap-4 scrollbar-hide pb-2 snap-x scroll-smooth">
        {products.map((product, index) => (
          <motion.div
            key={`recommended-prod-${product._id || product.id || index}`}
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.35, delay: index * 0.05 }}
            className="flex-shrink-0 w-[40%] sm:w-[30%] md:w-[22%] lg:w-[16%] snap-start"
          >
            <div
              onClick={() => openProductDetail(product)}
              className="bg-white rounded-[12px] border border-gray-100 overflow-hidden shadow-[0_2px_8px_rgba(0,0,0,0.04)] block hover:shadow-md transition-shadow cursor-pointer h-full flex flex-col"
              data-purpose="product-card"
            >
              <div className="relative h-20 sm:h-24 bg-gray-100 shrink-0">
                <img
                  src={product.image || product.imageUrl || "https://placehold.co/150x150/png?text=No+Image"}
                  alt={product.name}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
                {product.foodType === "Veg" || product.isVeg ? (
                  <div className="absolute top-2 left-2 bg-green-600 px-1.5 py-0.5 rounded flex items-center shadow-sm">
                    <span className="text-[7.5px] font-bold text-white uppercase tracking-wider">VEG</span>
                  </div>
                ) : null}
                <button
                  type="button"
                  className="absolute top-2 right-2 bg-white rounded-full p-1.5 shadow-sm border-0 outline-none z-10 transition-transform active:scale-90"
                  onClick={(e) => {
                    e.stopPropagation();
                    const dishId = product.id || product._id;
                    const restId = product.restaurantId || product.restaurantData?.mongoId || product.restaurantData?.id;
                    if (!dishId || !restId) return;
                    
                    const isFav = isDishFavorite(dishId, restId);
                    if (isFav) {
                      removeDishFavorite(dishId, restId);
                      toast.success("Removed from wishlist");
                    } else {
                      addDishFavorite(product, restId);
                      toast.success("Added to wishlist");
                    }
                  }}
                >
                  <Heart 
                    className="h-3.5 w-3.5 transition-colors" 
                    fill={isDishFavorite(product.id || product._id, product.restaurantId || product.restaurantData?.mongoId || product.restaurantData?.id) ? "#FE5502" : "none"} 
                    stroke={isDishFavorite(product.id || product._id, product.restaurantId || product.restaurantData?.mongoId || product.restaurantData?.id) ? "#FE5502" : "#4B5563"} 
                  />
                </button>
              </div>
              <div className="p-2.5 flex flex-col flex-1">
                <h4 className="font-bold text-xs text-[#1c1c1e] line-clamp-1">{product.name}</h4>
                <p className="text-[9px] text-gray-500 mt-0.5 line-clamp-1 font-medium">
                  {product.restaurant}
                </p>
                <ItemSlotAvailabilityNote item={product} className="mt-1 mb-auto" />
                <div className="flex justify-between items-center mt-3 shrink-0">
                  <div className="flex items-center">
                     <span className="text-[14px] font-bold text-[#FE5502] leading-none">
                       {getFoodPriceLabel(product).replace(/starting from/i, "").trim()}
                     </span>
                  </div>
                  {(() => {
                    const quantity = getDishQuantity(product);
                    
                    if (quantity > 0) {
                      return (
                        <div className="flex items-center bg-[#FE5502] rounded-[8px] overflow-hidden shadow-sm h-7 w-20">
                          <button
                            type="button"
                            className="flex-1 h-full text-white font-bold flex items-center justify-center hover:bg-[#C83C00] transition-colors"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (hasFoodVariants(product)) {
                                openProductDetail(product);
                              } else {
                                updateItemQuantity(product, quantity - 1);
                              }
                            }}
                          >
                            -
                          </button>
                          <span className="text-white font-bold text-[11px] px-1">{quantity}</span>
                          <button
                            type="button"
                            className="flex-1 h-full text-white font-bold flex items-center justify-center hover:bg-[#C83C00] transition-colors"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (hasFoodVariants(product)) {
                                openProductDetail(product);
                              } else {
                                updateItemQuantity(product, quantity + 1);
                              }
                            }}
                          >
                            +
                          </button>
                        </div>
                      );
                    }
                    
                    return (
                      <button
                        type="button"
                        className="bg-[#FE5502] text-white font-bold text-[10px] pl-3 pr-1.5 py-1.5 rounded-[8px] flex items-center gap-1 shadow-sm transition-colors hover:bg-[#C83C00] border-0 outline-none h-7"
                        onClick={(e) => handleProductAddClick(product, e)}
                      >
                        ADD <Plus className="h-3.5 w-3.5 bg-white text-[#FE5502] rounded-full p-0.5" strokeWidth={3} />
                      </button>
                    );
                  })()}
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <RestaurantItemDetailSheet
        open={showItemDetail}
        onClose={() => {
          setShowItemDetail(false);
          setSelectedProduct(null);
        }}
        selectedItem={selectedProduct}
        selectedItemImageIndex={selectedItemImageIndex}
        setSelectedItemImageIndex={setSelectedItemImageIndex}
        selectedVariantId={selectedVariantId}
        setSelectedVariantId={setSelectedVariantId}
        restaurant={selectedProduct?.restaurantData || { name: selectedProduct?.restaurant }}
        shouldShowGrayscale={false}
        isRecommendedItem={() => true}
        showBookmark={false}
        showShare={false}
        getDishQuantity={getDishQuantity}
        updateItemQuantity={updateItemQuantity}
        getVariantForDish={getVariantForDish}
      />
    </motion.section>
  );
});

export default RecommendedSection;
