import { logger } from '../../../../utils/logger.js';
import { ensureDeliveryBonusIndexes } from '../database/bonusIndexManager.js';

/**
 * Startup gate for Food Delivery Bonus money-critical Mongo indexes.
 * Must fail the process if indexes cannot be created/verified.
 */
export async function validateDeliveryBonusStartup() {
    await ensureDeliveryBonusIndexes();
    logger.info('Delivery bonus critical indexes ensured and verified');
}
