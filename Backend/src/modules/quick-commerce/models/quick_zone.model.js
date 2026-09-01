import mongoose from 'mongoose';

const coordinateSchema = new mongoose.Schema(
  {
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
  },
  { _id: false },
);

const quickZoneSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    zoneName: {
      type: String,
      trim: true,
    },
    country: {
      type: String,
      required: true,
      trim: true,
      default: 'India',
      index: true,
    },
    serviceLocation: {
      type: String,
      trim: true,
    },
    unit: {
      type: String,
      enum: ['kilometer', 'miles'],
      default: 'kilometer',
    },
    /** 'circle' zones were created via distance/radius mode on the map admin UI.
     *  center/radiusMeters are the exact source of truth; `coordinates` below is
     *  still populated (as a polygon approximation) for backward compatibility
     *  with anything that renders/consumes zones as plain polygons. */
    shapeType: {
      type: String,
      enum: ['polygon', 'circle'],
      default: 'polygon',
    },
    center: {
      type: coordinateSchema,
      required: false,
    },
    radiusMeters: {
      type: Number,
      required: false,
    },
    coordinates: {
      type: [coordinateSchema],
      required: true,
      validate: {
        validator(v) {
          return Array.isArray(v) && v.length >= 3;
        },
        message: 'Zone must have at least 3 coordinates (polygon).',
      },
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    collection: 'quick_zone',
    timestamps: true,
  },
);

quickZoneSchema.index({ isActive: 1, name: 1 });
quickZoneSchema.index({ country: 1, name: 1 });

export const QuickZone = mongoose.models.quick_zone || mongoose.model('quick_zone', quickZoneSchema, 'quick_zones');
