import { FoodLandingSettings } from '../models/landingSettings.model.js';

export const getLandingSettings = async () => {
    let doc = await FoodLandingSettings.findOne().lean();
    if (!doc) {
        doc = (await FoodLandingSettings.create({})).toObject();
    }
    return doc;
};

export const updateLandingSettings = async (payload) => {
    const doc = await FoodLandingSettings.findOneAndUpdate({}, payload, {
        new: true,
        upsert: true
    }).lean();
    return doc;
};



