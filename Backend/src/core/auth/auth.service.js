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
import { createOrUpdateOtp, verifyOtp } from "../otp/otp.service.js";
import { signAccessToken, signRefreshToken, verifyRefreshToken, signRestaurantRegistrationToken } from "./token.util.js";
import { FoodRefreshToken } from "../refreshTokens/refreshToken.model.js";
import { ValidationError, AuthError, ForbiddenError } from "./errors.js";
import { config } from "../../config/env.js";
import { logger } from "../../utils/logger.js";
import { sendAdminResetOtpEmail } from "../../utils/email.js";
import mongoose from "mongoose";
import { AdminRole } from "../admin/role.model.js";
import { creditReferralReward } from "../../modules/food/user/services/userWallet.service.js";
import { mergeDeviceToken } from "../notifications/firebase.service.js";
import {
  assertAdminForgotOtpRequestAllowed,
  assertAdminForgotOtpVerificationAllowed,
  assertAdminLoginAllowed,
  clearAdminForgotOtpVerificationLockout,
  clearAdminLoginLockout,
  getAdminAccountLockoutKey,
  lockAdminForgotOtpVerification,
  recordAdminLoginFailure,
} from "./auth.lockout.js";

/** Persist a refresh token with a new rotation family (login / new session). */
const createRefreshTokenSession = async (userId, basePayload) => {
  const familyId = crypto.randomUUID();
  const refreshToken = signRefreshToken({ ...basePayload, familyId });
  const ttlMs = ms(config.jwtRefreshExpiresIn || "7d");
  const expiresAt = new Date(Date.now() + ttlMs);
  await FoodRefreshToken.create({
    userId,
    token: refreshToken,
    familyId,
    expiresAt,
  });
  return { refreshToken, familyId, expiresAt };
};

/** Rotate refresh token in-place for a family; returns the new refresh JWT. */
const rotateRefreshTokenSession = async (stored, payload) => {
  const familyId = stored.familyId || crypto.randomUUID();
  const refreshToken = signRefreshToken({
    userId: payload.userId,
    role: payload.role,
    familyId,
  });
  const ttlMs = ms(config.jwtRefreshExpiresIn || "7d");
  const expiresAt = new Date(Date.now() + ttlMs);

  await FoodRefreshToken.deleteOne({ _id: stored._id });
  await FoodRefreshToken.create({
    userId: stored.userId,
    token: refreshToken,
    familyId,
    expiresAt,
  });

  return refreshToken;
};

/** On reuse of an already-rotated refresh token, revoke the whole family (or user sessions). */
const revokeOnRefreshReuse = async (token) => {
  try {
    const payload = verifyRefreshToken(token);
    if (payload?.familyId) {
      await FoodRefreshToken.deleteMany({ familyId: payload.familyId });
    } else if (payload?.userId) {
      await FoodRefreshToken.deleteMany({ userId: payload.userId });
    }
  } catch {
    // Token may already be expired/invalid — still treat as invalid below
  }
};

const ROLES = {
  USER: "USER",
  RESTAURANT: "RESTAURANT",
  DELIVERY_PARTNER: "DELIVERY_PARTNER",
  ADMIN: "ADMIN",
  SELLER: "SELLER",
};

/** Attach/replace an FCM device token on a profile doc (dedupe + same-device refresh). */
const applyFcmTokenToProfile = async (profileDoc, fcmToken, platform) => {
  if (!profileDoc || !fcmToken) return false;
  const field = platform === "mobile" ? "fcmTokenMobile" : "fcmTokens";
  const { tokens, changed } = mergeDeviceToken(profileDoc[field], fcmToken);
  if (!changed) return false;
  profileDoc[field] = tokens;
  await profileDoc.save();
  return true;
};

const ACCOUNT_DEACTIVATED_MESSAGE =
  "Your account has been deactivated. Please contact support.";
const ACCOUNT_DELETED_MESSAGE =
  "Your account has been deleted/deactivated. Please contact support.";
const ACCOUNT_BLOCKED_MESSAGE =
  "Your account has been blocked. Please contact support.";

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
    last10 ? `+91 ${last10}` : "",
  ].filter(Boolean)));
};

const findExistingFoodUserByIdentifier = async (identifier) => {
  const isEmail = String(identifier || "").includes("@");
  if (isEmail) {
    const emailLower = String(identifier).trim().toLowerCase();
    return FoodUser.findOne({ email: emailLower })
      .select("isActive isDeleted isBlocked accountStatus phone email")
      .lean();
  }

  const candidates = getPhoneCandidates(identifier);
  const last10 = String(identifier || "").replace(/\D/g, "").slice(-10);
  const orClauses = [{ phone: { $in: candidates } }];
  if (last10) {
    orClauses.push({ phone: { $regex: new RegExp(`${last10}$`) } });
  }

  return FoodUser.findOne({ $or: orClauses })
    .select("isActive isDeleted isBlocked accountStatus phone email")
    .lean();
};

const assertUserEligibleForOtp = (user) => {
  if (!user) return;

  if (user.isDeleted === true || user.accountStatus === "deleted") {
    logger.warn("OTP request blocked for deleted user account", {
      userId: user._id,
      phone: user.phone,
      email: user.email,
    });
    throw new ForbiddenError(ACCOUNT_DELETED_MESSAGE);
  }

  if (user.isBlocked === true) {
    logger.warn("OTP request blocked for blocked user account", {
      userId: user._id,
      phone: user.phone,
      email: user.email,
    });
    throw new ForbiddenError(ACCOUNT_BLOCKED_MESSAGE);
  }

  if (user.isActive === false) {
    logger.warn("OTP request blocked for inactive user account", {
      userId: user._id,
      phone: user.phone,
      email: user.email,
    });
    throw new ForbiddenError(ACCOUNT_DEACTIVATED_MESSAGE);
  }
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
    throw new ValidationError("Phone or Email is required");
  }
  const isEmail = String(phone || "").includes("@");
  if (isEmail) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(phone)) {
      throw new ValidationError("Invalid email format");
    }
  } else {
    const digits = String(phone || "").replace(/\D/g, "");
    if (digits.length < 8) {
      throw new ValidationError("Phone number must be at least 8 digits");
    }
  }

  // Check if the user exists and is deactivated
  let userDoc;
  if (isEmail) {
    const emailLower = String(phone || "").trim().toLowerCase();
    userDoc = await FoodUser.findOne({ email: emailLower });
  } else {
    userDoc = await FoodUser.findOne({ phone });
  }

  if (userDoc && (userDoc.isActive === false || userDoc.isDeleted === true || userDoc.accountStatus === 'deleted')) {
    throw new AuthError("Your account has been deleted/deactivated. Please contact support.");
  }

  const otp = await createOrUpdateOtp(phone);
  const shouldExposeOtp =
    config.nodeEnv !== "production" || config.useDefaultOtp || isEmail;
  return shouldExposeOtp ? { otp } : {};
};

export const verifyUserOtpAndLogin = async (
  phone,
  otp,
  ref,
  fcmToken,
  platform,
  name,
) => {
  const result = await verifyOtp(phone, otp);

  if (!result.valid) {
    throw new AuthError(result.reason || "OTP verification failed");
  }

  const isEmail = String(phone || "").includes("@");
  let userDoc;
  const trimmedName = typeof name === "string" ? name.trim() : "";

  if (isEmail) {
    const emailLower = String(phone || "").trim().toLowerCase();
    userDoc = await FoodUser.findOne({ email: emailLower });
  } else {
    const candidates = getPhoneCandidates(phone);
    const last10 = String(phone || "").replace(/\D/g, "").slice(-10);
    const orClauses = [{ phone: { $in: candidates } }];
    if (last10) {
      orClauses.push({ phone: { $regex: new RegExp(`${last10}$`) } });
    }
    userDoc = await FoodUser.findOne({ $or: orClauses });
  }

  // Ensure user exists and mark as verified on successful OTP.
  // Check if user is new or hasn't provided a name yet
  const needsNamePrompt = !userDoc || !userDoc.name || String(userDoc.name).trim() === "" || String(userDoc.name).toLowerCase() === "null";
  const isNewUser = needsNamePrompt;

  if (!userDoc) {
    if (isEmail) {
      const emailLower = String(phone || "").trim().toLowerCase();
      userDoc = await FoodUser.create({
        email: emailLower,
        isVerified: true,
        ...(trimmedName ? { name: trimmedName } : {}),
      });
    } else {
      userDoc = await FoodUser.create({
        phone,
        isVerified: true,
        ...(trimmedName ? { name: trimmedName } : {}),
      });
    }
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

  // Block login for deactivated, blocked, or deleted users (defense in depth).
  assertUserEligibleForOtp(userDoc);

  // Update FCM token if provided (replace same-device rotations; keep multi-device)
  if (fcmToken) {
    await applyFcmTokenToProfile(userDoc, fcmToken, platform);
  }

  // Ensure referralCode exists (used for share links on older accounts).
  if (!userDoc.referralCode) {
    userDoc.referralCode = String(userDoc._id);
    await userDoc.save();
  }

  // Referral crediting: create pending log first, credit wallets, then mark credited.
  // Pending logs are retried on later logins if wallet credit previously failed.
  const refRaw = typeof ref === "string" ? String(ref).trim() : "";
  try {
    let referralLog = await FoodReferralLog.findOne({
      refereeId: userDoc._id,
      role: "USER",
    });

    if (!referralLog && isNewUser && refRaw && mongoose.Types.ObjectId.isValid(refRaw)) {
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

            referralLog = await FoodReferralLog.create({
              referrerId,
              refereeId: userDoc._id,
              role: "USER",
              rewardAmount: referrerReward,
              referrerRewardAmount: referrerReward,
              refereeRewardAmount: refereeReward,
              status: "pending",
            });
          } else {
            await FoodReferralLog.create({
              referrerId,
              refereeId: userDoc._id,
              role: "USER",
              rewardAmount: referrerReward,
              status: "rejected",
              reason:
                referrerReward <= 0 && refereeReward <= 0
                  ? "reward_disabled"
                  : limit <= 0
                    ? "limit_disabled"
                    : "limit_reached",
            });
          }
        }
      }
    }

    if (referralLog?.status === "pending") {
      const referrerReward = Math.max(0, Number(referralLog.referrerRewardAmount) || 0);
      const refereeReward = Math.max(0, Number(referralLog.refereeRewardAmount) || 0);

      await Promise.all([
        referrerReward > 0
          ? creditReferralReward(referralLog.referrerId, referrerReward, {
              role: "USER",
              refereeId: String(userDoc._id),
              referralLogId: String(referralLog._id),
              type: "referrer_reward",
            })
          : Promise.resolve(),
        refereeReward > 0
          ? creditReferralReward(userDoc._id, refereeReward, {
              role: "USER",
              referrerId: String(referralLog.referrerId),
              referralLogId: String(referralLog._id),
              type: "referee_reward",
            })
          : Promise.resolve(),
      ]);

      // Atomic pending → credited so retries cannot double-increment referralCount.
      const marked = await FoodReferralLog.findOneAndUpdate(
        { _id: referralLog._id, status: "pending" },
        { $set: { status: "credited" } },
        { new: true },
      );
      if (marked) {
        await FoodUser.updateOne(
          { _id: referralLog.referrerId },
          { $inc: { referralCount: 1 } },
        );
      }
    }
  } catch (e) {
    // Never fail login due to referral errors. Pending logs stay retryable.
    logger?.warn?.({ err: e }, "Referral crediting failed (user)");
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
  const { refreshToken } = await createRefreshTokenSession(user._id, payload);

  return { accessToken, refreshToken, user, isNewUser };
};

export const adminLogin = async (email, password, roleId) => {
  if (!email || !password) {
    throw new ValidationError("Email and password are required");
  }

  const searchKey = String(email || '').trim();
  const admin = await FoodAdmin.findOne({
    $or: [
      { email: searchKey.toLowerCase() },
      { employeeId: searchKey.toUpperCase() },
      { email: searchKey }
    ]
  }).populate('adminRoleId');
  if (!admin) {
    throw new AuthError("User not found");
  }

  const lockoutKey = getAdminAccountLockoutKey(admin);
  await assertAdminLoginAllowed(lockoutKey);

  const isMatch = await admin.comparePassword(password);
  if (!isMatch) {
    await recordAdminLoginFailure(lockoutKey);
    throw new AuthError("Incorrect password");
  }

  if (roleId) {
    if (roleId === 'ADMIN' && admin.role !== 'ADMIN') {
      await recordAdminLoginFailure(lockoutKey);
      throw new AuthError("Please select the correct role for this account.");
    }
    if (roleId !== 'ADMIN') {
      if (admin.role !== 'EMPLOYEE') {
        await recordAdminLoginFailure(lockoutKey);
        throw new AuthError("Please select the correct role for this account.");
      }
      if (admin.adminRoleId && String(admin.adminRoleId._id) !== roleId) {
        await recordAdminLoginFailure(lockoutKey);
        throw new AuthError("Please select the correct role for this account.");
      }
    }
  }

  if (admin.isActive === false) {
    throw new AuthError("Your account has been deactivated. Please contact support.");
  }

  await clearAdminLoginLockout(lockoutKey);

  const payload = { userId: admin._id.toString(), role: admin.role };

  const accessToken = signAccessToken(payload);
  const { refreshToken } = await createRefreshTokenSession(admin._id, payload);

  const userObj = normalizeAdminProfile(admin);
  delete userObj.password;
  return { accessToken, refreshToken, user: userObj };
};

export const getPublicRoles = async () => {
  const roles = await AdminRole.find({ status: 'active' })
    .select('_id roleName')
    .sort({ roleName: 1 })
    .lean();

  // Public login picker only needs stable id + display name.
  return roles.map((role) => ({
    _id: String(role._id),
    roleName: String(role.roleName || '').trim(),
  }));
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
      registrationToken: signRestaurantRegistrationToken(phone),
    };
  }

  // In-progress onboarding — allow resume from saved step (draft fetched via registration token)
  if (restaurant.status === "onboarding") {
    return {
      needsRegistration: true,
      phone,
      resumeStep: restaurant.onboardingStep || 2,
      registrationToken: signRestaurantRegistrationToken(phone),
    };
  }

  // Update FCM token if provided (replace same-device rotations; keep multi-device)
  if (fcmToken) {
    await applyFcmTokenToProfile(restaurant, fcmToken, platform);
  }

  // Block login for deleted restaurants
  if (restaurant.isDeleted === true || restaurant.accountStatus === "deleted") {
    throw new AuthError(
      "Your account has been deleted/deactivated. Please contact support.",
    );
  }

  // For rejected restaurants — return rejection info so frontend can show modal.
  // Registration token lets re-apply use onboarding APIs with proven phone ownership.
  if (restaurant.status === "rejected") {
    return {
      isRejected: true,
      rejectionReason: restaurant.rejectionReason || null,
      phone,
      needsRegistration: false,
      registrationToken: signRestaurantRegistrationToken(phone),
    };
  }

  // Pending first-time approval — issue session for status polling only for new restaurants
  if (restaurant.status === "pending" && restaurant.wasEverApproved !== true) {
    return {
      ...(await issueRestaurantSession(restaurant)),
      isPendingApproval: true,
    };
  }

  // Re-verification or profile review after first approval — full panel access
  if (restaurant.status === "pending" && restaurant.wasEverApproved === true) {
    return issueRestaurantSession(restaurant);
  }

  // Block deactivated restaurants that are not awaiting first-time approval
  if (restaurant.isActive === false) {
    throw new AuthError(
      "Your account has been deleted/deactivated. Please contact support.",
    );
  }

  return issueRestaurantSession(restaurant);
};

export const issueRestaurantSession = async (restaurant) => {
  if (!restaurant?._id) {
    throw new ValidationError("Restaurant is required");
  }

  const payload = { userId: restaurant._id.toString(), role: ROLES.RESTAURANT };
  const accessToken = signAccessToken(payload);
  const { refreshToken } = await createRefreshTokenSession(restaurant._id, payload);

  const user =
    typeof restaurant.toObject === "function" ? restaurant.toObject() : restaurant;

  return {
    accessToken,
    refreshToken,
    user,
    needsRegistration: false,
    isPendingApproval:
      user?.status === "pending" && user?.wasEverApproved !== true,
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

  // Account lifecycle gate — do NOT conflate with onboarding status.
  // pending + isActive:false is normal during onboarding review.
  // rejected + isActive:false is allowed so the partner can see rejection / reapply.
  // deleted/deactivated applies only to deleted accounts OR intentionally deactivated approved partners.
  const onboardingStatus = String(deliveryPartner.status || '').trim().toLowerCase();
  const isDeletedAccount =
    deliveryPartner.isDeleted === true ||
    deliveryPartner.accountStatus === 'deleted';
  const isDeactivatedApprovedPartner =
    deliveryPartner.isActive === false && onboardingStatus === 'approved';

  if (isDeletedAccount || isDeactivatedApprovedPartner) {
    throw new AuthError(
      "Your delivery account has been deleted/deactivated by admin. Please contact support.",
    );
  }

  // Update FCM token if provided - CRITICAL: do this BEFORE returning pendingApproval
  // so we can notify them when approved. Replace same-device rotations; keep multi-device.
  if (fcmToken) {
    await applyFcmTokenToProfile(deliveryPartner, fcmToken, platform);
  }

  if (deliveryPartner.status && deliveryPartner.status !== "approved") {
    const isRejected = deliveryPartner.status === "rejected";
    if (isRejected) {
      const {
        ensureLegacySubmission,
        serializeSubmissionForPrefill,
      } = await import(
        "../../modules/food/delivery/services/deliveryPartnerSubmission.service.js"
      );
      const { FoodDeliveryPartnerSubmission } = await import(
        "../../modules/food/delivery/models/deliveryPartnerSubmission.model.js"
      );

      await ensureLegacySubmission(deliveryPartner);

      let rejectedSubmission = await FoodDeliveryPartnerSubmission.findOne({
        partnerId: deliveryPartner._id,
        status: "rejected",
      })
        .sort({ submissionNumber: -1 })
        .lean();

      if (!rejectedSubmission && deliveryPartner.latestSubmissionId) {
        rejectedSubmission = await FoodDeliveryPartnerSubmission.findById(
          deliveryPartner.latestSubmissionId
        ).lean();
      }

      return {
        pendingApproval: true,
        isRejected: true,
        rejectionReason:
          deliveryPartner.rejectionReason ||
          rejectedSubmission?.rejectionReason ||
          "Application rejected by admin",
        rejectedAt:
          deliveryPartner.rejectedAt || rejectedSubmission?.reviewedAt || null,
        rejectedBy:
          deliveryPartner.rejectedBy || rejectedSubmission?.rejectedBy || null,
        partnerId: String(deliveryPartner._id),
        phone: deliveryPartner.phone,
        latestSubmissionId: deliveryPartner.latestSubmissionId
          ? String(deliveryPartner.latestSubmissionId)
          : rejectedSubmission?._id
            ? String(rejectedSubmission._id)
            : null,
        rejectedSubmission: serializeSubmissionForPrefill(rejectedSubmission),
        message: "Your application was rejected.",
      };
    }
    return {
      pendingApproval: true,
      isRejected: false,
      rejectionReason: null,
      rejectedAt: null,
      message:
        "Your onboarding request is under review. Your documents are currently being verified. You will receive approval once reviewed by admin.",
    };
  }

  const payload = {
    userId: deliveryPartner._id.toString(),
    role: ROLES.DELIVERY_PARTNER,
  };
  const accessToken = signAccessToken(payload);
  const { refreshToken } = await createRefreshTokenSession(deliveryPartner._id, payload);

  const userObj = deliveryPartner.toObject();

  // Reconstruct active vehicle and strip internal data for backward compatibility
  try {
    if (userObj.driverVehicles && userObj.driverVehicles.length > 0) {
      const activeId = userObj.activeVehicleId ? String(userObj.activeVehicleId) : null;
      const activeVeh = activeId
        ? userObj.driverVehicles.find(v => String(v._id) === activeId || String(v.id) === activeId)
        : userObj.driverVehicles.find(v => v.isDefault) || userObj.driverVehicles[0];

      if (activeVeh) {
        userObj.vehicleNumber = activeVeh.vehicleNumber;
        userObj.vehicleType = activeVeh.vehicleCode;
        userObj.vehicleName = activeVeh.vehicleName;
      }
    }
  } catch (e) { }

  return {
    accessToken,
    refreshToken,
    user: userObj,
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

    // Remove from both platform fields so mis-tagged tokens do not linger.
    const models = [FoodUser, FoodRestaurant, FoodDeliveryPartner, FoodAdmin, Seller];

    try {
      await Promise.all(
        models.map((model) =>
          model.updateMany(
            { $or: [{ fcmTokens: fcmToken }, { fcmTokenMobile: fcmToken }] },
            { $pull: { fcmTokens: fcmToken, fcmTokenMobile: fcmToken } },
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
    const models = [FoodUser, FoodRestaurant, FoodDeliveryPartner, FoodAdmin, Seller];
    try {
      await Promise.all(
        models.map((model) =>
          model.updateMany(
            { $or: [{ fcmTokens: fcmToken }, { fcmTokenMobile: fcmToken }] },
            { $pull: { fcmTokens: fcmToken, fcmTokenMobile: fcmToken } },
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

  switch (role) {
    case ROLES.USER: {
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
    case ROLES.DELIVERY_PARTNER: {
      const partner = await FoodDeliveryPartner.findById(id).lean();
      if (!partner) break;
      const deliveryId = partner._id
        ? `DP-${partner._id.toString().slice(-8).toUpperCase()}`
        : null;

      let clientVehicles = Array.isArray(partner.driverVehicles) ? partner.driverVehicles : [];
      let resolvedActiveVehicleId = partner.activeVehicleId || null;

      profile = {
        ...partner,
        email: partner.email || null,
        deliveryId,
        availabilityStatus: partner.availabilityStatus || 'offline',
        activeVehicleId: resolvedActiveVehicleId,
        driverVehicles: clientVehicles,
        vehicles: clientVehicles,
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
      throw new AuthError("Unknown role");
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
  currentRefreshToken = null,
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

  // Security: revoke existing sessions after a password change so any
  // compromised/stale tokens can no longer be refreshed. Preserve the caller's
  // current session (if provided) to avoid logging the acting admin out.
  try {
    const revokeFilter = { userId: admin._id };
    if (currentRefreshToken) {
      revokeFilter.token = { $ne: currentRefreshToken };
    }
    await FoodRefreshToken.deleteMany(revokeFilter);
  } catch (e) {
    logger?.warn?.({ err: e }, "Failed to revoke sessions after admin password change");
  }

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

  await assertAdminForgotOtpRequestAllowed(normalizedEmail);

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

  await assertAdminForgotOtpVerificationAllowed(normalizedEmail);

  const record = await AdminResetOtp.findOne({ email: normalizedEmail });
  if (!record) {
    throw new AuthError("OTP not found or expired. Please request a new code.");
  }
  if (record.expiresAt < new Date()) {
    await record.deleteOne();
    throw new AuthError("OTP has expired. Please request a new code.");
  }
  if (record.attempts >= (config.otpMaxAttempts || 5)) {
    await lockAdminForgotOtpVerification(normalizedEmail);
    throw new AuthError("Too many attempts. Please request a new code.");
  }
  record.attempts += 1;
  if (record.otp !== otpStr) {
    await record.save();
    if (record.attempts >= (config.otpMaxAttempts || 5)) {
      await lockAdminForgotOtpVerification(normalizedEmail);
    }
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
  await clearAdminForgotOtpVerificationLockout(normalizedEmail);

  // Security: a forgot-password reset is unauthenticated, so revoke ALL
  // existing sessions for this admin. The user re-authenticates via login.
  try {
    await FoodRefreshToken.deleteMany({ userId: admin._id });
  } catch (e) {
    logger?.warn?.({ err: e }, "Failed to revoke sessions after admin password reset");
  }

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
    // Token not in DB but may still be a valid JWT → reuse of rotated token
    await revokeOnRefreshReuse(token);
    throw new AuthError("Invalid refresh token");
  }

  let payload;
  try {
    payload = verifyRefreshToken(token);
  } catch {
    await FoodRefreshToken.deleteOne({ _id: stored._id });
    throw new AuthError("Invalid refresh token");
  }

  // If deactivated user/admin/employee/restaurant, do not issue fresh access tokens
  if (payload?.role === "USER") {
    const u = await FoodUser.findById(payload.userId).select("isActive").lean();
    if (!u || u.isActive === false) {
      throw new AuthError("User account is deactivated");
    }
  } else if (payload?.role === "ADMIN" || payload?.role === "EMPLOYEE") {
    const a = await FoodAdmin.findById(payload.userId).select("isActive").lean();
    if (!a || a.isActive === false) {
      throw new AuthError("Admin account is deactivated");
    }
  } else if (payload?.role === "RESTAURANT") {
    const r = await FoodRestaurant.findById(payload.userId)
      .select("status isActive isDeleted accountStatus")
      .lean();
    if (!r || r.isDeleted === true || r.accountStatus === "deleted") {
      throw new AuthError("Restaurant account is deleted/deactivated");
    }
    const status = String(r.status || "").toLowerCase();
    if (status === "rejected") {
      throw new AuthError("Restaurant account has been rejected");
    }
    // Pending first-time approval may keep refreshing for status polling only
    if (r.isActive === false && status !== "pending") {
      throw new AuthError("Restaurant account is deactivated");
    }
  } else if (payload?.role === "DELIVERY_PARTNER") {
    const d = await FoodDeliveryPartner.findById(payload.userId)
      .select("isActive")
      .lean();
    if (!d || d.isActive === false) {
      throw new AuthError("Delivery account is inactive");
    }
  }

  const newAccessToken = signAccessToken({
    userId: payload.userId,
    role: payload.role,
  });
  const newRefreshToken = await rotateRefreshTokenSession(stored, payload);

  return { accessToken: newAccessToken, refreshToken: newRefreshToken };
};
