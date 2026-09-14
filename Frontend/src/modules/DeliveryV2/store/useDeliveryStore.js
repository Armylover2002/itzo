import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { getApprovedVehicles } from '@/modules/DeliveryV2/utils/deliveryPartnerSync'

/**
 * useDeliveryStore - Professional Zustand store for Delivery V2
 * Single source of truth for availabilityStatus (isOnline) and activeVehicleId.
 */
export const useDeliveryStore = create(
  persist(
    (set, get) => ({
      isOnline: false,
      riderLocation: null,
      activeVehicleId: null,
      driverVehicles: [],
      partnerHydrated: false,

      activeOrder: null,
      tripStatus: 'IDLE',

      mapContext: {
        visibleZones: [],
      },

      settings: {
        pickupRangeLimit: 500,
        deliveryRangeLimit: 500,
      },

      hydratePartnerState: ({
        availabilityStatus,
        activeVehicleId,
        driverVehicles,
        isOnline,
      } = {}) => set((state) => {
        const next = { ...state, partnerHydrated: true };
        if (Array.isArray(driverVehicles)) {
          next.driverVehicles = driverVehicles;
        }
        if (activeVehicleId) {
          next.activeVehicleId = String(activeVehicleId);
        }
        if (availabilityStatus === 'online' || availabilityStatus === 'offline') {
          next.isOnline = availabilityStatus === 'online';
        } else if (typeof isOnline === 'boolean') {
          next.isOnline = isOnline;
        }
        return next;
      }),

      setOnline: (online) => set({ isOnline: Boolean(online) }),

      setMapContext: (context) => set((state) => ({
        mapContext: { ...state.mapContext, ...context },
      })),

      setDriverVehicles: (vehicles) => set({
        driverVehicles: Array.isArray(vehicles) ? vehicles : [],
      }),

      setActiveVehicleId: (id) => set({
        activeVehicleId: id ? String(id) : null,
      }),

      setRiderLocation: (location) => set({ riderLocation: location }),

      setSettings: (newSettings) => set((state) => ({
        settings: { ...state.settings, ...newSettings },
      })),

      setActiveOrder: (orderOrUpdater) => set((state) => {
        const order = typeof orderOrUpdater === 'function' ? orderOrUpdater(state.activeOrder) : orderOrUpdater;
        return {
          activeOrder: order,
          tripStatus: order && !state.activeOrder ? 'PICKING_UP' : (order ? state.tripStatus : 'IDLE'),
        };
      }),

      updateTripStatus: (status) => set({ tripStatus: status }),

      clearActiveOrder: () => set({
        activeOrder: null,
        tripStatus: 'IDLE',
      }),

      canAdvanceToPickup: () => {
        const { activeOrder, tripStatus } = get();
        return activeOrder && tripStatus === 'PICKING_UP';
      },

      canAdvanceToDeliver: () => {
        const { activeOrder, tripStatus } = get();
        return activeOrder && tripStatus === 'PICKED_UP';
      },

      getApprovedVehicles: () => getApprovedVehicles(get().driverVehicles),

      getActiveVehicle: () => {
        const { activeVehicleId, driverVehicles } = get();
        if (!activeVehicleId || !driverVehicles?.length) return null;
        return driverVehicles.find(
          (v) => v.vehicleId === activeVehicleId || v.id === activeVehicleId,
        ) || null;
      },

      getAvailableModules: () => ['food', 'quick'],

      getCurrentModule: () => {
        const { activeOrder } = get();
        const moduleType = String(activeOrder?.module || activeOrder?.orderType || '').toLowerCase();
        if (moduleType === 'quick' || moduleType === 'quick_commerce') return 'quick';
        if (moduleType === 'food') return 'food';
        return activeOrder?.documentType === 'seller_return' || activeOrder?.isReturnPickup
          ? 'quick'
          : (activeOrder ? moduleType || 'food' : 'food');
      },
    }),
    {
      name: 'delivery-v2-online-pref',
      partialize: (state) => ({
        activeVehicleId: state.activeVehicleId,
      }),
    },
  ),
);
