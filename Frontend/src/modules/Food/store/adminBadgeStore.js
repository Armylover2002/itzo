import { create } from 'zustand';
import { adminAPI } from '@/services/api';

export const useAdminBadgeStore = create((set, get) => ({
  badges: {},
  totalCount: 0,
  lastFetched: 0,
  isFetching: false,

  fetchBadges: async (force = false) => {
    const { lastFetched, isFetching } = get();
    const now = Date.now();
    
    // Throttle fetches to at most once every 10 seconds unless forced
    if (!force && (isFetching || (now - lastFetched < 10000))) {
      return;
    }

    set({ isFetching: true });

    try {
      const res = await adminAPI.getSidebarBadges();
      if (res?.data?.success) {
        const c = res.data.counts || {};
        const total = 
          (c.restaurants || 0) + 
          (c.deliveryPartners || 0) +
          (c.foodApprovals || 0) + 
          (c.userSupportTickets || 0) + 
          (c.deliverySupportTickets || 0) + 
          (c.earningAddons || 0) + 
          (c.safetyReports || 0) + 
          (c.emergencyHelp || 0) + 
          (c.restaurantComplaints || 0) +
          (c.categories || 0);
          
        set({
          badges: c,
          totalCount: total,
          lastFetched: Date.now(),
        });
      }
    } catch (error) {
      console.error('Error fetching admin badges:', error);
    } finally {
      set({ isFetching: false });
    }
  }
}));
