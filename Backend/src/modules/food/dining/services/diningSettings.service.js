import { DiningSettings } from '../models/diningSettings.model.js';

export async function getDiningSettings() {
    let settings = await DiningSettings.findOne({ key: 'global' });
    if (!settings) {
        settings = await DiningSettings.create({ key: 'global' });
    }
    return settings;
}

export async function updateDiningSettings(data) {
    const settings = await getDiningSettings();
    Object.assign(settings, data);
    await settings.save();
    return settings;
}
