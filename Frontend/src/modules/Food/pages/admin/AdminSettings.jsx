import { useState, useEffect } from "react";
import { adminAPI } from "@food/api";
import { Button } from "@food/components/ui/button";
import { Input } from "@food/components/ui/input";
import { Label } from "@food/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@food/components/ui/card";
import { toast } from "sonner";
import { Lock, Eye, EyeOff, Save, Loader2, Shield, User, Mail, Truck } from "lucide-react";
const debugLog = (...args) => {}
const debugWarn = (...args) => {}
const debugError = (...args) => {}


export default function AdminSettings() {
  const [adminInfo, setAdminInfo] = useState(null);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  // Single API: getAdminProfile (GET /auth/me) for current account display
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await adminAPI.getAdminProfile();
        const admin = res?.data?.data?.admin ?? res?.data?.admin;
        if (!cancelled && admin) {
          setAdminInfo({ name: admin.name, email: admin.email, role: admin.role });
          return;
        }
      } catch (_) {}
      if (!cancelled) {
        try {
          const adminUserStr = localStorage.getItem("admin_user");
          if (adminUserStr) {
            const local = JSON.parse(adminUserStr);
            setAdminInfo({
              name: local.name || "ECS User",
              email: local.email || "",
              role: local.role || "admin",
            });
          }
        } catch (_) {}
      }
    };
    load();
    return () => { cancelled = true; };
  }, []);


  const handlePasswordChange = (field, value) => {
    setPasswordForm((prev) => ({
      ...prev,
      [field]: value,
    }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const validatePasswordForm = () => {
    const newErrors = {};

    if (!passwordForm.currentPassword) {
      newErrors.currentPassword = "Current password is required";
    }

    if (!passwordForm.newPassword) {
      newErrors.newPassword = "New password is required";
    } else if (passwordForm.newPassword.length < 6) {
      newErrors.newPassword = "Password must be at least 6 characters long";
    }

    if (!passwordForm.confirmPassword) {
      newErrors.confirmPassword = "Please confirm your new password";
    } else if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match";
    }

    if (passwordForm.currentPassword === passwordForm.newPassword) {
      newErrors.newPassword = "New password must be different from current password";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();

    if (!validatePasswordForm()) {
      return;
    }

    try {
      setSaving(true);
      await adminAPI.changePassword(
        passwordForm.currentPassword,
        passwordForm.newPassword
      );

      // Clear form
      setPasswordForm({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });

      toast.success("Password changed successfully");
    } catch (error) {
      debugError("Error changing password:", error);
      const errorMessage =
        error?.response?.data?.message || "Failed to change password";
      
      // Set specific error for current password
      if (errorMessage.includes("current password") || errorMessage.includes("incorrect")) {
        setErrors({ currentPassword: errorMessage });
      } else {
        toast.error(errorMessage);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-neutral-900">Settings</h1>
        <p className="text-neutral-600 mt-1">
          Manage your account settings and preferences
        </p>
      </div>

      {/* Current account (real data) */}
      {adminInfo && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <User className="w-5 h-5 text-neutral-700" />
              <CardTitle>Current account</CardTitle>
            </div>
            <CardDescription>
              Logged in with the following account. Use the form below to change password.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <User className="w-4 h-4 text-neutral-500" />
              <span className="text-neutral-600">Name:</span>
              <span className="font-medium text-neutral-900">{adminInfo.name || "—"}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Mail className="w-4 h-4 text-neutral-500" />
              <span className="text-neutral-600">Email:</span>
              <span className="font-medium text-neutral-900">{adminInfo.email || "—"}</span>
            </div>
            {adminInfo.role && (
              <div className="flex items-center gap-2 text-sm">
                <Shield className="w-4 h-4 text-neutral-500" />
                <span className="text-neutral-600">Role:</span>
                <span className="font-medium capitalize text-neutral-900">{adminInfo.role}</span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Password Change Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-neutral-700" />
            <CardTitle>Change Password</CardTitle>
          </div>
          <CardDescription>
            Update your password to keep your account secure
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handlePasswordSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="currentPassword" className="flex items-center gap-2">
                <Lock className="w-4 h-4" />
                Current Password
              </Label>
              <div className="relative">
                <Input
                  id="currentPassword"
                  type={showCurrentPassword ? "text" : "password"}
                  value={passwordForm.currentPassword}
                  onChange={(e) =>
                    handlePasswordChange("currentPassword", e.target.value)
                  }
                  placeholder="Enter your current password"
                  className={`h-11 pr-12 ${
                    errors.currentPassword ? "border-red-500" : ""
                  }`}
                  disabled={saving}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-800 transition-colors"
                  disabled={saving}
                >
                  {showCurrentPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
              {errors.currentPassword && (
                <p className="text-sm text-red-600">{errors.currentPassword}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="newPassword" className="flex items-center gap-2">
                <Lock className="w-4 h-4" />
                New Password
              </Label>
              <div className="relative">
                <Input
                  id="newPassword"
                  type={showNewPassword ? "text" : "password"}
                  value={passwordForm.newPassword}
                  onChange={(e) =>
                    handlePasswordChange("newPassword", e.target.value)
                  }
                  placeholder="Enter your new password"
                  className={`h-11 pr-12 ${
                    errors.newPassword ? "border-red-500" : ""
                  }`}
                  disabled={saving}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-800 transition-colors"
                  disabled={saving}
                >
                  {showNewPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
              {errors.newPassword && (
                <p className="text-sm text-red-600">{errors.newPassword}</p>
              )}
              <p className="text-xs text-neutral-500">
                Password must be at least 6 characters long
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="flex items-center gap-2">
                <Lock className="w-4 h-4" />
                Confirm New Password
              </Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  value={passwordForm.confirmPassword}
                  onChange={(e) =>
                    handlePasswordChange("confirmPassword", e.target.value)
                  }
                  placeholder="Confirm your new password"
                  className={`h-11 pr-12 ${
                    errors.confirmPassword ? "border-red-500" : ""
                  }`}
                  disabled={saving}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-800 transition-colors"
                  disabled={saving}
                >
                  {showConfirmPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
              {errors.confirmPassword && (
                <p className="text-sm text-red-600">{errors.confirmPassword}</p>
              )}
            </div>

            <div className="flex justify-end pt-4 border-t border-neutral-200">
              <Button
                type="submit"
                disabled={saving}
                className="bg-black text-white hover:bg-neutral-900 h-11 px-8"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Changing Password...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Change Password
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

