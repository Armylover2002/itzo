import crypto from "crypto";
import ms from "ms";
import { FoodUser } from "../users/user.model.js";
import { FoodAdmin } from "../admin/admin.model.js";
import { AdminResetOtp } from "../admin/adminResetOtp.model.js";
import { FoodRestaurant } from "../../modules/food/restaurant/models/restaurant.model.js";
import { FoodDeliveryPartner } from "../../modules/food/delivery/models/deliveryPartner.model.js";
import { Seller } from "../../modules/quick-commerce/seller/models/seller.model.js";

import { FoodReferralSettings } from "../../modules/food/admin/models/referralSettings.model.js";
import { FoodReferralLog } from "../../modules/food/admin/models/referralLog.model.js";
import { FoodUserWallet } from "../../modules/food/user/models/userWallet.model.js";
import { createOrUpdateOtp, verifyOtp, deleteOtp } from "../otp/otp.service.js";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "./token.util.js";
import { FoodRefreshToken } from "../refreshTokens/refreshToken.model.js";
import { ValidationError, AuthError, NotFoundError } from "./errors.js";
import { config } from "../../config/env.js";
import { logger } from "../../utils/logger.js";
import { sendAdminResetOtpEmail } from "../../utils/email.js";
import mongoose from "mongoose";
import { AdminRole } from "../admin/role.model.js";
import { creditReferralReward } from "../../modules/food/user/services/userWallet.service.js";

const ROLES = {
  USER: "USER",
  RESTAURANT: "RESTAURANT",
  DELIVERY_PARTNER: "DELIVERY_PARTNER",
  ADMIN: "ADMIN",
  SELLER: "SELLER",
};

const normalizeRolePermissions = (permissions) => {
  if (!permissions) return {};

  if (permissions instanceof Map) {
    return Object.fromEntries(permissions.entries());
  }

  if (typeof permissions.toObject === "function") {
    return permissions.toObject();
  }

  if (typeof permissions === "object") {
    return permissions;
  }

  return {};
};

const normalizeAdminProfile = (adminDoc) => {
  if (!adminDoc) return null;

  const profile = typeof adminDoc.toObject === "function"
    ? adminDoc.toObject()
    : { ...adminDoc };

  if (profile?.adminRoleId && typeof profile.adminRoleId === "object") {
    profile.adminRoleId = {
      ...profile.adminRoleId,
      permissions: normalizeRolePermissions(profile.adminRoleId.permissions),
    };
  }

  return profile;
};

const getAdminProfileDocument = (adminId) =>
  FoodAdmin.findById(adminId)
    .select("-password")
    .populate("adminRoleId")
    .lean();

const getResolvedUserWalletBalance = async (userId, fallbackBalance = 0) => {
  const wallet = await FoodUserWallet.findOne({ userId })
    .select("balance")
    .lean();

  if (wallet) {
    return Math.max(0, Number(wallet.balance) || 0);
  }

  return Math.max(0, Number(fallbackBalance) || 0);
};

export const requestUserOtp = async (phone) => {
  if (!phone) {
    throw new ValidationError("Phone is required");
  }

  // Strict Indian mobile number validation: 10 digits, starting with 6, 7, 8, or 9.
  // Also accepts numbers prefixed with +91 or 91.
  const digits = String(phone).replace(/^\+?91/, "").replace(/\D/g, "");
  const INDIAN_MOBILE_REGEX = /^[6-9]\d{9}$/;
  if (!INDIAN_MOBILE_REGEX.test(digits)) {
    throw new ValidationError("Please enter a valid 10-digit Indian mobile number starting with 6, 7, 8, or 9.");
  }

  // Block OTP generation for deleted users
  const user = await FoodUser.findOne({ phone: digits, role: 'USER' }).select('isDeleted').lean();
  if (user && user.isDeleted) {
    const err = new AuthError("Your account has been deleted.");
    err.code = "ACCOUNT_DELETED";
    throw err;
  }

  const otp = await createOrUpdateOtp(digits);
  // TODO: integrate SMS provider here
  const shouldExposeOtp =
    config.nodeEnv !== "production" || config.useDefaultOtp;

  return shouldExposeOtp ? { otp } : {};
};


export const requestAccountRecovery = async (phone) => {
  const normalizedPhone = String(phone).replace(/^\+?91/, "").replace(/\D/g, "");
  const user = await FoodUser.findOne({ phone: normalizedPhone, role: 'USER' });
  
  if (!user) {
    throw new NotFoundError("User not found");
  }

  if (!user.isDeleted) {
    throw new ValidationError("Account is not deleted");
  }

  user.deletionRequest = {
    status: 'recovery_pending',
    reason: user.deletionRequest?.reason || 'User requested account deletion',
    requestedAt: user.deletionRequest?.requestedAt || new Date(),
    reviewedAt: null
  };

  await user.save();
  return { success: true, message: "Recovery request submitted successfully" };
};

export const verifyUserOtpAndLogin = async (
  phone,
  otp,
  ref,
  fcmToken,
  platform,
  name,
) => {
  // Normalize to 10-digit format (same as requestUserOtp)
  const normalizedPhone = String(phone).replace(/^\+?91/, "").replace(/\D/g, "");

  const result = await verifyOtp(normalizedPhone, otp, { keepOnSuccess: true });

  if (!result.valid) {
    throw new AuthError(result.reason || "OTP verification failed");
  }

  let userDoc = await FoodUser.findOne({ phone: normalizedPhone });
  
  // Ensure user exists and mark as verified on successful OTP.
  // Check if user is new or hasn't provided a name yet
  const needsNamePrompt = !userDoc || !userDoc.name || String(userDoc.name).trim() === "" || String(userDoc.name).toLowerCase() === "null";
  const isNewUser = needsNamePrompt;
  const trimmedName = typeof name === "string" ? name.trim() : "";


  if (!userDoc) {
    userDoc = await FoodUser.create({
      phone: normalizedPhone,
      isVerified: true,
      ...(trimmedName ? { name: trimmedName } : {}),
    });
  } else {
    let needsSave = false;
    if (!userDoc.isVerified) {
      userDoc.isVerified = true;
      needsSave = true;
    }
    if (trimmedName && !userDoc.name) {
      userDoc.name = trimmedName;
      needsSave = true;
    }
    if (needsSave) await userDoc.save();
  }

  // Block login for deleted users
  if (userDoc.isDeleted) {
    const err = new AuthError("Your account has been deleted.");
    err.code = "ACCOUNT_DELETED";
    throw err;
  }

  // Block login for deactivated users
  if (userDoc.isActive === false) {
    const err = new AuthError("Your account has been deactivated. Please contact support.");
    err.code = "ACCOUNT_DEACTIVATED";
    throw err;
  }

  // Account is active and not deleted, so we can consume the OTP
  await deleteOtp(normalizedPhone);

  // Update FCM token if provided
  if (fcmToken) {
    let isModified = false;
    if (platform === "mobile") {
      if (!userDoc.fcmTokenMobile) userDoc.fcmTokenMobile = [];
      if (!userDoc.fcmTokenMobile.includes(fcmToken)) {
        userDoc.fcmTokenMobile.push(fcmToken);
        isModified = true;
      }
    } else {
      // Default to web if not explicitly mobile
      if (!userDoc.fcmTokens) userDoc.fcmTokens = [];
      if (!userDoc.fcmTokens.includes(fcmToken)) {
        userDoc.fcmTokens.push(fcmToken);
        isModified = true;
      }
    }
    if (isModified) {
      await userDoc.save();
    }
  }

  // Ensure referralCode exists (used for share links on older accounts).
  if (!userDoc.referralCode) {
    userDoc.referralCode = String(userDoc._id);
    await userDoc.save();
  }

  // Referral crediting: only for brand new accounts.
  const refRaw = typeof ref === "string" ? String(ref).trim() : "";
  if (isNewUser && refRaw) {
    try {
      if (mongoose.Types.ObjectId.isValid(refRaw)) {
        const referrerId = new mongoose.Types.ObjectId(refRaw);
        if (String(referrerId) !== String(userDoc._id)) {
          const [referrer, settingsDoc] = await Promise.all([
            FoodUser.findById(referrerId).select("_id referralCount").lean(),
            FoodReferralSettings.findOne({ isActive: true })
              .sort({ createdAt: -1 })
              .lean(),
          ]);

          if (referrer && settingsDoc) {
            const referrerReward = Math.max(0, Number(settingsDoc.user?.referrerReward) || 0);
            const refereeReward = Math.max(0, Number(settingsDoc.user?.refereeReward) || 0);
            const limit = Math.max(0, Number(settingsDoc.user?.limit) || 0);

            if (
              (referrerReward > 0 || refereeReward > 0) &&
              limit > 0 &&
              Number(referrer.referralCount || 0) < limit
            ) {
              userDoc.referredBy = referrerId;
              await userDoc.save();

              const log = await FoodReferralLog.create({
                referrerId,
                refereeId: userDoc._id,
                role: "USER",
                rewardAmount: referrerReward,
                referrerRewardAmount: referrerReward,
                refereeRewardAmount: refereeReward,
                status: "credited",
              });

              await Promise.all([
                FoodUser.updateOne(
                  { _id: referrerId },
                  { $inc: { referralCount: 1 } },
                ),
                // Credit Referrer
                referrerReward > 0 ? creditReferralReward(referrerId, referrerReward, {
                  role: "USER",
                  refereeId: String(userDoc._id),
                  referralLogId: String(log._id),
                  type: "referrer_reward"
                }) : Promise.resolve(),
                // Credit Referee (New User)
                refereeReward > 0 ? creditReferralReward(userDoc._id, refereeReward, {
                  role: "USER",
                  referrerId: String(referrerId),
                  referralLogId: String(log._id),
                  type: "referee_reward"
                }) : Promise.resolve(),
              ]);
            } else {
              await FoodReferralLog.create({
                referrerId,
                refereeId: userDoc._id,
                role: "USER",
                rewardAmount: referrerReward,
                status: "rejected",
                reason:
                  (referrerReward <= 0 && refereeReward <= 0)
                    ? "reward_disabled"
                    : limit <= 0
                      ? "limit_disabled"
                      : "limit_reached",
              });
            }
          }
        }
      }
    } catch (e) {
      // Never fail login due to referral errors.
      logger?.warn?.({ err: e }, "Referral crediting failed (user)");
    }
  }

  const user = {
    ...userDoc.toObject(),
    walletBalance: await getResolvedUserWalletBalance(
      userDoc._id,
      userDoc.walletBalance,
    ),
  };
  const payload = { userId: user._id.toString(), role: user.role || "USER" };

  const accessToken = signAccessToken(payload);
  const refreshToken = signRefreshToken(payload);

  const ttlMs = ms(config.jwtRefreshExpiresIn || "7d");
  const expiresAt = new Date(Date.now() + ttlMs);

  await FoodRefreshToken.create({
    userId: user._id,
    token: refreshToken,
    expiresAt,
  });

  return { accessToken, refreshToken, user, isNewUser };
};

export const adminLogin = async (email, password, roleId) => {
  if (!email || !password) {
    throw new ValidationError("Email and password are required");
  }

  const admin = await FoodAdmin.findOne({ email }).populate('adminRoleId');
  if (!admin) {
    throw new AuthError("Invalid credentials");
  }

  const isMatch = await admin.comparePassword(password);
  if (!isMatch) {
    throw new AuthError("Invalid credentials");
  }

  if (roleId) {
    if (roleId === 'ADMIN' && admin.role !== 'ADMIN') {
      throw new AuthError("Please select the correct role for this account.");
    }
    if (roleId !== 'ADMIN') {
      if (admin.role !== 'EMPLOYEE') {
        throw new AuthError("Please select the correct role for this account.");
      }
      if (admin.adminRoleId && String(admin.adminRoleId._id) !== roleId) {
        throw new AuthError("Please select the correct role for this account.");
      }
    }
  }

  const payload = { userId: admin._id.toString(), role: admin.role };

  const accessToken = signAccessToken(payload);
  const refreshToken = signRefreshToken(payload);

  const ttlMs = ms(config.jwtRefreshExpiresIn || "7d");
  const expiresAt = new Date(Date.now() + ttlMs);

  await FoodRefreshToken.create({
    userId: admin._id,
    token: refreshToken,
    expiresAt,
  });

  const userObj = normalizeAdminProfile(admin);
  delete userObj.password;
  return { accessToken, refreshToken, user: userObj };
};

export const getPublicRoles = async () => {
  const roles = await AdminRole.find({ status: 'active' }).select('_id roleName').lean();
  return roles;
};

export const requestRestaurantOtp = async (phone) => {
  if (!phone) {
    throw new ValidationError("Phone is required");
  }
  const otp = await createOrUpdateOtp(phone);
  const shouldExposeOtp =
    config.nodeEnv !== "production" || config.useDefaultOtp;

  return shouldExposeOtp ? { otp } : {};
};

export const verifyRestaurantOtpAndLogin = async (phone, otp, fcmToken, platform) => {
  const result = await verifyOtp(phone, otp);
  if (!result.valid) {
    throw new AuthError(result.reason || "OTP verification failed");
  }

  // Restaurants may store ownerPhone with country code or formatting.
  // Match by exact phone, last-10 digits, or suffix match to avoid false "needsRegistration".
  const digits = String(phone || "").replace(/\D/g, "");
  const last10 = digits.slice(-10);
  const phoneCandidates = [phone, digits, last10].filter(Boolean);
  const phoneOrFields = (field) => [
    { [field]: { $in: phoneCandidates } },
    ...(last10 ? [{ [field]: { $regex: new RegExp(last10 + "$") } }] : []),
  ];

  const restaurant = await FoodRestaurant.findOne({
    $or: [
      ...phoneOrFields("ownerPhone"),
      ...phoneOrFields("primaryContactNumber"),
    ],
  });
  if (!restaurant) {
    // Phone has been successfully verified, but no restaurant exists yet.
    // Frontend will use this to redirect into registration/onboarding.
    return {
      needsRegistration: true,
      phone,
    };
  }

  // Update FCM token if provided
  if (fcmToken) {
    let isModified = false;
    if (platform === "mobile") {
      if (!restaurant.fcmTokenMobile) restaurant.fcmTokenMobile = [];
      if (!restaurant.fcmTokenMobile.includes(fcmToken)) {
        restaurant.fcmTokenMobile.push(fcmToken);
        isModified = true;
      }
    } else {
      if (!restaurant.fcmTokens) restaurant.fcmTokens = [];
      if (!restaurant.fcmTokens.includes(fcmToken)) {
        restaurant.fcmTokens.push(fcmToken);
        isModified = true;
      }
    }
    if (isModified) {
      await restaurant.save();
    }
  }

  // Block login for deleted restaurants
  if (restaurant.isDeleted) {
    throw new AuthError(
      "Your account has been deleted by admin. Please contact support.",
    );
  }

  // If restaurant approval status is used, only allow login for approved restaurants.
  if (restaurant.status && restaurant.status !== "approved") {
    const isRejected = restaurant.status === "rejected";
    return {
      pendingApproval: true,
      isRejected,
      rejectionReason: isRejected ? restaurant.rejectionReason : null,
      message:
        isRejected
          ? (restaurant.rejectionReason 
              ? `Your account was rejected: ${restaurant.rejectionReason}`
              : "Your restaurant registration has been rejected. Please contact support.")
          : "Your restaurant registration is pending approval.",
    };
  }

  const payload = { userId: restaurant._id.toString(), role: ROLES.RESTAURANT };
  const accessToken = signAccessToken(payload);
  const refreshToken = signRefreshToken(payload);
  const ttlMs = ms(config.jwtRefreshExpiresIn || "7d");
  const expiresAt = new Date(Date.now() + ttlMs);

  await FoodRefreshToken.create({
    userId: restaurant._id,
    token: refreshToken,
    expiresAt,
  });

  return {
    accessToken,
    refreshToken,
    user: restaurant,
    needsRegistration: false,
  };
};

export const requestDeliveryOtp = async (phone) => {
  if (!phone) {
    throw new ValidationError("Phone is required");
  }
  const otp = await createOrUpdateOtp(phone);
  // Only expose OTP in response when in default/dev mode — never in production with real SMS
  const shouldExposeOtp =
    config.nodeEnv !== "production" || config.useDefaultOtp;

  return shouldExposeOtp ? { otp } : {};
};

const getPhoneCandidates = (phone) => {
  const raw = String(phone || "").trim();
  const digits = raw.replace(/\D/g, "");
  const last10 = digits.slice(-10);

  return Array.from(new Set([
    raw,
    digits,
    last10,
    digits ? `+${digits}` : "",
    last10 ? `+91${last10}` : "",
    last10 ? `91${last10}` : "",
  ].filter(Boolean)));
};







const normalizePhoneForDelivery = (phone) => {
  const digits = String(phone || "").replace(/\D/g, "");
  return digits.slice(-10) || null;
};

export const verifyDeliveryOtpAndLogin = async (phone, otp, fcmToken, platform) => {
  const result = await verifyOtp(phone, otp);
  if (!result.valid) {
    throw new AuthError(result.reason || "OTP verification failed");
  }

  const normalized = normalizePhoneForDelivery(phone);
  if (!normalized) {
    return { needsRegistration: true, phone };
  }

  const deliveryPartner = await FoodDeliveryPartner.findOne({
    $or: [
      { phone: normalized },
      { phone: { $regex: new RegExp(normalized + "$") } },
    ],
  });

  if (!deliveryPartner) {
    return { needsRegistration: true, phone };
  }

  if (deliveryPartner.isActive === false) {
    throw new AuthError(
      "Your delivery account has been deactivated by admin. Please contact support.",
    );
  }

  if (deliveryPartner.isDeleted) {
    throw new AuthError(
      "Your account has been deleted by admin. Please contact support for more information.",
    );
  }

  // Update FCM token if provided - CRITICAL: do this BEFORE returning pendingApproval
  // so we can notify them when approved.
  if (fcmToken) {
    let isModified = false;
    if (platform === "mobile") {
      if (!deliveryPartner.fcmTokenMobile) deliveryPartner.fcmTokenMobile = [];
      if (!deliveryPartner.fcmTokenMobile.includes(fcmToken)) {
        deliveryPartner.fcmTokenMobile.push(fcmToken);
        isModified = true;
      }
    } else {
      if (!deliveryPartner.fcmTokens) deliveryPartner.fcmTokens = [];
      if (!deliveryPartner.fcmTokens.includes(fcmToken)) {
        deliveryPartner.fcmTokens.push(fcmToken);
        isModified = true;
      }
    }
    if (isModified) {
      await deliveryPartner.save();
    }
  }

  if (deliveryPartner.status && deliveryPartner.status !== "approved") {
    const isRejected = deliveryPartner.status === "rejected";
    return {
      pendingApproval: true,
      isRejected,
      rejectionReason: isRejected ? deliveryPartner.rejectionReason : null,
      message:
        isRejected
          ? (deliveryPartner.rejectionReason 
              ? `Your account was rejected: ${deliveryPartner.rejectionReason}`
              : "Your delivery account was not approved. Please contact support.")
          : "Your account is pending admin verification. You will be notified once approved.",
    };
  }

  const payload = {
    userId: deliveryPartner._id.toString(),
    role: ROLES.DELIVERY_PARTNER,
  };
  const accessToken = signAccessToken(payload);
  const refreshToken = signRefreshToken(payload);
  const ttlMs = ms(config.jwtRefreshExpiresIn || "7d");
  const expiresAt = new Date(Date.now() + ttlMs);

  await FoodRefreshToken.create({
    userId: deliveryPartner._id,
    token: refreshToken,
    expiresAt,
  });

  return {
    accessToken,
    refreshToken,
    user: deliveryPartner,
    needsRegistration: false,
  };
};

export const logout = async (refreshToken, fcmToken, platform) => {
  if (!refreshToken) {
    throw new ValidationError("Refresh token is required");
  }

  // 1. Remove specific FCM token from ALL collections if provided
  if (fcmToken) {
    console.log(`[FCM-Logout] Starting logout-driven token removal: platform=${platform}, tokenPreview=${fcmToken?.slice(0, 10)}...`);
    
    // We try to remove the token from all 4 possible models regardless of the user ID, 
    // ensuring no stale connections are left across any role or app the user was logged into.
    const field = platform === "mobile" ? "fcmTokenMobile" : "fcmTokens";
    const models = [FoodUser, FoodRestaurant, FoodDeliveryPartner, FoodAdmin];
    
    try {
      await Promise.all(
        models.map((model) =>
          model.updateMany(
            { [field]: fcmToken },
            { $pull: { [field]: fcmToken } },
          ),
        ),
      );
      console.log("[FCM-Logout] Token removed from all collections successfully");
    } catch (err) {
      logger.warn({ err }, "Failed to remove FCM token from all collections during logout");
    }
  }

  // 2. Invalidate the refresh token (standard logout procedure)
  const deleted = await FoodRefreshToken.deleteOne({ token: refreshToken });
  return { invalidated: deleted.deletedCount > 0 };
};

export const logoutAll = async (refreshToken, fcmToken, platform) => {
  if (!refreshToken) {
    throw new ValidationError("Refresh token is required");
  }

  // 1. Identify the user from the refresh token
  let userId;
  try {
    const decoded = verifyRefreshToken(refreshToken);
    userId = decoded.userId;
  } catch (err) {
    // If token is invalid or expired, we might still want to try finding it in DB to get the userId
    const storedToken = await FoodRefreshToken.findOne({ token: refreshToken }).select('userId').lean();
    if (storedToken) {
      userId = storedToken.userId;
    }
  }

  if (!userId) {
    // If we still can't find the userId, just perform a normal logout (cleanup FCM + current token)
    return logout(refreshToken, fcmToken, platform);
  }

  // 2. Cleanup FCM token globally if provided
  if (fcmToken) {
    const field = platform === "mobile" ? "fcmTokenMobile" : "fcmTokens";
    const models = [FoodUser, FoodRestaurant, FoodDeliveryPartner, FoodAdmin];
    try {
      await Promise.all(
        models.map((model) =>
          model.updateMany(
            { [field]: fcmToken },
            { $pull: { [field]: fcmToken } },
          ),
        ),
      );
    } catch (err) {
      logger.warn({ err }, "Failed to remove FCM token during logoutAll");
    }
  }

  // 3. Delete ALL refresh tokens for this user
  const deleted = await FoodRefreshToken.deleteMany({ userId });
  return { invalidatedCount: deleted.deletedCount, success: true };
};

export const getProfile = async (userId, role) => {
  if (!userId || !role) {
    throw new AuthError("Invalid token payload");
  }
  let profile = null;
  const id = userId;
  const normalizedRole = String(role || "USER").toUpperCase();

  switch (normalizedRole) {
    case ROLES.USER:
    case "CUSTOMER":
    case "FOOD_USER": {
      const userProfile = await FoodUser.findById(id).lean();
      if (!userProfile) break;
      profile = {
        ...userProfile,
        walletBalance: await getResolvedUserWalletBalance(
          userProfile._id,
          userProfile.walletBalance,
        ),
      };
    }
      break;
    case ROLES.ADMIN:
    case "EMPLOYEE":
    case "HRMS_EMPLOYEE":
    case "HRMS":
      profile = normalizeAdminProfile(await getAdminProfileDocument(id));
      break;
    case ROLES.RESTAURANT:
      {
        const doc = await FoodRestaurant.findById(id).lean();
        if (!doc) break;

        const location =
          doc.addressLine1 ||
          doc.addressLine2 ||
          doc.area ||
          doc.city ||
          doc.state ||
          doc.pincode ||
          doc.landmark
            ? {
                addressLine1: doc.addressLine1 || "",
                addressLine2: doc.addressLine2 || "",
                area: doc.area || "",
                city: doc.city || "",
                state: doc.state || "",
                pincode: doc.pincode || "",
                landmark: doc.landmark || "",
              }
            : null;

        const menuImages = Array.isArray(doc.menuImages)
          ? doc.menuImages
              .map((m) => (m && (typeof m === "string" ? m : m.url)) || null)
              .filter(Boolean)
              .map((url) => ({ url, publicId: null }))
          : [];

        profile = {
          id: doc._id,
          _id: doc._id,
          // Frontend expects "name" and "location" for restaurant screens.
          name: doc.restaurantName || "",
          restaurantName: doc.restaurantName || "",
          cuisines: Array.isArray(doc.cuisines) ? doc.cuisines : [],
          location,
          ownerName: doc.ownerName || "",
          ownerEmail: doc.ownerEmail || "",
          ownerPhone: doc.ownerPhone || "",
          primaryContactNumber: doc.primaryContactNumber || "",
          profileImage: doc.profileImage ? { url: doc.profileImage } : null,
          menuImages,
          coverImages: [],
          openingTime: doc.openingTime || null,
          closingTime: doc.closingTime || null,
          openDays: Array.isArray(doc.openDays) ? doc.openDays : [],
          status: doc.status || null,
          createdAt: doc.createdAt,
          updatedAt: doc.updatedAt,
          // These fields may not exist yet in DB, keep stable defaults for UI.
          rating: typeof doc.rating === "number" ? doc.rating : 0,
          totalRatings:
            typeof doc.totalRatings === "number" ? doc.totalRatings : 0,
        };
      }
      break;
    case ROLES.DELIVERY_PARTNER:
    case "DELIVERY": {
      const partner = await FoodDeliveryPartner.findById(id).lean();
      if (!partner) break;
      const deliveryId = partner._id
        ? `DP-${partner._id.toString().slice(-8).toUpperCase()}`
        : null;
      profile = {
        ...partner,
        email: partner.email || null,
        deliveryId,
        status: partner.status === "rejected" ? "blocked" : partner.status,
        profileImage: partner.profilePhoto
          ? { url: partner.profilePhoto }
          : null,
        documents: {
          aadhar:
            partner.aadharPhoto || partner.aadharNumber
              ? {
                  number: partner.aadharNumber || null,
                  document: partner.aadharPhoto || null,
                }
              : null,
          pan:
            partner.panPhoto || partner.panNumber
              ? {
                  number: partner.panNumber || null,
                  document: partner.panPhoto || null,
                }
              : null,
          drivingLicense: partner.drivingLicensePhoto || partner.drivingLicenseNumber
            ? {
                number: partner.drivingLicenseNumber || null,
                document: partner.drivingLicensePhoto || null,
              }
            : null,
          bankDetails:
            partner.bankAccountHolderName ||
            partner.bankAccountNumber ||
            partner.bankIfscCode ||
            partner.bankName ||
            partner.upiId ||
            partner.upiQrCode
              ? {
                  accountHolderName: partner.bankAccountHolderName || null,
                  accountNumber: partner.bankAccountNumber || null,
                  ifscCode: partner.bankIfscCode || null,
                  bankName: partner.bankName || null,
                  upiId: partner.upiId || null,
                  upiQrCode: partner.upiQrCode || null,
                }
              : null,
        },
        location:
          partner.address || partner.city || partner.state
            ? {
                addressLine1: partner.address,
                city: partner.city,
                state: partner.state,
              }
            : null,
        vehicle:
          partner.vehicleType || partner.vehicleName || partner.vehicleNumber
            ? {
                type: partner.vehicleType,
                brand: partner.vehicleName,
                model: partner.vehicleName,
                number: partner.vehicleNumber,
              }
            : null,
      };
      break;
    }

    case ROLES.SELLER: {
      const seller = await Seller.findById(id).lean();
      if (!seller) break;

      profile = {
        ...seller,
        name: seller.name || "Seller",
        shopName: seller.shopName || seller.name || "Store",
        phone: seller.phoneLast10 || seller.phone || "",
        email: seller.email || "",
        role: "seller",
        location: seller.location || null,
        serviceRadius:
          typeof seller.serviceRadius === "number" ? seller.serviceRadius : 5,
        isVerified: seller.isVerified !== false,
        isActive: seller.isActive !== false,
        approved: seller.approved !== false,
        approvalStatus:
          seller.approvalStatus ||
          (seller.approved === false ? "pending" : "approved"),
        onboardingSubmitted: seller.onboardingSubmitted === true,
        approvalNotes: seller.approvalNotes || "",
        approvedAt: seller.approvedAt || null,
        rejectedAt: seller.rejectedAt || null,
        bankInfo: seller.bankInfo || {},
        documents: seller.documents || {},
        shopInfo: seller.shopInfo || {},
      };
      break;
    }
    default:
      throw new AuthError("Unknown role: " + role);
  }

  if (!profile) {
    throw new AuthError("Profile not found");
  }
  return { user: profile };
};

const ADMIN_SERVICES_ALLOWED = ["food", "quickCommerce"];

/** Update admin profile (name, email, phone, profileImage). Only for ADMIN role. */
export const updateAdminProfile = async (userId, body) => {
  if (!userId) {
    throw new AuthError("Invalid token payload");
  }
  const admin = await FoodAdmin.findById(userId);
  if (!admin) {
    throw new AuthError("Profile not found");
  }
  if (body.name !== undefined) admin.name = String(body.name || "").trim();
  if (body.email !== undefined) {
    const normalizedEmail = String(body.email || "")
      .trim()
      .toLowerCase();
    if (!normalizedEmail) {
      throw new ValidationError("Email is required");
    }
    if (normalizedEmail !== admin.email) {
      const duplicateAdmin = await FoodAdmin.findOne({
        _id: { $ne: admin._id },
        email: normalizedEmail,
      })
        .select("_id")
        .lean();
      if (duplicateAdmin) {
        throw new ValidationError("Email is already in use");
      }
    }
    admin.email = normalizedEmail;
  }
  if (body.phone !== undefined) admin.phone = String(body.phone || "").trim();
  if (body.profileImage !== undefined)
    admin.profileImage = String(body.profileImage || "").trim();
  // Normalize servicesAccess so legacy values (e.g. 'zomato') don't fail schema validation on save
  if (Array.isArray(admin.servicesAccess)) {
    const valid = admin.servicesAccess.filter((s) =>
      ADMIN_SERVICES_ALLOWED.includes(s),
    );
    admin.servicesAccess = valid.length ? valid : ["food"];
  } else {
    admin.servicesAccess = ["food"];
  }
  await admin.save();
  const profile = admin.toObject();
  delete profile.password;
  return { user: profile };
};

/** Change admin password. Only for ADMIN role. */
export const changeAdminPassword = async (
  userId,
  currentPassword,
  newPassword,
) => {
  if (!userId) {
    throw new AuthError("Invalid token payload");
  }
  const admin = await FoodAdmin.findById(userId);
  if (!admin) {
    throw new AuthError("Profile not found");
  }
  const isMatch = await admin.comparePassword(currentPassword);
  if (!isMatch) {
    throw new AuthError("Current password is incorrect");
  }
  if (!newPassword || String(newPassword).length < 6) {
    throw new ValidationError("New password must be at least 6 characters");
  }
  admin.password = newPassword;
  await admin.save();

  try {
    const { notifyAdminsSafely } = await import("../../core/notifications/firebase.service.js");
    void notifyAdminsSafely({
      title: "Security Alert: Password Changed 🔐",
      body: `The password for admin account ${admin.email} has been changed. If this was not you, please contact support immediately.`,
      data: {
        type: "security_alert",
        subType: "password_change",
        email: admin.email
      }
    });
  } catch (e) {
    console.error("Failed to notify admins of password change:", e);
  }

  return { success: true };
};

/** Admin forgot password: request OTP. Only accepts email that is registered as admin. */
export const requestAdminForgotPasswordOtp = async (email) => {
  const normalizedEmail = String(email || "")
    .trim()
    .toLowerCase();
  if (!normalizedEmail) {
    throw new ValidationError("Email is required");
  }

  const admin = await FoodAdmin.findOne({ email: normalizedEmail });
  if (!admin) {
    throw new AuthError("This email is not registered as an admin account.");
  }

  const otp = config.useDefaultOtp
    ? "123456"
    : String(crypto.randomInt(100000, 999999));
  const ttlMs = (config.otpExpiryMinutes || 10) * 60 * 1000;
  const expiresAt = new Date(Date.now() + ttlMs);

  await AdminResetOtp.findOneAndUpdate(
    { email: normalizedEmail },
    { otp, expiresAt, attempts: 0 },
    { upsert: true, new: true },
  );

  if (config.useDefaultOtp) {
    logger.info(`Admin reset OTP for ${normalizedEmail}: ${otp}`);
  }

  const sent = await sendAdminResetOtpEmail(normalizedEmail, otp);
  if (!sent && !config.useDefaultOtp) {
    logger.warn(
      `Admin OTP not sent by email to ${normalizedEmail}; check SMTP config.`,
    );
  }

  return {
    success: true,
    message: "If this email is registered, you will receive an OTP shortly.",
  };
};

/** Admin forgot password: verify OTP and set new password in one call. */
export const resetAdminPasswordWithOtp = async (email, otp, newPassword) => {
  const normalizedEmail = String(email || "")
    .trim()
    .toLowerCase();
  const otpStr = String(otp || "").replace(/\D/g, "");
  if (!normalizedEmail || !otpStr) {
    throw new ValidationError("Email and OTP are required");
  }
  if (!newPassword || String(newPassword).length < 6) {
    throw new ValidationError("New password must be at least 6 characters");
  }

  const record = await AdminResetOtp.findOne({ email: normalizedEmail });
  if (!record) {
    throw new AuthError("OTP not found or expired. Please request a new code.");
  }
  if (record.expiresAt < new Date()) {
    await record.deleteOne();
    throw new AuthError("OTP has expired. Please request a new code.");
  }
  if (record.attempts >= (config.otpMaxAttempts || 5)) {
    throw new AuthError("Too many attempts. Please request a new code.");
  }
  record.attempts += 1;
  if (record.otp !== otpStr) {
    await record.save();
    throw new AuthError("Invalid OTP.");
  }

  const admin = await FoodAdmin.findOne({ email: normalizedEmail });
  if (!admin) {
    await record.deleteOne();
    throw new AuthError("Account not found.");
  }

  admin.password = newPassword;
  await admin.save();
  await record.deleteOne();

  try {
    const { notifyAdminsSafely } = await import("../../core/notifications/firebase.service.js");
    void notifyAdminsSafely({
      title: "Security Alert: Password Reset Successful 🔐",
      body: `The password for admin account ${admin.email} has been reset via OTP.`,
      data: {
        type: "security_alert",
        subType: "password_reset",
        email: admin.email
      }
    });
  } catch (e) {
    console.error("Failed to notify admins of password reset:", e);
  }

  return { success: true, message: "Password reset successfully." };
};

export const refreshAccessToken = async (token) => {
  if (!token) {
    throw new ValidationError("Refresh token is required");
  }

  const stored = await FoodRefreshToken.findOne({ token }).lean();
  if (!stored) {
    throw new AuthError("Invalid refresh token");
  }

  const jwt = await import("jsonwebtoken");
  let payload;
  try {
    payload = jwt.default.verify(token, config.jwtRefreshSecret);
  } catch {
    throw new AuthError("Invalid refresh token");
  }

  // If deactivated user or admin, do not issue fresh access tokens (forces logout on client)
  if (payload?.role === "USER") {
    const u = await FoodUser.findById(payload.userId).select("isActive").lean();
    if (!u || u.isActive === false) {
      throw new AuthError("User account is deactivated");
    }
  } else if (payload?.role === "ADMIN") {
    const a = await FoodAdmin.findById(payload.userId).select("isActive").lean();
    if (!a || a.isActive === false) {
      throw new AuthError("Admin account is deactivated");
    }
  }

  const newAccessToken = signAccessToken({
    userId: payload.userId,
    role: payload.role,
  });

  return { accessToken: newAccessToken, refreshToken: token };
};
