import { useState, useCallback, useEffect } from 'react';

export const useHomeState = () => {
  // Sidebar & Overlay states
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [activeFilterTab, setActiveFilterTab] = useState('sort');
  const [isAllCategoriesOpen, setIsAllCategoriesOpen] = useState(false);

  // Filter selections
  const [activeFilters, setActiveFilters] = useState(new Set());
  const [sortBy, setSortBy] = useState(null);
  const [selectedCuisine, setSelectedCuisine] = useState(null);

  // UI state
  const [currentBannerIndex, setCurrentBannerIndex] = useState(0);
  const [searchPlaceholder, setSearchPlaceholder] = useState("");
  const [vegMode, setVegMode] = useState(false);
  const [showVegModePopup, setShowVegModePopup] = useState(false);
  const [showSwitchOffPopup, setShowSwitchOffPopup] = useState(false);
  const [showLocationAlert, setShowLocationAlert] = useState(false);
  const [outOfZone, setOutOfZone] = useState(false);
  const [outOfZoneRestaurant, setOutOfZoneRestaurant] = useState(null);

  // Collections state
  const [isManageCollectionsOpen, setIsManageCollectionsOpen] = useState(false);

  const toggleFilter = useCallback((filterId) => {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      if (next.has(filterId)) next.delete(filterId);
      else next.add(filterId);
      return next;
    });
  }, []);

  return {
    isFilterOpen, setIsFilterOpen,
    activeFilterTab, setActiveFilterTab,
    isAllCategoriesOpen, setIsAllCategoriesOpen,
    activeFilters, setActiveFilters, toggleFilter,
    sortBy, setSortBy,
    selectedCuisine, setSelectedCuisine,
    currentBannerIndex, setCurrentBannerIndex,
    searchPlaceholder, setSearchPlaceholder,
    vegMode, setVegMode,
    showVegModePopup, setShowVegModePopup,
    showSwitchOffPopup, setShowSwitchOffPopup,
    showLocationAlert, setShowLocationAlert,
    outOfZone, setOutOfZone,
    outOfZoneRestaurant, setOutOfZoneRestaurant,
    isManageCollectionsOpen, setIsManageCollectionsOpen
  };
};
