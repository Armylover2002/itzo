import { createPortal } from "react-dom";
import AddToCartAnimation from "@food/components/user/AddToCartAnimation";
import RestaurantMenuSheet from "./sheets/RestaurantMenuSheet";
import RestaurantFilterSheet from "./sheets/RestaurantFilterSheet";
import RestaurantLocationSheet from "./sheets/RestaurantLocationSheet";
import RestaurantManageCollectionsSheet from "./sheets/RestaurantManageCollectionsSheet";
import RestaurantItemDetailSheet from "./sheets/RestaurantItemDetailSheet";
import RestaurantScheduleSheet from "./sheets/RestaurantScheduleSheet";
import RestaurantOffersSheet from "./sheets/RestaurantOffersSheet";
import RestaurantMenuOptionsSheet from "./sheets/RestaurantMenuOptionsSheet";
import RestaurantShareModal from "./sheets/RestaurantShareModal";

export default function RestaurantDetailsOverlays(props) {
  const {
    showMenuSheet,
    setShowMenuSheet,
    menuCategories,
    showFilterSheet,
    setShowFilterSheet,
    filters,
    setFilters,
    vegMode,
    activeFilterCount,
    onCategoryClick,
    showLocationSheet,
    setShowLocationSheet,
    restaurant,
    showManageCollections,
    setShowManageCollections,
    selectedItem,
    isDishFavorite,
    removeDishFavorite,
    getDishFavorites,
    getFavorites,
    showItemDetail,
    setShowItemDetail,
    selectedItemImageIndex,
    setSelectedItemImageIndex,
    selectedVariantId,
    setSelectedVariantId,
    shouldShowGrayscale,
    isRecommendedItem,
    handleBookmarkClick,
    getDishQuantity,
    updateItemQuantity,
    getVariantForDish,
    showScheduleSheet,
    setShowScheduleSheet,
    selectedDate,
    setSelectedDate,
    selectedTimeSlot,
    setSelectedTimeSlot,
    showOffersSheet,
    setShowOffersSheet,
    expandedCoupons,
    setExpandedCoupons,
    showMenuOptionsSheet,
    setShowMenuOptionsSheet,
    slug,
    isFavorite,
    handleAddToCollection,
    handleShareRestaurant,
    handleShareClick,
    showShareModal,
    setShowShareModal,
    sharePayload,
    handleSystemShareFromModal,
    openShareTarget,
    copyShareLink,
  } = props;

  return (
    <>
      <RestaurantMenuSheet
        open={showMenuSheet}
        onClose={() => setShowMenuSheet(false)}
        menuCategories={menuCategories}
        onCategoryClick={onCategoryClick}
      />
      <RestaurantFilterSheet
        open={showFilterSheet}
        onClose={() => setShowFilterSheet(false)}
        filters={filters}
        setFilters={setFilters}
        vegMode={vegMode}
        activeFilterCount={activeFilterCount}
      />
      <RestaurantLocationSheet
        open={showLocationSheet}
        onClose={() => setShowLocationSheet(false)}
        restaurant={restaurant}
      />
      <RestaurantManageCollectionsSheet
        open={showManageCollections}
        onClose={() => setShowManageCollections(false)}
        selectedItem={selectedItem}
        restaurant={restaurant}
        isDishFavorite={isDishFavorite}
        removeDishFavorite={removeDishFavorite}
        getDishFavorites={getDishFavorites}
        getFavorites={getFavorites}
      />
      <RestaurantItemDetailSheet
        open={showItemDetail}
        onClose={() => setShowItemDetail(false)}
        selectedItem={selectedItem}
        selectedItemImageIndex={selectedItemImageIndex}
        setSelectedItemImageIndex={setSelectedItemImageIndex}
        selectedVariantId={selectedVariantId}
        setSelectedVariantId={setSelectedVariantId}
        restaurant={restaurant}
        shouldShowGrayscale={shouldShowGrayscale}
        isRecommendedItem={isRecommendedItem}
        handleBookmarkClick={handleBookmarkClick}
        isDishFavorite={isDishFavorite}
        getDishQuantity={getDishQuantity}
        updateItemQuantity={updateItemQuantity}
        getVariantForDish={getVariantForDish}
        handleShareClick={handleShareClick}
      />
      <RestaurantScheduleSheet
        open={showScheduleSheet}
        onClose={() => setShowScheduleSheet(false)}
        selectedDate={selectedDate}
        setSelectedDate={setSelectedDate}
        selectedTimeSlot={selectedTimeSlot}
        setSelectedTimeSlot={setSelectedTimeSlot}
      />
      <RestaurantOffersSheet
        open={showOffersSheet}
        onClose={() => setShowOffersSheet(false)}
        restaurant={restaurant}
        expandedCoupons={expandedCoupons}
        setExpandedCoupons={setExpandedCoupons}
      />
      <RestaurantMenuOptionsSheet
        open={showMenuOptionsSheet}
        onClose={() => setShowMenuOptionsSheet(false)}
        restaurant={restaurant}
        slug={slug}
        isFavorite={isFavorite}
        handleAddToCollection={handleAddToCollection}
        handleShareRestaurant={handleShareRestaurant}
      />
      <RestaurantShareModal
        open={showShareModal}
        onClose={() => setShowShareModal(false)}
        sharePayload={sharePayload}
        handleSystemShareFromModal={handleSystemShareFromModal}
        openShareTarget={openShareTarget}
        copyShareLink={copyShareLink}
      />
      {typeof window !== "undefined" &&
        createPortal(
          <AddToCartAnimation bottomOffset={80} linkTo="/food/user/cart" hideOnPages={true} />,
          document.body,
        )}
    </>
  );
}
