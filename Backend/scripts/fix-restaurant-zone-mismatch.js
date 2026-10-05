/**
 * Backfill: recompute each restaurant's zoneId from its actual location.
 *
 * Why: a restaurant's zoneId should always reflect the zone its real address
 * polygon-contains (registration validates this today via isPointInPolygon),
 * but older rows created before that guard existed can carry a stale/wrong
 * zoneId. Any zone-scoped listing (`/food/restaurant/restaurants`,
 * `/under-250`, search) trusts the stored zoneId as an exact match, so a
 * mismatched row shows up under the wrong zone (or, after the zone-filter OR
 * logic was corrected to stop leaking via polygon overlap, disappears from
 * every zone because its explicit-but-wrong zoneId no longer counts as "no
 * zone" either).
 *
 * This finds, for every restaurant with a location, which active zone's
 * polygon actually contains it, and corrects zoneId to match (or clears it
 * to null when the restaurant falls outside every zone, so listings fall
 * back to treating it as unzoned rather than keeping a wrong assignment).
 *
 * Usage:
 *   node scripts/fix-restaurant-zone-mismatch.js            # dry run (report only)
 *   node scripts/fix-restaurant-zone-mismatch.js --apply     # write the corrections
 */
import mongoose from "mongoose";
import { connectDB, disconnectDB } from "../src/config/db.js";
import { FoodRestaurant } from "../src/modules/food/restaurant/models/restaurant.model.js";
import { FoodZone } from "../src/modules/food/admin/models/zone.model.js";
import { isPointInPolygon } from "../src/utils/geo.js";

const apply = process.argv.includes("--apply");

const run = async () => {
  await connectDB();

  try {
    const zones = await FoodZone.find({ isActive: true })
      .select("name coordinates")
      .lean();

    const restaurants = await FoodRestaurant.find({
      "location.latitude": { $exists: true },
      "location.longitude": { $exists: true },
    })
      .select("restaurantName zoneId location.latitude location.longitude")
      .lean();

    console.log(`Checking ${restaurants.length} restaurants against ${zones.length} active zones...\n`);

    const corrections = [];

    for (const restaurant of restaurants) {
      const lat = Number(restaurant.location?.latitude);
      const lng = Number(restaurant.location?.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

      const matchedZone = zones.find((zone) => isPointInPolygon(lat, lng, zone.coordinates));
      const currentZoneId = restaurant.zoneId ? String(restaurant.zoneId) : null;
      const correctZoneId = matchedZone ? String(matchedZone._id) : null;

      if (currentZoneId !== correctZoneId) {
        corrections.push({
          id: restaurant._id,
          name: restaurant.restaurantName,
          from: currentZoneId,
          fromName: zones.find((z) => String(z._id) === currentZoneId)?.name || "(none)",
          to: correctZoneId,
          toName: matchedZone?.name || "(no zone contains this location)",
        });
      }
    }

    if (!corrections.length) {
      console.log("No mismatches found — every restaurant's zoneId already matches its location.");
      return;
    }

    console.log(`Found ${corrections.length} mismatch(es):\n`);
    corrections.forEach((c) => {
      console.log(`  "${c.name}" (${c.id})`);
      console.log(`    zoneId: ${c.fromName} [${c.from}]  ->  ${c.toName} [${c.to}]`);
    });

    if (!apply) {
      console.log("\nDry run only — re-run with --apply to write these corrections.");
      return;
    }

    console.log("\nApplying corrections...");
    for (const c of corrections) {
      await FoodRestaurant.updateOne(
        { _id: c.id },
        { $set: { zoneId: c.to ? new mongoose.Types.ObjectId(c.to) : null } },
      );
    }
    console.log(`Updated ${corrections.length} restaurant(s).`);
  } finally {
    await disconnectDB();
  }
};

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Backfill failed:", err);
    process.exit(1);
  });
