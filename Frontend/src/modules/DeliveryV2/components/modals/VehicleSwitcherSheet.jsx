import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, Truck } from 'lucide-react';
import { useDeliveryStore } from '@/modules/DeliveryV2/store/useDeliveryStore';
import { deliveryAPI } from '@food/api';
import { toast } from 'sonner';
import { getApprovedVehicles, extractVehiclePayload, getVehicleDisplayName, getVehicleIconUrl } from '@/modules/DeliveryV2/utils/deliveryPartnerSync';

export default function VehicleSwitcherSheet({
  isOpen,
  onClose,
  mode = 'switch',
  onVehicleSelected,
}) {
  const {
    driverVehicles,
    activeVehicleId,
    isOnline,
    setActiveVehicleId,
    setDriverVehicles,
    hydratePartnerState,
    setOnline,
  } = useDeliveryStore();

  const approvedVehicles = useMemo(
    () => getApprovedVehicles(driverVehicles),
    [driverVehicles],
  );

  if (!isOpen) return null;

  const ensureOfflineForVehicleChange = async () => {
    await deliveryAPI.updateOnlineStatus(false);
    hydratePartnerState({ availabilityStatus: 'offline', isOnline: false });
    setOnline(false);
  };

  const handleSelectVehicle = async (vehicle) => {
    const vId = String(vehicle.id || vehicle.vehicleId || '').trim();
    if (!vId) return;

    if (mode === 'switch' && isOnline) {
      toast.error('You must go offline to change your active vehicle.');
      return;
    }

    const applyPayload = (payload = {}) => {
      if (payload.driverVehicles?.length) setDriverVehicles(payload.driverVehicles);
      setActiveVehicleId(payload.activeVehicleId || vId);
      const nextStatus = String(payload.availabilityStatus || '').toLowerCase();
      hydratePartnerState({
        activeVehicleId: payload.activeVehicleId || vId,
        driverVehicles: payload.driverVehicles,
        availabilityStatus: nextStatus || 'offline',
        isOnline: nextStatus === 'online',
      });
      if (nextStatus !== 'online') {
        setOnline(false);
      }
      if (payload.visibleZones) {
        useDeliveryStore.getState().setMapContext({ visibleZones: payload.visibleZones });
      }
    };

    try {
      await ensureOfflineForVehicleChange();

      if (String(activeVehicleId || '') !== vId) {
        applyPayload(extractVehiclePayload(await deliveryAPI.setActiveVehicle(vId)));
      } else {
        setActiveVehicleId(vId);
      }

      if (onVehicleSelected) {
        await onVehicleSelected(vId, vehicle);
      } else {
        toast.success('Active vehicle updated');
        onClose?.();
      }
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to update vehicle');
    }
  };

  const title = mode === 'go_online' ? 'Select Vehicle' : 'Switch Vehicle';
  const subtitle = mode === 'go_online'
    ? 'Choose the vehicle you will use for this session.'
    : (isOnline
      ? 'You must go offline before changing your active vehicle.'
      : 'Select the vehicle you are using for this session.');

  return (
    <div className="fixed inset-0 z-[600] flex items-end">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="relative w-full bg-[#121212] rounded-t-3xl shadow-2xl p-6 border-t border-white/10"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-12 h-1 bg-white/20 rounded-full mx-auto mb-6" />

        <h2 className="text-xl font-black text-white uppercase tracking-tight mb-2">{title}</h2>
        <p className="text-sm text-gray-400 mb-6">
          {mode === 'switch' && isOnline ? (
            <span className="text-red-400 font-medium">{subtitle}</span>
          ) : subtitle}
        </p>

        <div className="flex flex-col gap-3 max-h-[50vh] overflow-y-auto pb-4">
          {approvedVehicles.length > 0 ? (
            approvedVehicles.map((vehicle, idx) => {
              const vId = vehicle.id || vehicle.vehicleId;
              const isActive = String(vId) === String(activeVehicleId || '');
              const displayName = getVehicleDisplayName(vehicle);
              const iconSrc = getVehicleIconUrl(vehicle);

              return (
                <button
                  type="button"
                  key={vId || idx}
                  onClick={() => handleSelectVehicle(vehicle)}
                  className={`relative overflow-hidden rounded-2xl p-4 border transition-all text-left w-full ${isActive ? 'bg-green-500/10 border-green-500/30' : 'bg-white/5 border-white/10 active:scale-95'}`}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center shrink-0 overflow-hidden">
                      {iconSrc ? (
                        <img src={iconSrc} alt={displayName} className="w-8 h-8 object-contain" />
                      ) : (
                        <Truck className="w-6 h-6 text-white/50" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1 gap-2">
                        <h3 className="text-white font-bold truncate capitalize">{displayName}</h3>
                        <div className="flex items-center gap-1 shrink-0">
                          {vehicle.isDefault && (
                            <span className="text-[9px] bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded font-bold uppercase">Default</span>
                          )}
                          {isActive && <CheckCircle2 className="w-4 h-4 text-green-500" />}
                        </div>
                      </div>
                      <div className="text-[11px] text-gray-400 uppercase tracking-widest font-semibold flex items-center gap-2 truncate">
                        <span>{vehicle.registrationNumber || vehicle.vehicleNumber || 'No Reg'}</span>
                        {vehicle.model ? <><span>•</span><span>{vehicle.model}</span></> : null}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })
          ) : (
            <div className="text-center py-8">
              <Truck className="w-12 h-12 text-white/20 mx-auto mb-3" />
              <p className="text-white/70 text-sm font-medium">No approved vehicle available.</p>
              <p className="text-white/40 text-xs mt-1">Please contact admin.</p>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
