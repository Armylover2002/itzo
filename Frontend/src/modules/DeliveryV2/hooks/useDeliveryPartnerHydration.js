import { useEffect, useRef } from 'react';
import { deliveryAPI } from '@food/api';
import { useDeliveryStore } from '@/modules/DeliveryV2/store/useDeliveryStore';
import {
  extractPartnerFromMeResponse,
  extractVehiclePayload,
} from '@/modules/DeliveryV2/utils/deliveryPartnerSync';

let hydrationPromise = null;

export async function hydrateDeliveryPartnerState({ force = false } = {}) {
  if (!force && hydrationPromise) return hydrationPromise;

  hydrationPromise = (async () => {
    const hydrate = useDeliveryStore.getState().hydratePartnerState;

    try {
      const [meRes, vehicleRes] = await Promise.all([
        deliveryAPI.getMe(),
        deliveryAPI.getVehicles(),
      ]);

      const partner = extractPartnerFromMeResponse(meRes);
      const vehiclePayload = extractVehiclePayload(vehicleRes);

      hydrate({
        availabilityStatus: partner?.availabilityStatus,
        activeVehicleId: vehiclePayload.activeVehicleId || partner?.activeVehicleId,
        driverVehicles: vehiclePayload.driverVehicles?.length
          ? vehiclePayload.driverVehicles
          : (partner?.driverVehicles || partner?.vehicles || []),
        isOnline: String(partner?.availabilityStatus || '').toLowerCase() === 'online',
      });

      return { partner, vehiclePayload };
    } catch {
      return null;
    } finally {
      setTimeout(() => { hydrationPromise = null; }, 500);
    }
  })();

  return hydrationPromise;
}

export function useDeliveryPartnerHydration() {
  const ranRef = useRef(false);

  useEffect(() => {
    if (ranRef.current) return undefined;
    ranRef.current = true;
    hydrateDeliveryPartnerState();

    const syncFromServer = () => {
      if (document.visibilityState && document.visibilityState !== 'visible') return;
      hydrateDeliveryPartnerState({ force: true });
    };

    window.addEventListener('focus', syncFromServer);
    document.addEventListener('visibilitychange', syncFromServer);

    return () => {
      window.removeEventListener('focus', syncFromServer);
      document.removeEventListener('visibilitychange', syncFromServer);
    };
  }, []);
}

export default useDeliveryPartnerHydration;
