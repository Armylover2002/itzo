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

const openingDayTimingSchema = new mongoose.Schema(
  {
    day: { type: String, trim: true },
    isOpen: { type: Boolean, default: true },
    openingTime: { type: String, trim: true },
    closingTime: { type: String, trim: true },
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
    primaryContactNumberDigits: {
      type: String,
      trim: true,
    },
    primaryContactNumberLast10: {
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
    /** When false, customers cannot place scheduled (future-slot) food orders. Missing → treat as true. */
    scheduleOrderEnabled: {
      type: Boolean,
      default: true,
    },
    /**
     * Food Quick Delivery restaurant gate (Phase 2.1).
     * Opt-in. Missing/undefined ⇒ false. Not used by calculateOrder until Phase 2.2+.
     */
    quickDeliveryEnabled: {
      type: Boolean,
      default: false,
      index: true,
    },
    /**
     * Average kitchen preparation minutes for Food Quick ETA only.
     * Does NOT include rider travel or customer delivery time.
     * Null/undefined → platform fee_settings.quickDelivery.defaultKitchenPrepMinutes.
     * Never confused with estimatedDeliveryTime(Minutes) (listing / Basic UX).
     */
    kitchenPrepMinutes: {
      type: Number,
      min: 1,
      max: 90,
      default: undefined,
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
    /**
     * Restaurant business type. "Street Food Vendor" unlocks live-location
     * broadcasting (moving stall) instead of a fixed shop address.
     */
    businessType: {
      type: String,
      enum: ["Fixed Restaurant", "Street Food Vendor"],
      default: "Fixed Restaurant",
      index: true,
    },
    /** Street Food Vendor only: whether the vendor is currently broadcasting live location. */
    liveTrackingEnabled: { type: Boolean, default: false },
    /** Last time currentLocation was updated (GPS ping or manual move). */
    lastLocationUpdate: { type: Date },
    /** How the last location update was captured. */
    locationSource: { type: String, enum: ["gps", "manual"] },
    /** Street Food Vendor only: live/movable position, separate from the permanent `location`. */
    currentLocation: { type: geoPointSchema, default: undefined },

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
    menu: {
      sections: { type: Array, default: [] },
    },
    isListed: {
      type: Boolean,
      default: false,
      index: true,
    },
    showWithoutMenu: {
      type: Boolean,
      default: false,
    },
    productCount: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ["onboarding", "pending", "approved", "rejected"],
      default: "pending",
      index: true,
    },
    /** Next step to show during in-progress onboarding (2–4). Set after each step is saved. */
    onboardingStep: {
      type: Number,
      min: 1,
      max: 5,
      default: 1,
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
    /** Set on first admin approval; never cleared — used to keep panel accessible during re-verification */
    wasEverApproved: {
      type: Boolean,
      default: false,
      index: true,
    },
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
    /**
     * Staged opening-days change awaiting admin re-approval.
     * The live schedule (openDays + outlet timings collection) stays active until
     * the admin approves. This keeps an already-approved restaurant online while a
     * change to which days it is open is reviewed. `proposed*` holds the requested
     * schedule; `previous*` snapshots the live schedule for admin before/after review.
     */
    pendingOpenDays: {
      hasPendingUpdate: { type: Boolean, default: false, index: true },
      proposedOpenDays: { type: [String], default: undefined },
      proposedTimings: {
        type: [openingDayTimingSchema],
        default: undefined,
      },
      previousOpenDays: { type: [String], default: undefined },
      previousTimings: {
        type: [openingDayTimingSchema],
        default: undefined,
      },
      requestedAt: { type: Date },
    },
    /**
     * Staged outlet/profile/bank/location/document changes for already-approved restaurants.
     * Live fields stay unchanged (users keep seeing the old approved details) until admin
     * applies `proposed`. Never demotes `status` away from approved during re-verification.
     */
    pendingProfileChanges: {
      hasPendingUpdate: { type: Boolean, default: false, index: true },
      proposed: { type: mongoose.Schema.Types.Mixed, default: undefined },
      previous: { type: mongoose.Schema.Types.Mixed, default: undefined },
      changeTypes: { type: [String], default: undefined },
      reason: { type: String, trim: true, default: '' },
      requestedAt: { type: Date },
    },
    commissionPercentage: {
      type: Number,
      default: 15,
      min: 0,
      max: 100
    },
    isDeleted: {
      type: Boolean,
      default: false
    },
    accountStatus: {
      type: String,
      enum: ['active', 'deleted'],
      default: 'active'
    },
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

  // Normalize primary contact number
  const primaryContactRaw =
    typeof this.primaryContactNumber === "string" || typeof this.primaryContactNumber === "number"
      ? String(this.primaryContactNumber)
      : "";
  const primaryDigits = primaryContactRaw.replace(/\D/g, "").slice(-15);
  this.primaryContactNumberDigits = primaryDigits || undefined;
  this.primaryContactNumberLast10 = primaryDigits ? primaryDigits.slice(-10) : undefined;

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
// Unique index for owner phone last 10 digits
restaurantSchema.index(
  { ownerPhoneLast10: 1 },
  {
    unique: true,
    partialFilterExpression: {
      ownerPhoneLast10: { $type: "string" },
    },
  },
);
// Unique index for primary contact number last 10 digits
restaurantSchema.index(
  { primaryContactNumberLast10: 1 },
  {
    unique: true,
    partialFilterExpression: {
      primaryContactNumberLast10: { $type: "string" },
    },
  },
);
restaurantSchema.index({ status: 1, createdAt: -1 });

export const FoodRestaurant = mongoose.model(
  "FoodRestaurant",
  restaurantSchema,
);
