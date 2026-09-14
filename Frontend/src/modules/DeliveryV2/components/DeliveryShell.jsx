import React, { createContext, useContext } from 'react';
import { Outlet } from 'react-router-dom';
import { useDeliveryNotifications } from '@food/hooks/useDeliveryNotifications';

const DeliveryNotificationsContext = createContext(null);

/**
 * Owns the delivery socket + notification manager above tab routes so
 * Feed / Pocket / History / Profile switches do not remount sockets or
 * re-trigger connection recovery.
 *
 * No local effects here — socket lifecycle lives in useDeliveryNotifications
 * (deps: deliveryPartnerId only) so React renders cannot reconnect the socket.
 */
export function DeliveryShell() {
  const notifications = useDeliveryNotifications();

  return (
    <DeliveryNotificationsContext.Provider value={notifications}>
      <Outlet />
    </DeliveryNotificationsContext.Provider>
  );
}

export function useDeliveryNotificationsContext() {
  const ctx = useContext(DeliveryNotificationsContext);
  if (!ctx) {
    throw new Error(
      'useDeliveryNotificationsContext must be used within DeliveryShell'
    );
  }
  return ctx;
}

export default DeliveryShell;
