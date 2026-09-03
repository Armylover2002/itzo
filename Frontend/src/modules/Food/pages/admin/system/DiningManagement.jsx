import { useState, useEffect, useRef } from "react"
import { Upload, Trash2, Image as ImageIcon, Loader2, AlertCircle, CheckCircle2, ArrowUp, ArrowDown, Layout, Tag, UtensilsCrossed, Edit, X } from "lucide-react"
import api, { adminAPI, uploadAPI } from "@food/api"
import { getModuleToken } from "@food/utils/auth"
import { Input } from "@food/components/ui/input"
import { Label } from "@food/components/ui/label"
import { Button } from "@food/components/ui/button"
const debugLog = (...args) => {}
const debugWarn = (...args) => {}
const debugError = (...args) => {}


export default function DiningManagement() {
    const [activeTab, setActiveTab] = useState('categories')

    // Categories
    const [categories, setCategories] = useState([])
    const [categoriesLoading, setCategoriesLoading] = useState(true)
    const [categoriesUploading, setCategoriesUploading] = useState(false)
    const [categoriesDeleting, setCategoriesDeleting] = useState(null)
    const [categoryName, setCategoryName] = useState("")
    const [categoryFile, setCategoryFile] = useState(null)
    const [editingCategoryId, setEditingCategoryId] = useState(null)
    const [editingCategoryImageUrl, setEditingCategoryImageUrl] = useState("")
    const categoryFileInputRef = useRef(null)

    // Banners
    const [banners, setBanners] = useState([])
    const [bannersLoading, setBannersLoading] = useState(true)
    const [bannersUploading, setBannersUploading] = useState(false)
    const [bannersDeleting, setBannersDeleting] = useState(null)
    const [bannerFile, setBannerFile] = useState(null)
    const [bannerPercentageOff, setBannerPercentageOff] = useState("")
    const [bannerTagline, setBannerTagline] = useState("")
    const bannerFileInputRef = useRef(null)

    // Common
    const [error, setError] = useState(null)
    const [success, setSuccess] = useState(null)

    const getAuthConfig = (additionalConfig = {}) => {
        const adminToken = getModuleToken('admin')
        if (!adminToken) return additionalConfig
        return {
            ...additionalConfig,
            headers: {
                ...additionalConfig.headers,
                Authorization: `Bearer ${adminToken.trim()}`,
            }
        }
    }

    useEffect(() => {
        fetchCategories()
    }, [])

    useEffect(() => {
        setError(null)
        setSuccess(null)

        if (activeTab === 'banners') {
            fetchBanners()
        }
    }, [activeTab])

    // ==================== CATEGORIES ====================
    const fetchCategories = async () => {
        try {
            setCategoriesLoading(true)
            const response = await adminAPI.getDiningCategories()
            if (response.data.success) setCategories(response.data.data.categories || [])
        } catch (err) { debugError(err) } finally { setCategoriesLoading(false) }
    }

    const resetCategoryForm = () => {
        setCategoryName("")
        setCategoryFile(null)
        setEditingCategoryId(null)
        setEditingCategoryImageUrl("")
        if (categoryFileInputRef.current) categoryFileInputRef.current.value = ""
    }

    const handleEditCategory = (category) => {
        setError(null)
        setSuccess(null)
        setEditingCategoryId(category._id)
        setCategoryName(category.name || "")
        setCategoryFile(null)
        setEditingCategoryImageUrl(category.imageUrl || "")
        if (categoryFileInputRef.current) categoryFileInputRef.current.value = ""
    }

    const handleSubmitCategory = async () => {
        const trimmedCategoryName = categoryName.trim()
        if (!trimmedCategoryName) return setError("Category name is required")
        if (!editingCategoryId && !categoryFile) return setError("Name and Image are required")

        try {
            setError(null)
            setSuccess(null)
            setCategoriesUploading(true)
            let imageUrl = editingCategoryImageUrl

            if (categoryFile) {
                const uploadResponse = await uploadAPI.uploadMedia(categoryFile, { folder: "appzeto/dining/categories" })
                imageUrl = uploadResponse?.data?.data?.url || ""
            }

            const response = editingCategoryId
                ? await adminAPI.updateDiningCategory(editingCategoryId, {
                    name: trimmedCategoryName,
                    ...(imageUrl ? { imageUrl } : {}),
                })
                : await adminAPI.createDiningCategory({
                    name: trimmedCategoryName,
                    imageUrl,
                })

            if (response.data.success) {
                setSuccess(editingCategoryId ? "Category updated successfully" : "Category created successfully")
                resetCategoryForm()
                fetchCategories()
            }
        } catch (err) { setError(err.response?.data?.message || (editingCategoryId ? "Failed to update category" : "Failed to create category")) }
        finally { setCategoriesUploading(false) }
    }

    const handleDeleteCategory = async (id) => {
        if (!window.confirm("Delete this category?")) return
        try {
            setCategoriesDeleting(id)
            await adminAPI.deleteDiningCategory(id)
            fetchCategories()
            setSuccess("Category deleted")
        } catch (err) { setError("Failed to delete category") }
        finally { setCategoriesDeleting(null) }
    }

    // ==================== BANNERS ====================
    const fetchBanners = async () => {
        try {
            setBannersLoading(true)
            const response = await api.get('/food/hero-banners/dining', getAuthConfig())
            if (response.data.success) {
                setBanners(response.data.data.banners || [])
            } else {
                setBanners([])
            }
        } catch (err) {
            debugError(err)
            setBanners([])
        } finally { setBannersLoading(false) }
    }

    const handleSubmitBanner = async () => {
        setError(null)
        setSuccess(null)
        if (!bannerFile) {
            return setError("Banner image is required")
        }

        try {
            setBannersUploading(true)
            const formData = new FormData()
            formData.append('files', bannerFile)
            if (bannerTagline.trim()) formData.append('title', bannerTagline.trim())
            if (bannerPercentageOff.trim()) formData.append('ctaText', bannerPercentageOff.trim())

            const response = await api.post('/food/hero-banners/dining/multiple', formData, getAuthConfig({
                headers: { 'Content-Type': 'multipart/form-data' }
            }))

            if (response.data.success) {
                setSuccess("Dining page banner created successfully")
                resetBannerForm()
                fetchBanners()
            }
        } catch (err) { setError(err.response?.data?.message || "Failed to create dining page banner") }
        finally { setBannersUploading(false) }
    }

    const resetBannerForm = () => {
        setBannerFile(null)
        setBannerPercentageOff("")
        setBannerTagline("")
        if (bannerFileInputRef.current) bannerFileInputRef.current.value = ""
    }

    const handleDeleteBanner = async (id) => {
        if (!window.confirm("Delete this banner?")) return
        try {
            setBannersDeleting(id)
            await api.delete(`/food/hero-banners/dining/${id}`, getAuthConfig())
            fetchBanners()
            setSuccess("Banner deleted")
        } catch (err) { setError("Failed to delete banner") }
        finally { setBannersDeleting(null) }
    }

    const tabs = [
        { id: 'categories', label: 'Dining Categories', icon: Layout },
        { id: 'banners', label: 'Dining Banners', icon: ImageIcon },
    ]

    return (
        <div className="p-4 lg:p-6 bg-slate-50 min-h-screen">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
                            <UtensilsCrossed className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-slate-900">Dining Management</h1>
                            <p className="text-sm text-slate-600 mt-1">Manage dining categories, restaurant links, banners, and stories</p>
                        </div>
                    </div>
                </div>

                {/* Tabs */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-2 mb-6">
                    <div className="flex gap-2">
                        {tabs.map((tab) => {
                            const Icon = tab.icon
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${activeTab === tab.id ? 'bg-primary text-white' : 'text-slate-600 hover:bg-slate-100'
                                        }`}
                                >
                                    <Icon className="w-4 h-4" />
                                    {tab.label}
                                </button>
                            )
                        })}
                    </div>
                </div>

                {/* Messages */}
                {success && <div className="mb-6 bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg flex items-center gap-2 max-w-2xl"><CheckCircle2 className="w-5 h-5" />{success}</div>}
                {error && <div className="mb-6 bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg flex items-center gap-2 max-w-2xl"><AlertCircle className="w-5 h-5" />{error}</div>}

                {/* Content */}
                {activeTab === 'categories' && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className="lg:col-span-1">
                            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                                <div className="flex items-center justify-between gap-3 mb-4">
                                    <h2 className="text-lg font-bold text-slate-900">{editingCategoryId ? "Edit Category" : "Add Category"}</h2>
                                    {editingCategoryId && (
                                        <Button type="button" variant="outline" onClick={resetCategoryForm} className="gap-2">
                                            <X className="w-4 h-4" />
                                            Cancel
                                        </Button>
                                    )}
                                </div>
                                <div className="space-y-4">
                                    <div>
                                        <Label>Name</Label>
                                        <Input value={categoryName} onChange={e => setCategoryName(e.target.value)} placeholder="Category Name" className="mt-1" />
                                    </div>
                                    <div>
                                        <Label>{editingCategoryId ? "Replace Image" : "Image"}</Label>
                                        <Input type="file" ref={categoryFileInputRef} onChange={e => setCategoryFile(e.target.files[0])} accept="image/*" className="mt-1" />
                                        {editingCategoryId && editingCategoryImageUrl && !categoryFile && (
                                            <div className="mt-3">
                                                <img src={editingCategoryImageUrl} alt={categoryName || "Current category"} className="w-24 h-24 rounded-lg object-cover border border-slate-200" />
                                                <p className="text-xs text-slate-500 mt-2">Current image will be kept unless you select a new one.</p>
                                            </div>
                                        )}
                                    </div>
                                    <Button onClick={handleSubmitCategory} disabled={categoriesUploading} className="w-full bg-primary hover:bg-primary/90">
                                        {categoriesUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : (editingCategoryId ? "Update Category" : "Create Category")}
                                    </Button>
                                </div>
                            </div>
                        </div>
                        <div className="lg:col-span-2">
                            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                                <h2 className="text-lg font-bold text-slate-900 mb-4">Categories List</h2>
                                {categoriesLoading ? <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div> : (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {categories.map(cat => (
                                            <div key={cat._id} className="border rounded-lg overflow-hidden group relative">
                                                <img src={cat.imageUrl} alt={cat.name} className="w-full h-32 object-cover" />
                                                <div className="p-3 bg-white">
                                                    <p className="font-medium text-slate-900">{cat.name}</p>
                                                </div>
                                                <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button onClick={() => handleEditCategory(cat)} className="p-1.5 bg-[#f0e7f9] text-primary rounded-full">
                                                        <Edit className="w-4 h-4" />
                                                    </button>
                                                    <button onClick={() => handleDeleteCategory(cat._id)} className="p-1.5 bg-red-100 text-red-600 rounded-full">
                                                        {categoriesDeleting === cat._id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                        {categories.length === 0 && <p className="text-slate-500 text-center col-span-full py-8">No categories found.</p>}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'banners' && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className="lg:col-span-1">
                            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                                <h2 className="text-lg font-bold text-slate-900 mb-2">Add Dining Page Banner</h2>
                                <p className="text-sm text-slate-500 mb-4">
                                    This banner shows on the user dining page and is not linked to any restaurant.
                                </p>
                                <div className="space-y-4">
                                    <div>
                                        <Label>Image</Label>
                                        <Input
                                            type="file"
                                            ref={bannerFileInputRef}
                                            onChange={e => {
                                                setBannerFile(e.target.files[0] || null)
                                                setError(null)
                                            }}
                                            accept="image/*"
                                            className="mt-1"
                                        />
                                    </div>
                                    <div>
                                        <Label>Promo Text</Label>
                                        <Input value={bannerPercentageOff} onChange={e => { setBannerPercentageOff(e.target.value); setError(null) }} placeholder="Optional, e.g. 50% OFF" className="mt-1" />
                                    </div>
                                    <div>
                                        <Label>Tagline</Label>
                                        <Input value={bannerTagline} onChange={e => { setBannerTagline(e.target.value); setError(null) }} placeholder="Optional, e.g. Weekend dining specials" className="mt-1" />
                                    </div>
                                    <Button onClick={handleSubmitBanner} disabled={bannersUploading} className="w-full bg-primary hover:bg-primary/90">
                                        {bannersUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create Banner"}
                                    </Button>
                                </div>
                            </div>
                        </div>
                        <div className="lg:col-span-2">
                            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                                <h2 className="text-lg font-bold text-slate-900 mb-4">Dining Page Banners</h2>
                                {bannersLoading ? <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div> : (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        {banners.map(banner => (
                                            <div key={banner._id} className="border rounded-lg overflow-hidden group relative">
                                                <img src={banner.imageUrl} alt={banner.title || "Dining banner"} className="w-full h-32 object-cover" />
                                                <div className="p-3 bg-white">
                                                    {banner.ctaText && <p className="font-bold text-slate-900">{banner.ctaText}</p>}
                                                    {banner.title && <p className="text-sm text-slate-600">{banner.title}</p>}
                                                    <p className="text-xs text-slate-500 mt-1">
                                                        {banner.isActive === false ? "Inactive" : "Active on dining page"}
                                                    </p>
                                                </div>
                                                <button onClick={() => handleDeleteBanner(banner._id)} className="absolute top-2 right-2 p-1.5 bg-red-100 text-red-600 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                                                    {bannersDeleting === banner._id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                                                </button>
                                            </div>
                                        ))}
                                        {banners.length === 0 && <p className="text-slate-500 text-center col-span-full py-8">No banners found.</p>}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}

