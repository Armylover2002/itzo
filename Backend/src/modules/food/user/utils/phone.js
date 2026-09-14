/**
 * Safely normalizes phone numbers to standard format (E.164 with +91 prefix default).
 * Handles spaces, dashes, brackets, leading 0, leading 91, and +91 prefix.
 * Returns null if the phone number is invalid or cannot be parsed.
 *
 * @param {string} phone
 * @returns {string|null}
 */
export function normalizePhoneNumber(phone) {
    if (typeof phone !== 'string') {
        return null;
    }

    // 1. Clean the string and extract components
    let cleaned = phone.trim();
    const hasLeadingPlus = cleaned.startsWith('+');

    // Remove all non-digit characters
    cleaned = cleaned.replace(/\D/g, '');

    if (!cleaned) {
        return null;
    }

    // 2. If it had a leading plus, process as international number
    if (hasLeadingPlus) {
        if (cleaned.startsWith('91')) {
            // Must be +91 followed by 10 digits
            if (cleaned.length === 12) {
                return `+${cleaned}`;
            }
            return null;
        }
        // General international number fallback (E.164: 8 to 15 digits total)
        if (cleaned.length >= 8 && cleaned.length <= 15) {
            return `+${cleaned}`;
        }
        return null;
    }

    // 3. Process numbers without leading plus
    // Handle starting '0': e.g., "09876543210" -> "9876543210"
    if (cleaned.startsWith('0')) {
        cleaned = cleaned.slice(1);
    }

    // Handle starting '91' and length 12: e.g., "919876543210" -> "+919876543210"
    if (cleaned.startsWith('91') && cleaned.length === 12) {
        return `+${cleaned}`;
    }

    // Handle standard 10-digit number: e.g., "9876543210" -> "+919876543210"
    if (cleaned.length === 10) {
        return `+91${cleaned}`;
    }

    return null;
}
