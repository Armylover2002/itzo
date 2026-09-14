import { FoodZone } from '../../modules/food/admin/models/zone.model.js';
import { QuickZone } from '../../modules/quick-commerce/models/quick_zone.model.js';

const providers = {
    food: {
        model: FoodZone,
        query: { isActive: true },
        mapper: (doc) => ({
            id: String(doc._id),
            serviceType: 'food',
            coordinates: Array.isArray(doc.coordinates) ? doc.coordinates.map(c => ({
                latitude: c.lat || c.latitude, 
                longitude: c.lng || c.longitude
            })) : []
        })
    },
    quick: {
        model: QuickZone,
        query: { isActive: true },
        mapper: (doc) => ({
            id: String(doc._id),
            serviceType: 'quick',
            coordinates: Array.isArray(doc.coordinates) ? doc.coordinates.map(c => ({
                latitude: c.lat || c.latitude, 
                longitude: c.lng || c.longitude
            })) : []
        })
    }
};

export const resolveActiveZones = async (serviceTypes) => {
    if (!Array.isArray(serviceTypes) || serviceTypes.length === 0) {
        return [];
    }

    const promises = [];

    for (const type of serviceTypes) {
        const provider = providers[type];
        if (provider) {
            promises.push(
                provider.model.find(provider.query).lean().then(docs => docs.map(provider.mapper))
            );
        }
    }

    const results = await Promise.all(promises);
    return results.flat();
};
