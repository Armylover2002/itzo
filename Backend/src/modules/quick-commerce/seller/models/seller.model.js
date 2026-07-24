import mongoose from "mongoose";

const sellerLocationSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ["Point"], default: "Point" },
    coordinates: {
      type: [Number],
      default: undefined,
      validate: {
        validator(value) {
          return (
            !value ||
            (Array.isArray(value) &&
              value.length === 2 &&
              value.every((item) => Number.isFinite(Number(item))))
          );
        },
        message: "location.coordinates must be [lng, lat]",
      },
    },
    latitude: { type: Number },
    longitude: { type: Number },
    formattedAddress: { type: String, trim: true },
    address: { type: String, trim: true },
  },
  { _id: false },
);

const sellerBankInfoSchema = new mongoose.Schema(
  {
    bankName: { type: String, trim: true, default: "" },
    accountHolderName: { type: String, trim: true, default: "" },
    accountNumber: { type: String, trim: true, default: "" },
    ifscCode: { type: String, trim: true, uppercase: true, default: "" },
    accountType: { type: String, trim: true, default: "" },
    upiId: { type: String, trim: true, default: "" },
    upiQrImage: { type: String, trim: true, default: "" },
  },
  { _id: false },
);

const sellerDocumentsSchema = new mongoose.Schema(
  {
    panNumber: { type: String, trim: true, uppercase: true, default: "" },
    panImage: { type: String, trim: true, default: "" },
    gstRegistered: { type: Boolean, default: false },
    gstNumber: { type: String, trim: true, uppercase: true, default: "" },
    gstLegalName: { type: String, trim: true, default: "" },
    gstImage: { type: String, trim: true, default: "" },
    fssaiNumber: { type: String, trim: true, default: "" },
    fssaiImage: { type: String, trim: true, default: "" },
    fssaiExpiry: { type: Date, default: null },
    shopLicenseNumber: { type: String, trim: true, default: "" },
    shopLicenseImage: { type: String, trim: true, default: "" },
    shopLicenseExpiry: { type: Date, default: null },
    isDocumentsVerified: { type: Boolean, default: false },
  },
  { _id: false },
);

const sellerShopInfoSchema = new mongoose.Schema(
  {
    businessType: { type: String, trim: true, default: "" },
    alternatePhone: { type: String, trim: true, default: "" },
    supportEmail: { type: String, trim: true, lowercase: true, default: "" },
    openingHours: { type: String, trim: true, default: "" },
    zoneId: { type: mongoose.Schema.Types.ObjectId, default: null },
    zoneSource: { type: String, enum: ["food", "quick", ""], default: "" },
    zoneName: { type: String, trim: true, default: "" },
  },
  { _id: false },
);

const sellerSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    shopName: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: "",
    },
    phone: {
      type: String,
      required: true,
      trim: true,
    },
    phoneDigits: {
      type: String,
      trim: true,
    },
    phoneLast10: {
      type: String,
      trim: true,
    },
    role: {
      type: String,
      default: "SELLER",
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    approved: {
      type: Boolean,
      default: true,
    },
    approvalStatus: {
      type: String,
      enum: ["draft", "pending", "approved", "rejected"],
      default: "approved",
    },
    onboardingSubmitted: {
      type: Boolean,
      default: false,
    },
    approvalNotes: {
      type: String,
      trim: true,
      default: "",
    },
    approvedAt: {
      type: Date,
      default: null,
    },
    rejectedAt: {
      type: Date,
      default: null,
    },
    location: {
      type: sellerLocationSchema,
      default: undefined,
    },
    serviceRadius: {
      type: Number,
      default: 5,
      min: 1,
      max: 100,
    },
    bankInfo: {
      type: sellerBankInfoSchema,
      default: () => ({}),
    },
    documents: {
      type: sellerDocumentsSchema,
      default: () => ({}),
    },
    shopInfo: {
      type: sellerShopInfoSchema,
      default: () => ({}),
    },
    lastLogin: {
      type: Date,
      default: null,
    },
  },
  {
    collection: 'quick_seller_profiles',
    timestamps: true,
  },
);

sellerSchema.pre("validate", function normalizeSeller(next) {
  const phoneRaw =
    typeof this.phone === "string" || typeof this.phone === "number"
      ? String(this.phone)
      : "";
  const digits = phoneRaw.replace(/\D/g, "").slice(-15);
  this.phoneDigits = digits || undefined;
  this.phoneLast10 = digits ? digits.slice(-10) : undefined;

  if (this.email) {
    this.email = String(this.email).trim().toLowerCase();
  }

  if (this.bankInfo) {
    if (this.bankInfo.accountNumber) {
      this.bankInfo.accountNumber = String(this.bankInfo.accountNumber)
        .replace(/\s|-/g, "")
        .trim();
    }
    if (this.bankInfo.ifscCode) {
      this.bankInfo.ifscCode = String(this.bankInfo.ifscCode)
        .trim()
        .toUpperCase();
    }
    if (this.bankInfo.upiId) {
      this.bankInfo.upiId = String(this.bankInfo.upiId).trim();
    }
  }

  if (this.documents) {
    if (this.documents.panNumber) {
      this.documents.panNumber = String(this.documents.panNumber)
        .trim()
        .toUpperCase();
    }
    if (this.documents.gstNumber) {
      this.documents.gstNumber = String(this.documents.gstNumber)
        .trim()
        .toUpperCase();
    }
  }

  if (this.shopInfo?.supportEmail) {
    this.shopInfo.supportEmail = String(this.shopInfo.supportEmail)
      .trim()
      .toLowerCase();
  }

  if (this.location) {
    const lat =
      typeof this.location.latitude === "number"
        ? this.location.latitude
        : undefined;
    const lng =
      typeof this.location.longitude === "number"
        ? this.location.longitude
        : undefined;

    if (
      (!Array.isArray(this.location.coordinates) ||
        this.location.coordinates.length !== 2) &&
      Number.isFinite(lat) &&
      Number.isFinite(lng)
    ) {
      this.location.coordinates = [lng, lat];
    }

    if (
      Array.isArray(this.location.coordinates) &&
      this.location.coordinates.length === 2
    ) {
      const [coordLng, coordLat] = this.location.coordinates;
      if (
        typeof this.location.latitude !== "number" &&
        Number.isFinite(coordLat)
      ) {
        this.location.latitude = coordLat;
      }
      if (
        typeof this.location.longitude !== "number" &&
        Number.isFinite(coordLng)
      ) {
        this.location.longitude = coordLng;
      }
    }
  }

  next();
});

sellerSchema.index({ phoneDigits: 1 }, { unique: true, sparse: true });
sellerSchema.index({ phoneLast10: 1 });
sellerSchema.index({ email: 1 }, { unique: true, sparse: true });
sellerSchema.index({ location: "2dsphere" });

export const Seller = mongoose.model('Seller', sellerSchema, 'quick_sellers');
