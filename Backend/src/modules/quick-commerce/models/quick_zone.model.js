import mongoose from 'mongoose';
import { ValidationError } from '../../../core/auth/errors.js';
import {
  coordinatesToGeoJSONPolygon,
  computePolygonAreaKm2,
  findOverlappingZone,
  ZONE_OVERLAP_MESSAGE,
} from '../../../utils/zoneOverlap.js';

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
    /** Polygon coverage area in km² (computed on save from coordinates). */
    coverageAreaKm2: {
      type: Number,
      default: 0,
      min: 0,
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
    geometry: {
      type: {
        type: String,
        enum: ['Polygon'],
      },
      coordinates: {
        type: [[[Number]]],
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
quickZoneSchema.index({ geometry: '2dsphere' }, { sparse: true });

quickZoneSchema.pre('save', async function saveZoneGeometryAndValidateOverlap(next) {
  try {
    if (this.isNew || this.isModified('coordinates')) {
      const overlapping = await findOverlappingZone(this.constructor, this.coordinates, {
        excludeId: this._id,
        extraFilter: { country: this.country },
      });
      if (overlapping) {
        return next(new ValidationError(ZONE_OVERLAP_MESSAGE));
      }
    }

    if (this.coordinates?.length >= 3) {
      this.geometry = coordinatesToGeoJSONPolygon(this.coordinates);
      this.coverageAreaKm2 =
        Math.round(computePolygonAreaKm2(this.coordinates) * 1000) / 1000;
    }

    return next();
  } catch (error) {
    return next(error);
  }
});

export const QuickZone = mongoose.models.quick_zone || mongoose.model('quick_zone', quickZoneSchema, 'quick_zones');
