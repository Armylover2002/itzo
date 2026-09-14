export const isApprovedVehicle = (vehicle) => {
  if (!vehicle) return false;
  if (vehicle.isDispatchEligible === true) return true;
  const status = String(vehicle.status || vehicle.verificationStatus || '').toLowerCase();
  return status === 'active' || status === 'approved';
};

export const getApprovedVehicles = (vehicles = []) =>
  (Array.isArray(vehicles) ? vehicles : []).filter(isApprovedVehicle);

/** Resolve a human-readable vehicle label from mapped or raw partner vehicle shapes. */
export const getVehicleDisplayName = (vehicle) => {
  if (!vehicle || typeof vehicle !== 'object') return 'Vehicle';
  const master = vehicle.master || {};
  const name =
    master.name ||
    master.category ||
    vehicle.vehicleName ||
    vehicle.name ||
    vehicle.category ||
    vehicle.vehicleCode ||
    '';
  const trimmed = String(name).trim();
  return trimmed || 'Vehicle';
};

export const getVehicleIconUrl = (vehicle) => {
  if (!vehicle || typeof vehicle !== 'object') return null;
  const master = vehicle.master || {};
  // Catalog type icon only — ignore uploaded vehiclePhoto documents.
  return (
    master.iconUrl ||
    master.image ||
    vehicle.iconUrl ||
    null
  );
};

export const extractPartnerFromMeResponse = (response) => {
  const root = response?.data?.data ?? response?.data ?? response ?? {};
  return root.user || root.profile || root.deliveryPartner || root;
};

export const extractVehiclePayload = (response) => {
  const root = response?.data?.data ?? response?.data ?? response ?? {};
  const vehicles = root.driverVehicles || root.vehicles || [];
  return {
    vehicles: Array.isArray(vehicles) ? vehicles : [],
    driverVehicles: Array.isArray(vehicles) ? vehicles : [],
    activeVehicleId: root.activeVehicleId ? String(root.activeVehicleId) : null,
    availabilityStatus: root.availabilityStatus || null,
  };
};

export const extractAvailabilityPayload = (response) => {
  const root = response?.data?.data ?? response?.data ?? response ?? {};
  return {
    availabilityStatus: root.availabilityStatus || null,
    activeVehicleId: root.activeVehicleId ? String(root.activeVehicleId) : null,
  };
};
