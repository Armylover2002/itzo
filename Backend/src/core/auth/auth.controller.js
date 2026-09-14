import {
  requestUserOtp,
  verifyUserOtpAndLogin,
  adminLogin,
  refreshAccessToken,
  requestRestaurantOtp,
  verifyRestaurantOtpAndLogin,
  requestDeliveryOtp,
  verifyDeliveryOtpAndLogin,

  logout,
  logoutAll,
  getProfile,
  updateAdminProfile,
  changeAdminPassword,
  requestAdminForgotPasswordOtp,
  resetAdminPasswordWithOtp,
  getPublicRoles,
} from "./auth.service.js";
import { validateUserOtpRequestDto } from "../../dtos/auth/userOtpRequest.dto.js";
import { validateUserOtpVerifyDto } from "../../dtos/auth/userOtpVerify.dto.js";
import { validateAdminLoginDto } from "../../dtos/auth/adminLogin.dto.js";
import { validateRestaurantOtpRequestDto } from "../../dtos/auth/restaurantOtpRequest.dto.js";
import { validateRestaurantOtpVerifyDto } from "../../dtos/auth/restaurantOtpVerify.dto.js";
import { validateDeliveryOtpRequestDto } from "../../dtos/auth/deliveryOtpRequest.dto.js";
import { validateDeliveryOtpVerifyDto } from "../../dtos/auth/deliveryOtpVerify.dto.js";
import { validateLogoutDto } from "../../dtos/auth/logout.dto.js";
import { validateRefreshTokenDto } from "../../dtos/auth/refreshToken.dto.js";
import { validateAdminProfileUpdateDto } from "../../dtos/auth/adminProfileUpdate.dto.js";
import { validateAdminChangePasswordDto } from "../../dtos/auth/adminChangePassword.dto.js";
import { validateAdminForgotPasswordRequestDto } from "../../dtos/auth/adminForgotPasswordRequest.dto.js";
import { validateAdminForgotPasswordResetDto } from "../../dtos/auth/adminForgotPasswordReset.dto.js";
import { sendResponse } from "../../utils/response.js";

export const requestUserOtpController = async (req, res, next) => {
  try {
    const { phone } = validateUserOtpRequestDto(req.body);
    const result = await requestUserOtp(phone);
    return sendResponse(res, 200, "OTP sent successfully", {
      phone,
      ...result,
    });
  } catch (error) {
    next(error);
  }
};

export const verifyUserOtpController = async (req, res, next) => {
  try {
    const { phone, otp, ref, fcmToken, platform, name } = validateUserOtpVerifyDto(
      req.body,
    );
    const result = await verifyUserOtpAndLogin(
      phone,
      otp,
      ref,
      fcmToken,
      platform,
      name,
    );
    return sendResponse(res, 200, "Login successful", result);
  } catch (error) {
    next(error);
  }
};

export const adminLoginController = async (req, res, next) => {
  try {
    const { email, password, roleId } = validateAdminLoginDto(req.body);
    const result = await adminLogin(email, password, roleId);
    return sendResponse(res, 200, "Admin login successful", result);
  } catch (error) {
    next(error);
  }
};

export const getPublicRolesController = async (req, res, next) => {
  try {
    const roles = await getPublicRoles();
    res.set('Cache-Control', 'no-store');
    return sendResponse(res, 200, "Roles fetched successfully", roles);
  } catch (error) {
    next(error);
  }
};

export const refreshTokenController = async (req, res, next) => {
  try {
    const { refreshToken } = validateRefreshTokenDto(req.body);
    const result = await refreshAccessToken(refreshToken);
    return sendResponse(res, 200, "Access token refreshed", result);
  } catch (error) {
    next(error);
  }
};

export const requestRestaurantOtpController = async (req, res, next) => {
  try {
    const { phone } = validateRestaurantOtpRequestDto(req.body);
    const result = await requestRestaurantOtp(phone);
    return sendResponse(res, 200, "OTP sent successfully", {
      phone,
      ...result,
    });
  } catch (error) {
    next(error);
  }
};

export const verifyRestaurantOtpController = async (req, res, next) => {
  try {
    const { phone, otp, fcmToken, platform } = validateRestaurantOtpVerifyDto(req.body);
    const result = await verifyRestaurantOtpAndLogin(phone, otp, fcmToken, platform);
    return sendResponse(res, 200, "Login successful", result);
  } catch (error) {
    next(error);
  }
};

export const requestDeliveryOtpController = async (req, res, next) => {
  try {
    const { phone } = validateDeliveryOtpRequestDto(req.body);
    const result = await requestDeliveryOtp(phone);
    return sendResponse(res, 200, "OTP sent successfully", {
      phone,
      ...result,
    });
  } catch (error) {
    next(error);
  }
};

export const verifyDeliveryOtpController = async (req, res, next) => {
  try {
    const { phone, otp, fcmToken, platform } = validateDeliveryOtpVerifyDto(req.body);
    const result = await verifyDeliveryOtpAndLogin(phone, otp, fcmToken, platform);
    return sendResponse(res, 200, "Login successful", result);
  } catch (error) {
    next(error);
  }
};





export const logoutController = async (req, res, next) => {
  try {
    const { refreshToken, fcmToken, platform } = validateLogoutDto(req.body);
    const result = await logout(refreshToken, fcmToken, platform);
    return sendResponse(
      res,
      200,
      result.invalidated ? "Logged out successfully" : "Token already invalid",
      result,
    );
  } catch (error) {
    next(error);
  }
};

export const logoutAllController = async (req, res, next) => {
  try {
    const { refreshToken, fcmToken, platform } = validateLogoutDto(req.body);
    const result = await logoutAll(refreshToken, fcmToken, platform);
    return sendResponse(
      res,
      200,
      "Logged out from all devices successfully",
      result,
    );
  } catch (error) {
    next(error);
  }
};

export const getMeController = async (req, res, next) => {
  try {
    const { userId, role } = req.user;
    const result = await getProfile(userId, role);
    return sendResponse(res, 200, "Profile retrieved successfully", result);
  } catch (error) {
    next(error);
  }
};

export const updateAdminProfileController = async (req, res, next) => {
  try {
    const { userId } = req.user;
    const body = validateAdminProfileUpdateDto(req.body);
    const result = await updateAdminProfile(userId, body);
    return sendResponse(res, 200, "Profile updated successfully", result);
  } catch (error) {
    next(error);
  }
};

export const changeAdminPasswordController = async (req, res, next) => {
  try {
    const { userId } = req.user;
    const { currentPassword, newPassword, refreshToken } = validateAdminChangePasswordDto(
      req.body,
    );
    await changeAdminPassword(userId, currentPassword, newPassword, refreshToken);
    return sendResponse(res, 200, "Password changed successfully", {
      success: true,
    });
  } catch (error) {
    next(error);
  }
};

export const requestAdminForgotPasswordOtpController = async (
  req,
  res,
  next,
) => {
  try {
    const { email } = validateAdminForgotPasswordRequestDto(req.body);
    const result = await requestAdminForgotPasswordOtp(email);
    return sendResponse(
      res,
      200,
      result.message || "OTP sent successfully",
      result,
    );
  } catch (error) {
    next(error);
  }
};

export const resetAdminPasswordWithOtpController = async (req, res, next) => {
  try {
    const { email, otp, newPassword } = validateAdminForgotPasswordResetDto(
      req.body,
    );
    await resetAdminPasswordWithOtp(email, otp, newPassword);
    return sendResponse(res, 200, "Password reset successfully", {
      success: true,
    });
  } catch (error) {
    next(error);
  }
};
