/**
 * Chunk large bulkWrite payloads so a single command stays under MongoDB
 * BSON/message limits (16MB) and the 100k-ops-per-batch ceiling.
 * Each chunk is still one atomic bulkWrite; overall job is not multi-doc transactional.
 *
 * @param {{ bulkWrite: Function }} writer - native collection or Mongoose model
 */
export const NOTIFICATION_BULK_WRITE_CHUNK_SIZE = 750;

export async function bulkWriteInChunks(writer, operations = [], options = {}) {
    if (!writer || typeof writer.bulkWrite !== 'function') {
        throw new Error('bulkWriteInChunks requires a collection or model with bulkWrite()');
    }

    const ordered = options.ordered === true;
    const chunkSize = Math.max(
        1,
        Number(options.chunkSize) || NOTIFICATION_BULK_WRITE_CHUNK_SIZE
    );
    const rows = Array.isArray(operations) ? operations : [];

    if (!rows.length) {
        return {
            ok: true,
            upsertedIds: {},
            upsertedCount: 0,
            matchedCount: 0,
            modifiedCount: 0,
            insertedCount: 0,
            deletedCount: 0
        };
    }

    const aggregated = {
        ok: true,
        upsertedIds: {},
        upsertedCount: 0,
        matchedCount: 0,
        modifiedCount: 0,
        insertedCount: 0,
        deletedCount: 0
    };

    for (let offset = 0; offset < rows.length; offset += chunkSize) {
        const chunk = rows.slice(offset, offset + chunkSize);
        const result = await writer.bulkWrite(chunk, { ordered });

        const localUpserts = result?.upsertedIds || {};
        for (const [localIndex, id] of Object.entries(localUpserts)) {
            aggregated.upsertedIds[offset + Number(localIndex)] = id;
        }

        aggregated.upsertedCount += Number(result?.upsertedCount || 0);
        aggregated.matchedCount += Number(result?.matchedCount || 0);
        aggregated.modifiedCount += Number(result?.modifiedCount || 0);
        aggregated.insertedCount += Number(result?.insertedCount || 0);
        aggregated.deletedCount += Number(result?.deletedCount || 0);
    }

    return aggregated;
}
