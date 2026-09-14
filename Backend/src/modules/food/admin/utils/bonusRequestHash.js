import crypto from 'crypto';

/**
 * Canonical SHA-256 of immutable bonus request fields.
 * Must stay byte-identical to the previous implementation in the model file.
 */
export function buildBonusRequestHash({ deliveryPartnerId, amount, reference }) {
    const partner = String(deliveryPartnerId || '').trim();
    const amt = String(Number(amount));
    const ref =
        reference == null || String(reference).trim() === ''
            ? ''
            : String(reference).trim();
    const canonical = `${partner}|${amt}|${ref}`;
    return crypto.createHash('sha256').update(canonical, 'utf8').digest('hex');
}
