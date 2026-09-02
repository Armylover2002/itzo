import mongoose from "mongoose";
import { Counter } from "../../../../core/models/counter.model.js";
import { actionPerformerSchema } from "../../../../core/models/actionPerformer.schema.js";

const normalizeRatingValue = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.min(5, Number(numeric.toFixed(1))));
};

const geoPointSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ["Point"], default: "Point" },
    coordinates: {
      type: [Number], // [lng, lat]
      default: undefined,
      validate: {
        validator(v) {
          return (
            !v ||
            (Array.isArray(v) &&
              v.length === 2 &&
              v.every((n) => typeof n === "number" && Number.isFinite(n)))
          );
        },
        message: "location.coordinates must be [lng, lat]",
      },
    },
    // Address fields stored alongside geo so UI can consume a single object.
    latitude: { type: Number },
    longitude: { type: Number },
    formattedAddress: { type: String, trim: true },
    address: { type: String, trim: true },
    addressLine1: { type: String, trim: true },
    addressLine2: { type: String, trim: true },
    area: { type: String, trim: true },
    city: { type: String, trim: true },
    state: { type: String, trim: true },
    pincode: { type: String, trim: true },
    landmark: { type: String, trim: true },
  },
  { _id: false },
);

const restaurantSchema = new mongoose.Schema(
  {
    restaurantId: {
      type: String,
      unique: true,
      trim: true,
    },
    restaurantName: {
      type: String,
      required: true,
      trim: true,
    },
    ownerName: {
      type: String,
      required: true,
      trim: true,
    },
    ownerEmail: {
      type: String,
      trim: true,
    },
    ownerPhone: {
      type: String,
      trim: true,
    },
    // Normalized fields for fast lookup + uniqueness guarantees.
    // These are derived from restaurantName/ownerPhone at write time.
    restaurantNameNormalized: {
      type: String,
      trim: true,
    },
    ownerPhoneDigits: {
      type: String,
      trim: true,
    },
    ownerPhoneLast10: {
      type: String,
      trim: true,
    },
    primaryContactNumber: {
      type: String,
      trim: true,
    },
    pureVegRestaurant: {
      type: Boolean,
      required: true,
      default: false,
    },
    addressLine1: {
      type: String,
    },
    addressLine2: {
      type: String,
    },
    area: {
      type: String,
    },
    city: {
      type: String,
    },
    state: {
      type: String,
    },
    pincode: {
      type: String,
    },
    landmark: {
      type: String,
    },
    cuisines: {
      type: [String],
      default: [],
    },
    openingTime: {
      type: String,
    },
    closingTime: {
      type: String,
    },
    openDays: {
      type: [String],
      default: [],
    } /**
     * Operational toggle controlled by restaurant dashboard.
     * When false, restaurant is shown as offline / not accepting orders even within open hours.
     */,
    isAcceptingOrders: {
      type: Boolean,
      default: true,
      index: true,
    },
    panNumber: {
      type: String,
    },
    nameOnPan: {
      type: String,
    },
    gstRegistered: {
      type: Boolean,
      default: false,
    },
    gstNumber: {
      type: String,
    },
    gstLegalName: {
      type: String,
    },
    gstAddress: {
      type: String,
    },
    fssaiNumber: {
      type: String,
    },
    fssaiExpiry: {
      type: Date,
    },
    accountNumber: {
      type: String,
    },
    ifscCode: {
      type: String,
    },
    accountHolderName: {
      type: String,
    },
    accountType: {
      type: String,
    },
    upiId: {
      type: String,
      trim: true,
    },
    upiQrImage: {
      type: String,
      trim: true,
    },
    menuImages: {
      type: [String],
      default: [],
    },
    coverImages: {
      type: [String],
      default: [],
    },
    profileImage: {
      type: String,
    },
    fcmTokens: {
      type: [String],
      default: [],
    },
    fcmTokenMobile: {
      type: [String],
      default: [],
    },
    /** GeoJSON point used for distance queries. */
    location: {
      type: geoPointSchema,
      default: undefined,
    },
    /** Optional service zone id (can be computed from location). */
    zoneId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "FoodZone",
      index: true,
    },
    businessType: {
      type: String,
      enum: ["Fixed Restaurant", "Street Food Vendor"],
      default: "Fixed Restaurant"
    },
    liveTrackingEnabled: { type: Boolean, default: false },
    lastLocationUpdate: { type: Date },
    locationSource: { type: String, enum: ["gps", "manual"] },
    currentLocation: {
      type: geoPointSchema,
      default: undefined,
    },
    businessModel: {
      type: String,
      trim: true,
    },
    panImage: {
      type: String,
    },
    gstImage: {
      type: String,
    },
    fssaiImage: {
      type: String,
    },
    estimatedDeliveryTime: { type: String },
    /** Numeric delivery time in minutes for filtering/sorting. */
    estimatedDeliveryTimeMinutes: { type: Number, index: true },
    featuredDish: { type: String },
    featuredPrice: { type: Number },
    offer: { type: String },
    /** Rating fields for filtering/sorting (defaults to 0 if never rated). */
    rating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
      index: true,
      set: normalizeRatingValue,
    },
    totalRatings: { type: Number, default: 0, min: 0 },
    diningSettings: {
      isEnabled: { type: Boolean, default: false },
      maxGuests: { type: Number, default: 6 },
      diningType: { type: String, default: "family-dining" },
    },
    menu: {
      sections: { type: Array, default: [] },
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
      index: true,
    },
    approvedAt: { type: Date, default: null },
    rejectedAt: { type: Date, default: null },
    approvedBy: { type: actionPerformerSchema, default: null },
    rejectedBy: { type: actionPerformerSchema, default: null },
    referralCode: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
    },
    referralCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    referredBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "FoodRestaurant",
      index: true,
    },
    rejectionReason: {
      type: String,
      trim: true,
    },
    // Reapplication tracking (mirrors the delivery-partner onboarding flow):
    // a rejected/pending restaurant resubmitting reuses the same record instead
    // of creating a duplicate, so the admin can see it was a re-application.
    applicationType: {
      type: String,
      enum: ["new", "reapplied"],
      default: "new",
    },
    reappliedAt: { type: Date, default: null },
    reapplicationCount: { type: Number, default: 0 },
    previousRejectionReason: { type: String, trim: true },
    reVerification: {
      isZoneUpdate: { type: Boolean, default: false },
      previousAddress: { type: String },
      previousLocation: {
        latitude: { type: Number },
        longitude: { type: Number }
      },
      previousZoneId: { type: mongoose.Schema.Types.ObjectId, ref: 'FoodZone' },
      previousZone: { type: String },
      updatedZone: { type: String },
      reVerificationReason: { type: String, trim: true }
    },
    isDeleted: {
      type: Boolean,
      default: false
    },
    deletionRequest: {
      status: {
          type: String,
          enum: ['none', 'pending', 'approved', 'rejected'],
          default: 'none',
          index: true
      },
      reason: {
          type: String,
          default: '',
          trim: true
      },
      requestedAt: {
          type: Date,
          default: null
      },
      reviewedAt: {
          type: Date,
          default: null
      }
    },
    // HRMS Linkage for KPI and Performance Tracking
    onboardedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'HrmsEmployee',
      index: true,
      default: null
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'HrmsEmployee',
      index: true,
      default: null
    },
    transferHistory: [{
      fromEmployee: { type: mongoose.Schema.Types.ObjectId, ref: 'HrmsEmployee' },
      toEmployee: { type: mongoose.Schema.Types.ObjectId, ref: 'HrmsEmployee' },
      transferredAt: { type: Date, default: Date.now },
      transferredByAdmin: { type: mongoose.Schema.Types.ObjectId, ref: 'FoodAdmin' },
      reason: { type: String, trim: true }
    }]
  },
  {
    collection: 'food_restaurants',
    timestamps: true,
  },
);

restaurantSchema.pre("save", async function (next) {
  if (this.isNew && !this.restaurantId) {
    try {
      const counter = await Counter.findOneAndUpdate(
        { model: "restaurant" },
        { $inc: { seq: 1 } },
        { new: true, upsert: true }
      );
      this.restaurantId = `REST${String(counter.seq).padStart(6, "0")}`;
    } catch (error) {
      return next(error);
    }
  }

  if (!this.referralCode) {
    this.referralCode = this.restaurantId || String(this._id);
  }
  next();
});

restaurantSchema.pre("validate", function normalizeDerivedFields(next) {
  const name =
    typeof this.restaurantName === "string" ? this.restaurantName : "";
  const normalizedName = name.trim().toLowerCase().replace(/\s+/g, " ");
  this.restaurantNameNormalized = normalizedName || undefined;

  const phoneRaw =
    typeof this.ownerPhone === "string" || typeof this.ownerPhone === "number"
      ? String(this.ownerPhone)
      : "";
  const digits = phoneRaw.replace(/\D/g, "").slice(-15); // guard against country prefixes
  this.ownerPhoneDigits = digits || undefined;
  this.ownerPhoneLast10 = digits ? digits.slice(-10) : undefined;

  // Keep `location` in sync when flat address fields exist (backward-compatible migration).
  // Prefer explicit location.* fields if provided.
  const hasAnyFlatAddress =
    this.addressLine1 ||
    this.addressLine2 ||
    this.area ||
    this.city ||
    this.state ||
    this.pincode ||
    this.landmark;
  if (this.location) {
    // If a location object exists but has no usable geo coordinates,
    // keep flat address fields only and drop location to avoid 2dsphere write errors.
    const hasCoordinates =
      Array.isArray(this.location.coordinates) &&
      this.location.coordinates.length === 2 &&
      this.location.coordinates.every(
        (n) => typeof n === "number" && Number.isFinite(n),
      );
    const hasLatLng =
      typeof this.location.latitude === "number" &&
      Number.isFinite(this.location.latitude) &&
      typeof this.location.longitude === "number" &&
      Number.isFinite(this.location.longitude);
    if (!hasCoordinates && !hasLatLng) {
      if (!this.addressLine1 && this.location.addressLine1)
        this.addressLine1 = this.location.addressLine1;
      if (!this.addressLine2 && this.location.addressLine2)
        this.addressLine2 = this.location.addressLine2;
      if (!this.area && this.location.area) this.area = this.location.area;
      if (!this.city && this.location.city) this.city = this.location.city;
      if (!this.state && this.location.state) this.state = this.location.state;
      if (!this.pincode && this.location.pincode)
        this.pincode = this.location.pincode;
      if (!this.landmark && this.location.landmark)
        this.landmark = this.location.landmark;
      this.location = undefined;
    }
  }

  if (this.location) {
    // Sync coords <-> lat/lng
    const lat =
      typeof this.location.latitude === "number"
        ? this.location.latitude
        : undefined;
    const lng =
      typeof this.location.longitude === "number"
        ? this.location.longitude
        : undefined;
    if (
      (!this.location.coordinates || this.location.coordinates.length !== 2) &&
      typeof lng === "number" &&
      typeof lat === "number"
    ) {
      this.location.coordinates = [lng, lat];
    }
    if (
      Array.isArray(this.location.coordinates) &&
      this.location.coordinates.length === 2
    ) {
      const [clng, clat] = this.location.coordinates;
      if (typeof this.location.latitude !== "number" && Number.isFinite(clat))
        this.location.latitude = clat;
      if (typeof this.location.longitude !== "number" && Number.isFinite(clng))
        this.location.longitude = clng;
    }

    // Sync flat -> location for address fields if location fields are empty.
    if (hasAnyFlatAddress) {
      if (!this.location.addressLine1 && this.addressLine1)
        this.location.addressLine1 = this.addressLine1;
      if (!this.location.addressLine2 && this.addressLine2)
        this.location.addressLine2 = this.addressLine2;
      if (!this.location.area && this.area) this.location.area = this.area;
      if (!this.location.city && this.city) this.location.city = this.city;
      if (!this.location.state && this.state) this.location.state = this.state;
      if (!this.location.pincode && this.pincode)
        this.location.pincode = this.pincode;
      if (!this.location.landmark && this.landmark)
        this.location.landmark = this.landmark;
    }
  }

  // Derive estimatedDeliveryTimeMinutes from the human string if not explicitly set.
  // Accepts formats like "25-30 mins", "30 mins", "45".
  if (
    this.estimatedDeliveryTimeMinutes === undefined ||
    this.estimatedDeliveryTimeMinutes === null
  ) {
    const raw =
      typeof this.estimatedDeliveryTime === "string"
        ? this.estimatedDeliveryTime
        : "";
    const match = raw.match(/(\d{1,3})/);
    if (match) {
      const minutes = parseInt(match[1], 10);
      if (Number.isFinite(minutes)) {
        this.estimatedDeliveryTimeMinutes = minutes;
      }
    }
  }
  next();
});

restaurantSchema.index({ ownerPhone: 1 });
restaurantSchema.index({ restaurantName: 1 });
restaurantSchema.index({ restaurantNameNormalized: 1 });
restaurantSchema.index({ city: 1 });
restaurantSchema.index({ "location.city": 1 });
restaurantSchema.index({ location: "2dsphere" });
restaurantSchema.index({ restaurantName: 1, ownerPhone: 1 });
// Enforce uniqueness at the database level to avoid race conditions in registration.
// Uses partial filter to avoid blocking older documents that may not yet have normalized fields.
restaurantSchema.index(
  { restaurantNameNormalized: 1, ownerPhoneLast10: 1 },
  {
    unique: true,
    partialFilterExpression: {
      restaurantNameNormalized: { $type: "string" },
      ownerPhoneLast10: { $type: "string" },
    },
  },
);
restaurantSchema.index({ status: 1, createdAt: -1 });

export const FoodRestaurant = mongoose.model(
  "FoodRestaurant",
  restaurantSchema,
);
