import { useState, useEffect, useRef } from "react";
import { adminAPI, uploadAPI } from "@/services/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "sonner";
import { User, Mail, Phone, Save, Loader2, Upload, X, Pencil, Eye, EyeOff } from "lucide-react";

const debugLog = (...args) => {}
const debugWarn = (...args) => {}
const debugError = (...args) => {}


export default function AdminProfile() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const fileInputRef = useRef(null);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    profileImage: "",
  });
  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [showPasswords, setShowPasswords] = useState({
    currentPassword: false,
    newPassword: false,
    confirmPassword: false,
  });

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const response = await adminAPI.getAdminProfile();
      const adminData = response?.data?.data?.admin || response?.data?.admin;
      
      if (adminData) {
        setProfile(adminData);
        setFormData({
          name: adminData.name || "",
          email: adminData.email || "",
          phone: String(adminData.phone || "").replace(/\D/g, "").slice(0, 10),
          profileImage: adminData.profileImage || "",
        });
        return;
      }
      throw new Error("No admin data in response");
    } catch (error) {
      debugError("Error fetching admin profile:", error);
      // Fallback: show data from localStorage (login) so page still shows real name/email
      try {
        const adminUserStr = localStorage.getItem("admin_user");
        if (adminUserStr) {
          const localAdmin = JSON.parse(adminUserStr);
          const fallback = {
            name: localAdmin.name || "ECS User",
            email: localAdmin.email || "",
            phone: localAdmin.phone || "",
            profileImage: localAdmin.profileImage || "",
            role: localAdmin.role || "admin",
            isActive: localAdmin.isActive !== false,
          };
          setProfile(fallback);
          setFormData({
            name: fallback.name || "",
            email: fallback.email || "",
            phone: String(fallback.phone || "").replace(/\D/g, "").slice(0, 10),
            profileImage: fallback.profileImage || "",
          });
          toast.info("Showing saved profile. Backend disconnected — updates may not persist.");
          return;
        }
      } catch (_) {}
      toast.error(
        error?.response?.data?.message || "Failed to load profile"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handlePhoneChange = (value) => {
    const digitsOnly = String(value || "").replace(/\D/g, "").slice(0, 10);
    handleInputChange("phone", digitsOnly);
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ["image/png", "image/jpeg", "image/jpg", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      toast.error("Invalid file type. Please upload PNG, JPG, JPEG, or WEBP.");
      return;
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      toast.error("File size exceeds 5MB limit.");
      return;
    }

    // Set file and create preview
    setSelectedFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveImage = () => {
    setSelectedFile(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const resetPasswordFields = () => {
    setPasswordData({
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    });
    setShowPasswords({
      currentPassword: false,
      newPassword: false,
      confirmPassword: false,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      const phone = String(formData.phone || "").trim();
      if (phone && !/^\d{10}$/.test(phone)) {
        toast.error("Phone number must be exactly 10 digits");
        return;
      }

      const currentPassword = String(passwordData.currentPassword || "").trim();
      const newPassword = String(passwordData.newPassword || "").trim();
      const confirmPassword = String(passwordData.confirmPassword || "").trim();
      const wantsPasswordChange =
        !!currentPassword || !!newPassword || !!confirmPassword;

      if (wantsPasswordChange) {
        if (!currentPassword || !newPassword || !confirmPassword) {
          toast.error("Please fill Old, New, and Confirm password fields.");
          return;
        }
        if (newPassword.length < 6) {
          toast.error("New password must be at least 6 characters.");
          return;
        }
        if (newPassword !== confirmPassword) {
          toast.error("New password and Confirm password do not match.");
          return;
        }
      }

      setSaving(true);
      let profileImageUrl = formData.profileImage;

      // Upload image if a new file is selected
      if (selectedFile) {
        try {
          setUploading(true);
          const uploadResponse = await uploadAPI.uploadMedia(selectedFile, {
            folder: 'admin-profiles'
          });
          profileImageUrl = uploadResponse?.data?.data?.url || uploadResponse?.data?.url;
          
          if (!profileImageUrl) {
            throw new Error("Failed to get uploaded image URL");
          }
        } catch (uploadError) {
          debugError("Error uploading image:", uploadError);
          toast.error(
            uploadError?.response?.data?.message || "Failed to upload image"
          );
          setUploading(false);
          setSaving(false);
          return;
        } finally {
          setUploading(false);
        }
      }

      // Update profile with uploaded image URL
      const response = await adminAPI.updateAdminProfile({
        name: formData.name,
        email: formData.email || undefined,
        phone: phone || undefined,
        profileImage: profileImageUrl || undefined,
      });

      const updatedAdmin = response?.data?.data?.user ?? response?.data?.data?.admin ?? response?.data?.admin;
      
      if (updatedAdmin) {
        setProfile(updatedAdmin);
        setFormData({
          name: updatedAdmin.name || "",
          email: updatedAdmin.email || "",
          phone: String(updatedAdmin.phone || "").replace(/\D/g, "").slice(0, 10),
          profileImage: updatedAdmin.profileImage || "",
        });
        // Clear selected file and preview
        setSelectedFile(null);
        setImagePreview(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
        // Update localStorage with new admin data
        localStorage.setItem('admin_user', JSON.stringify(updatedAdmin));
        // Dispatch event to notify other components
        window.dispatchEvent(new Event('adminAuthChanged'));

        if (wantsPasswordChange) {
          try {
            await adminAPI.changePassword(currentPassword, newPassword);
            resetPasswordFields();
            toast.success("Profile and password updated successfully");
            setIsEditMode(false);
          } catch (passwordError) {
            debugError("Error updating admin password:", passwordError);
            toast.error(
              passwordError?.response?.data?.message || "Profile updated, but password change failed"
            );
            return;
          }
        } else {
          resetPasswordFields();
          toast.success("Profile updated successfully");
          setIsEditMode(false);
        }
      }
    } catch (error) {
      debugError("Error updating profile:", error);
      toast.error(
        error?.response?.data?.message || "Failed to update profile"
      );
    } finally {
      setSaving(false);
    }
  };

  const handleStartEditing = () => {
    setFormData({
      name: profile?.name || "",
      email: profile?.email || "",
      phone: String(profile?.phone || "").replace(/\D/g, "").slice(0, 10),
      profileImage: profile?.profileImage || "",
    });
    setSelectedFile(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    resetPasswordFields();
    setIsEditMode(true);
  };

  const handleCancelEditing = () => {
    setFormData({
      name: profile?.name || "",
      email: profile?.email || "",
      phone: String(profile?.phone || "").replace(/\D/g, "").slice(0, 10),
      profileImage: profile?.profileImage || "",
    });
    setSelectedFile(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    resetPasswordFields();
    setIsEditMode(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-neutral-600" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="pt-6">
            <p className="text-neutral-600">Failed to load profile data</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Get initials for avatar
  const getInitials = (name) => {
    if (!name) return "AD";
    const parts = name.trim().split(" ");
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  // Mask email for display
  const maskEmail = (email) => {
    if (!email) return "";
    const [localPart, domain] = email.split("@");
    if (localPart.length <= 2) return email;
    const masked = localPart[0] + "*".repeat(Math.min(localPart.length - 1, 5)) + "@" + domain;
    return masked;
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-neutral-900">Profile</h1>
        <p className="text-neutral-600 mt-1">Manage your ECS profile information</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div>
              <CardTitle>Profile Information</CardTitle>
              <CardDescription>
                {isEditMode ? "Update your profile details below" : "View your ECS profile details"}
              </CardDescription>
            </div>
            {!isEditMode ? (
              <Button
                type="button"
                onClick={handleStartEditing}
                className="bg-primary text-white hover:bg-primary/90"
              >
                <Pencil className="w-4 h-4 mr-2" />
                Edit
              </Button>
            ) : (
              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCancelEditing}
                  disabled={saving || uploading}
                  className="h-10 px-6"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  form="admin-profile-form"
                  disabled={saving || uploading}
                  className="bg-primary text-white hover:bg-primary/90 h-10 px-6"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Uploading image...
                    </>
                  ) : saving ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      Save Changes
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <form id="admin-profile-form" onSubmit={handleSubmit} className="space-y-6">

            {/* Form Fields */}
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name" className="flex items-center gap-2">
                  <User className="w-4 h-4" />
                  Full Name
                </Label>
                <Input
                  id="name"
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleInputChange("name", e.target.value)}
                  placeholder="Enter your full name"
                  required
                  disabled={!isEditMode || saving || uploading}
                  className={`h-11 ${!isEditMode ? "bg-neutral-50 cursor-not-allowed" : ""}`}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className="flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  Email Address
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange("email", e.target.value)}
                  placeholder="Enter your email address"
                  required
                  disabled={!isEditMode || saving || uploading}
                  className={`h-11 ${!isEditMode ? "bg-neutral-50 cursor-not-allowed" : ""}`}
                />
                <p className="text-xs text-neutral-500">Email can be changed</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone" className="flex items-center gap-2">
                  <Phone className="w-4 h-4" />
                  Phone Number
                </Label>
                <Input
                  id="phone"
                  type="tel"
                  inputMode="numeric"
                  pattern="[0-9]{10}"
                  maxLength={10}
                  value={formData.phone}
                  onChange={(e) => handlePhoneChange(e.target.value)}
                  placeholder="Enter 10-digit phone number"
                  disabled={!isEditMode || saving || uploading}
                  className={`h-11 ${!isEditMode ? "bg-neutral-50 cursor-not-allowed" : ""}`}
                />
                {isEditMode && formData.phone && formData.phone.length !== 10 && (
                  <p className="text-xs text-red-500">Phone number must be exactly 10 digits</p>
                )}
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="profileImage">Profile Image</Label>
                <input
                  ref={fileInputRef}
                  type="file"
                  id="profileImage"
                  accept="image/png,image/jpeg,image/jpg,image/webp"
                  onChange={handleFileSelect}
                  disabled={!isEditMode || saving || uploading}
                  className="hidden"
                />
                {imagePreview || profile.profileImage ? (
                  <div className="relative w-48 h-48 border-2 border-neutral-300 rounded-lg overflow-hidden group">
                    <img
                      src={imagePreview || profile.profileImage}
                      alt="Profile"
                      className="w-full h-full object-cover"
                    />
                    {isEditMode && (
                      <>
                        <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
                          <label
                            htmlFor="profileImage"
                            className="cursor-pointer bg-white text-black px-4 py-2 rounded-lg text-sm font-medium hover:bg-neutral-100 transition-colors"
                          >
                            Change Image
                          </label>
                        </div>
                        <button
                          type="button"
                          onClick={handleRemoveImage}
                          className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors shadow-lg z-10"
                          title="Remove image"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                ) : (
                  <label
                    htmlFor="profileImage"
                    className={`flex flex-col items-center justify-center w-48 h-48 border-2 border-dashed border-neutral-300 rounded-lg transition-colors bg-neutral-50 ${
                      isEditMode ? "cursor-pointer hover:border-neutral-400" : "cursor-not-allowed opacity-70"
                    }`}
                  >
                    <Upload className="w-8 h-8 text-neutral-400 mb-2" />
                    <p className="text-sm text-neutral-600">
                      {isEditMode ? "Click to upload" : "No profile image"}
                    </p>
                    <p className="text-xs text-neutral-500 mt-1">PNG, JPG, WEBP (max 5MB)</p>
                  </label>
                )}
                {isEditMode && imagePreview && (
                  <p className="text-xs text-green-600 mt-1">
                    New image selected. Click "Save Changes" to upload.
                  </p>
                )}
                {isEditMode && profile.profileImage && !imagePreview && (
                  <p className="text-xs text-neutral-500 mt-1">
                    Hover over the image to change it
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="currentPassword">Old Password</Label>
                <div className="relative">
                  <Input
                    id="currentPassword"
                    type={showPasswords.currentPassword ? "text" : "password"}
                    value={passwordData.currentPassword}
                    onChange={(e) =>
                      setPasswordData((prev) => ({
                        ...prev,
                        currentPassword: e.target.value,
                      }))
                    }
                    placeholder="Enter old password"
                    disabled={!isEditMode || saving || uploading}
                    className={`h-11 pr-11 ${!isEditMode ? "bg-neutral-50 cursor-not-allowed" : ""}`}
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setShowPasswords((prev) => ({
                        ...prev,
                        currentPassword: !prev.currentPassword,
                      }))
                    }
                    disabled={!isEditMode || saving || uploading}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-700 disabled:opacity-50"
                    aria-label={showPasswords.currentPassword ? "Hide old password" : "Show old password"}
                  >
                    {showPasswords.currentPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="newPassword">New Password</Label>
                <div className="relative">
                  <Input
                    id="newPassword"
                    type={showPasswords.newPassword ? "text" : "password"}
                    value={passwordData.newPassword}
                    onChange={(e) =>
                      setPasswordData((prev) => ({
                        ...prev,
                        newPassword: e.target.value,
                      }))
                    }
                    placeholder="Enter new password"
                    disabled={!isEditMode || saving || uploading}
                    className={`h-11 pr-11 ${!isEditMode ? "bg-neutral-50 cursor-not-allowed" : ""}`}
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setShowPasswords((prev) => ({
                        ...prev,
                        newPassword: !prev.newPassword,
                      }))
                    }
                    disabled={!isEditMode || saving || uploading}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-700 disabled:opacity-50"
                    aria-label={showPasswords.newPassword ? "Hide new password" : "Show new password"}
                  >
                    {showPasswords.newPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    type={showPasswords.confirmPassword ? "text" : "password"}
                    value={passwordData.confirmPassword}
                    onChange={(e) =>
                      setPasswordData((prev) => ({
                        ...prev,
                        confirmPassword: e.target.value,
                      }))
                    }
                    placeholder="Confirm new password"
                    disabled={!isEditMode || saving || uploading}
                    className={`h-11 pr-11 ${!isEditMode ? "bg-neutral-50 cursor-not-allowed" : ""}`}
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setShowPasswords((prev) => ({
                        ...prev,
                        confirmPassword: !prev.confirmPassword,
                      }))
                    }
                    disabled={!isEditMode || saving || uploading}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-700 disabled:opacity-50"
                    aria-label={showPasswords.confirmPassword ? "Hide confirm password" : "Show confirm password"}
                  >
                    {showPasswords.confirmPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Additional Info */}
            <div className="pt-4 border-t border-neutral-200 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-neutral-600">Account Status</span>
                <span className={`font-medium ${profile.isActive !== false ? "text-green-600" : "text-red-600"}`}>
                  {profile.isActive !== false ? "Active" : "Inactive"}
                </span>
              </div>
              {profile.lastLogin && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-neutral-600">Last Login</span>
                  <span className="text-neutral-900">
                    {new Date(profile.lastLogin).toLocaleString()}
                  </span>
                </div>
              )}
              {profile.loginCount !== undefined && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-neutral-600">Total Logins</span>
                  <span className="text-neutral-900">{profile.loginCount}</span>
                </div>
              )}
              {profile.createdAt && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-neutral-600">Member Since</span>
                  <span className="text-neutral-900">
                    {new Date(profile.createdAt).toLocaleDateString()}
                  </span>
                </div>
              )}
            </div>

          </form>
        </CardContent>
      </Card>
    </div>
  );
}
