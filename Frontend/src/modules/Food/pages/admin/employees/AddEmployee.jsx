import { useState, useEffect } from "react"
import { UserPlus, User, Eye, EyeOff, Upload, ChevronDown } from "lucide-react"
import { toast } from "react-hot-toast"
import { useNavigate, useParams, useLocation } from "react-router-dom"
import axiosInstance from "@food/api"

const NAME_REGEX = /^[A-Za-z][A-Za-z\s.'-]{0,49}$/
const EMAIL_REGEX = /^[a-z0-9._%+-]+@gmail\.com$/
const PHONE_REGEX = /^\d{10}$/
const MAX_IMAGE_SIZE_BYTES = 2 * 1024 * 1024
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/gif"]

export default function AddEmployee() {
  const navigate = useNavigate()
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [roles, setRoles] = useState([])
  const [zones, setZones] = useState([])
  const [errors, setErrors] = useState({})
  const { id } = useParams()
  const location = useLocation()
  const isEditMode = !!id

  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    zone: "All",
    role: "",
    phone: "",
    phoneCode: "+91",
    employeeImage: null,
    email: "",
    password: "",
    confirmPassword: "",
  })

  useEffect(() => {
    if (isEditMode && location.state?.employee) {
      const emp = location.state.employee;
      const nameParts = (emp.name || "").split(" ");
      setFormData(prev => ({
        ...prev,
        firstName: nameParts[0] || "",
        lastName: nameParts.slice(1).join(" ") || "",
        email: emp.email || "",
        phone: emp.phone?.replace("+91", "") || "",
        phoneCode: "+91",
        role: emp.adminRoleId?._id || emp.adminRoleId || "",
        zone: emp.zoneId || "All",
      }));
    }
  }, [isEditMode, location.state])

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [rolesRes, zonesRes] = await Promise.all([
          axiosInstance.get("/food/admin/roles"),
          axiosInstance.get("/food/admin/zones")
        ])
        if (rolesRes.data.success) {
          setRoles(rolesRes.data.data || [])
        }
        if (zonesRes.data.success) {
          setZones(zonesRes.data.data.zones || [])
        }
      } catch (error) {
        toast.error("Failed to load roles and zones")
      }
    }
    fetchData()
  }, [])

  const handleInputChange = (field, value) => {
    let nextValue = value

    if (field === "firstName" || field === "lastName") {
      nextValue = value.replace(/[^A-Za-z\s.'-]/g, "").replace(/\s{2,}/g, " ").slice(0, 50)
    }

    if (field === "phone") {
      nextValue = value.replace(/\D/g, "").slice(0, 10)
    }

    if (field === "email") {
      nextValue = value.trim().toLowerCase()
    }

    setFormData(prev => ({ ...prev, [field]: nextValue }))
    setErrors(prev => ({ ...prev, [field]: "" }))
  }

  const handleFileUpload = (field, file) => {
    if (!file) return
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      toast.error("Please upload a JPG, PNG, or GIF image")
      return
    }
    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      toast.error("Image size must be 2 MB or less")
      return
    }
    setFormData(prev => ({ ...prev, [field]: file }))
    setErrors(prev => ({ ...prev, [field]: "" }))
  }

  const validateForm = () => {
    const nextErrors = {}
    const firstName = formData.firstName.trim()
    const lastName = formData.lastName.trim()
    const email = formData.email.trim().toLowerCase()
    const phone = formData.phone.trim()
    const password = formData.password
    const confirmPassword = formData.confirmPassword

    if (!firstName) {
      nextErrors.firstName = "First name is required"
    } else if (!NAME_REGEX.test(firstName)) {
      nextErrors.firstName = "First name can contain only letters and basic punctuation"
    }

    if (!lastName) {
      nextErrors.lastName = "Last name is required"
    } else if (!NAME_REGEX.test(lastName)) {
      nextErrors.lastName = "Last name can contain only letters and basic punctuation"
    }

    if (!formData.role) {
      nextErrors.role = "Please select a role"
    }

    if (!phone) {
      nextErrors.phone = "Phone number is required"
    } else if (!PHONE_REGEX.test(phone)) {
      nextErrors.phone = "Phone number must be exactly 10 digits"
    }

    if (!email) {
      nextErrors.email = "User Id is required"
    } else if (!EMAIL_REGEX.test(email)) {
      nextErrors.email = "Enter a valid Gmail address"
    }

    if (!isEditMode) {
      if (!password) {
        nextErrors.password = "Password is required"
      } else if (password.length < 8) {
        nextErrors.password = "Password must be at least 8 characters"
      }

      if (!confirmPassword) {
        nextErrors.confirmPassword = "Confirm password is required"
      } else if (password !== confirmPassword) {
        nextErrors.confirmPassword = "Passwords do not match"
      }
    } else if (password || confirmPassword) {
      if (password.length < 8) {
        nextErrors.password = "Password must be at least 8 characters"
      }
      if (password !== confirmPassword) {
        nextErrors.confirmPassword = "Passwords do not match"
      }
    }

    setErrors(nextErrors)
    return nextErrors
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const validationErrors = validateForm()
    if (Object.keys(validationErrors).length > 0) {
      toast.error(Object.values(validationErrors)[0])
      return
    }

    try {
      setLoading(true)
      const data = new FormData()
      data.append('firstName', formData.firstName.trim())
      data.append('lastName', formData.lastName.trim())
      data.append('email', formData.email.trim().toLowerCase())
      if (formData.password) {
        data.append('password', formData.password)
      }
      data.append('phone', formData.phoneCode + formData.phone.trim())
      data.append('roleId', formData.role)
      data.append('zoneId', formData.zone)
      
      if (formData.employeeImage) {
        data.append('employeeImage', formData.employeeImage)
      }

      let res;
      if (isEditMode) {
        res = await axiosInstance.patch(`/food/admin/employees/${id}`, data, {
          headers: { 'Content-Type': 'multipart/form-data' }
        })
      } else {
        res = await axiosInstance.post("/food/admin/employees", data, {
          headers: { 'Content-Type': 'multipart/form-data' }
        })
      }
      
      if (res.data.success) {
        toast.success(res.data.message)
        navigate("/ecs/food/employees")
      }
    } catch (error) {
      console.error("[AddEmployee Error Response]:", error.response?.data);
      toast.error(error.response?.data?.message || "Failed to add employee")
    } finally {
      setLoading(false)
    }
  }

  const handleReset = () => {
    setFormData({
      firstName: "",
      lastName: "",
      zone: "All",
      role: "",
      phone: "",
      phoneCode: "+91",
      employeeImage: null,
      email: "",
      password: "",
      confirmPassword: "",
    })
    setErrors({})
  }

  return (
    <div className="p-4 lg:p-6 bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-[#6412c6] flex items-center justify-center shadow-lg shadow-[#6412c6]/20">
              <UserPlus className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900">{isEditMode ? 'Update Employee' : 'Add New Employee'}</h1>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          {/* General Information */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
            <div className="flex items-center gap-3 mb-6">
              <User className="w-5 h-5 text-slate-600" />
              <h2 className="text-lg font-semibold text-slate-900">General Information</h2>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Side - Form Fields */}
              <div className="lg:col-span-2 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* First Name */}
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      First name
                    </label>
                    <input
                      type="text"
                      value={formData.firstName}
                      onChange={(e) => handleInputChange("firstName", e.target.value)}
                      placeholder="Ex: John"
                      className={`w-full px-4 py-2.5 border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#6412c6] focus:border-[#6412c6] text-sm ${errors.firstName ? "border-red-500" : "border-slate-300"}`}
                    />
                    {errors.firstName && <p className="mt-1 text-xs text-red-600">{errors.firstName}</p>}
                  </div>

                  {/* Last Name */}
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      Last name
                    </label>
                    <input
                      type="text"
                      value={formData.lastName}
                      onChange={(e) => handleInputChange("lastName", e.target.value)}
                      placeholder="Ex: Doe"
                      className={`w-full px-4 py-2.5 border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#6412c6] focus:border-[#6412c6] text-sm ${errors.lastName ? "border-red-500" : "border-slate-300"}`}
                    />
                    {errors.lastName && <p className="mt-1 text-xs text-red-600">{errors.lastName}</p>}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Zone */}
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      Zone
                    </label>
                    <div className="relative">
                      <select
                        value={formData.zone}
                        onChange={(e) => handleInputChange("zone", e.target.value)}
                        className="w-full px-4 py-2.5 pr-8 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#6412c6] focus:border-[#6412c6] text-sm appearance-none cursor-pointer"
                      >
                        <option value="All">All</option>
                        {zones.map(z => (
                          <option key={z._id} value={z._id}>{z.name}</option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                    </div>
                  </div>

                  {/* Role */}
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      Role
                    </label>
                    <div className="relative">
                      <select
                        value={formData.role}
                        onChange={(e) => handleInputChange("role", e.target.value)}
                        className={`w-full px-4 py-2.5 pr-8 border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#6412c6] focus:border-[#6412c6] text-sm appearance-none cursor-pointer ${errors.role ? "border-red-500" : "border-slate-300"}`}
                      >
                        <option value="">Select Role</option>
                        {roles.filter(r => r.status === 'active').map(r => (
                          <option key={r._id} value={r._id}>{r.roleName}</option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                    </div>
                    {errors.role && <p className="mt-1 text-xs text-red-600">{errors.role}</p>}
                  </div>
                </div>

                {/* Phone */}
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Phone
                  </label>
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <select
                        value={formData.phoneCode}
                        onChange={(e) => handleInputChange("phoneCode", e.target.value)}
                        className="px-4 py-2.5 pr-8 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#6412c6] focus:border-[#6412c6] text-sm appearance-none cursor-pointer"
                      >
                        <option value="+91">🇮🇳 +91</option>
                      </select>
                      <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                    </div>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => handleInputChange("phone", e.target.value)}
                      placeholder="Phone number"
                      inputMode="numeric"
                      maxLength={10}
                      className={`flex-1 px-4 py-2.5 border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#6412c6] focus:border-[#6412c6] text-sm ${errors.phone ? "border-red-500" : "border-slate-300"}`}
                    />
                  </div>
                  {errors.phone && <p className="mt-1 text-xs text-red-600">{errors.phone}</p>}
                </div>
              </div>

              {/* Right Side - Employee Image */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Employee image
                </label>
                <div className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center hover:border-[#6412c6] transition-colors cursor-pointer">
                  <input
                    type="file"
                    accept="image/jpeg,image/jpg,image/png,image/gif"
                    onChange={(e) => handleFileUpload("employeeImage", e.target.files[0])}
                    className="hidden"
                    id="employee-image-upload"
                  />
                  <label htmlFor="employee-image-upload" className="cursor-pointer">
                    {formData.employeeImage ? (
                      <div className="w-full h-32 flex justify-center object-cover">
                        <img 
                          src={URL.createObjectURL(formData.employeeImage)} 
                          alt="Preview" 
                          className="h-full rounded object-contain"
                        />
                      </div>
                    ) : (
                      <>
                        <Upload className="w-12 h-12 text-slate-400 mx-auto mb-3" />
                        <p className="text-sm font-medium text-slate-700 mb-1">Upload Image</p>
                        <div className="text-xs text-slate-500 space-y-1 mt-2">
                          <p>Image format - jpg png jpeg gif</p>
                          <p>Image Size - maximum size 2 MB</p>
                          <p>Image Ratio - 1:1</p>
                        </div>
                      </>
                    )}
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* Account Info */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
            <div className="flex items-center gap-3 mb-6">
              <User className="w-5 h-5 text-slate-600" />
              <h2 className="text-lg font-semibold text-slate-900">Account Info</h2>
            </div>

            <div className="space-y-6">
              {/* Email */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  User Id
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange("email", e.target.value)}
                  placeholder="Ex: ex@gmail.com"
                  className={`w-full px-4 py-2.5 border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#6412c6] focus:border-[#6412c6] text-sm ${errors.email ? "border-red-500" : "border-slate-300"}`}
                />
                {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email}</p>}
              </div>

              {/* Password */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Password {isEditMode && <span className="text-xs text-slate-400 font-normal">(Leave blank to keep current)</span>}
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={formData.password}
                    onChange={(e) => handleInputChange("password", e.target.value)}
                    placeholder="Password length 8+"
                    className={`w-full px-4 py-2.5 pr-10 border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#6412c6] focus:border-[#6412c6] text-sm ${errors.password ? "border-red-500" : "border-slate-300"}`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {errors.password && <p className="mt-1 text-xs text-red-600">{errors.password}</p>}
              </div>

              {/* Confirm Password */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Confirm Password {isEditMode && <span className="text-xs text-slate-400 font-normal">(Leave blank to keep current)</span>}
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    value={formData.confirmPassword}
                    onChange={(e) => handleInputChange("confirmPassword", e.target.value)}
                    placeholder="Password length 8+"
                    className={`w-full px-4 py-2.5 pr-10 border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#6412c6] focus:border-[#6412c6] text-sm ${errors.confirmPassword ? "border-red-500" : "border-slate-300"}`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {errors.confirmPassword && <p className="mt-1 text-xs text-red-600">{errors.confirmPassword}</p>}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-4 mb-6">
            <button
              type="button"
              onClick={handleReset}
              className="px-6 py-2.5 text-sm font-medium rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition-all"
            >
              Reset
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2.5 text-sm font-medium rounded-lg bg-[#6412c6] text-white hover:bg-[#550fa8] transition-all shadow-lg shadow-[#6412c6]/30 active:scale-95 disabled:opacity-50"
            >
              {loading ? "Submitting..." : isEditMode ? "Update" : "Submit"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

