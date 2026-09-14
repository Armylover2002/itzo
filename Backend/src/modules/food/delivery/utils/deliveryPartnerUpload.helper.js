import { uploadImageBuffer } from '../../../../services/cloudinary.service.js';

const PARTNER_UPLOAD_FIELDS = [
    ['profilePhoto', 'food/delivery/profile'],
    ['aadharPhoto', 'food/delivery/aadhar'],
    ['panPhoto', 'food/delivery/pan'],
    ['drivingLicensePhoto', 'food/delivery/license'],
    ['vehicleImage', 'food/delivery/vehicle'],
];

const VEHICLE_UPLOAD_FIELDS = [
    ['vehiclePhoto', 'vehiclePhoto', 'food/delivery/vehicle'],
    ['rc', 'rcPhoto', 'food/delivery/rc'],
    ['insurance', 'insurancePhoto', 'food/delivery/insurance'],
    ['fitness', 'fitnessPhoto', 'food/delivery/fitness'],
    ['pollution', 'pollutionPhoto', 'food/delivery/pollution'],
    ['permit', 'permitPhoto', 'food/delivery/permit'],
];

export const parseSignupVehiclesPayload = (payload) => {
    const raw = payload?.vehicles || payload?.driverVehicles;
    if (typeof raw === 'string') {
        try {
            return JSON.parse(raw);
        } catch {
            return [];
        }
    }
    return Array.isArray(raw) ? raw : [];
};

export const uploadPartnerDocumentImages = async (files = {}) => {
    const tasks = PARTNER_UPLOAD_FIELDS.map(([field, folder]) => {
        const file = files?.[field]?.[0];
        if (!file?.buffer) return null;
        return uploadImageBuffer(file.buffer, folder).then((url) => ({ field, url }));
    }).filter(Boolean);

    if (!tasks.length) return {};

    const results = await Promise.all(tasks);
    return Object.fromEntries(results.map(({ field, url }) => [field, url]));
};

export const uploadSignupVehicleDocuments = async (files = {}, vehicles = []) => {
    if (!Array.isArray(vehicles) || !vehicles.length) return new Map();

    const tasks = [];
    for (const vehicle of vehicles) {
        const vehicleId = vehicle?.id || vehicle?._id;
        if (!vehicleId) continue;

        for (const [filePrefix, targetField, folder] of VEHICLE_UPLOAD_FIELDS) {
            const file = files?.[`${filePrefix}_${vehicleId}`]?.[0];
            if (!file?.buffer) continue;
            tasks.push(
                uploadImageBuffer(file.buffer, folder).then((url) => ({
                    vehicleId: String(vehicleId),
                    targetField,
                    url,
                })),
            );
        }
    }

    if (!tasks.length) return new Map();

    const results = await Promise.all(tasks);
    const uploadMap = new Map();
    for (const { vehicleId, targetField, url } of results) {
        if (!uploadMap.has(vehicleId)) uploadMap.set(vehicleId, {});
        uploadMap.get(vehicleId)[targetField] = url;
    }
    return uploadMap;
};

export const mergeVehicleDocumentUploads = (vehicles, uploadMap) =>
    vehicles.map((vehicle) => {
        const vehicleId = String(vehicle.id || vehicle._id || '');
        const uploads = uploadMap.get(vehicleId) || {};
        return { ...vehicle, ...uploads };
    });
