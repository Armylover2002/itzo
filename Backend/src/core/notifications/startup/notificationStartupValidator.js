import { logger } from '../../../utils/logger.js';
import { ensureNotificationIndexes } from '../database/notificationIndexManager.js';
import { seedMissingNotificationChannelRoles } from '../../../modules/food/admin/services/notificationChannel.service.js';

/**
 * Startup gate for Food notification TTL + channel uniqueness indexes.
 * Must fail the process if indexes cannot be created/verified.
 * Seeds missing channel role docs only (never rewrites existing settings).
 */
export async function validateNotificationStartup() {
    await ensureNotificationIndexes();

    const channelsSeeded = await seedMissingNotificationChannelRoles();
    if (channelsSeeded > 0) {
        logger.info(`Seeded missing food_notification_channels roles: ${channelsSeeded}`);
    }

    logger.info('Notification TTL and channel indexes ensured and verified');
}
