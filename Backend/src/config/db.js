import mongoose from 'mongoose';
import dns from 'dns';
import { config } from './env.js';
import { logger } from '../utils/logger.js';

export const connectDB = async () => {
    try {
        // Set DNS servers to public DNS (Google & Cloudflare) to avoid local DNS/SRV resolution failures
        try {
            dns.setServers(['8.8.8.8', '1.1.1.1']);
        } catch (dnsErr) {
            logger.warn(`Failed to set DNS servers: ${dnsErr.message}`);
        }

        const conn = await mongoose.connect(config.mongodbUri, {
            family: 4, // Force IPv4
            serverSelectionTimeoutMS: 15000,
            connectTimeoutMS: 15000,
            autoIndex: false,
        });
        logger.info(`MongoDB connected: ${conn.connection.host}`);
    } catch (error) {
        logger.error(`MongoDB connection error: ${error.message}`);
        // Log the URI without password for debugging
        const maskedUri = config.mongodbUri.replace(/\/\/.*@/, "//***:***@");
        logger.info(`Attempted to connect to: ${maskedUri}`);
        process.exit(1);
    }
};

/**
 * Close MongoDB connection (e.g. graceful shutdown).
 * @returns {Promise<void>}
 */
export const disconnectDB = async () => {
    await mongoose.connection.close();
    logger.info('MongoDB connection closed');
};
