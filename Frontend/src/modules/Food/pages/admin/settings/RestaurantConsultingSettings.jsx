import { useState, useEffect } from "react"
import { toast } from "sonner"
import api from "@food/api"
import { API_ENDPOINTS } from "@food/api/config"
import { Button } from "@food/components/ui/button"
import { Input } from "@food/components/ui/input"
import { Textarea } from "@food/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@food/components/ui/card"
import { Label } from "@food/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@food/components/ui/select"
import { 
  Briefcase, 
  ShieldCheck, 
  CreditCard, 
  User, 
  Percent, 
  Plus, 
  X, 
  Save, 
  Trash2, 
  Edit, 
  Info,
  CheckCircle,
  AlertTriangle,
  HelpCircle,
  Layers,
  Settings
} from "lucide-react"

const iconOptions = [
  { value: 'CreditCard', label: 'Credit Card (PAN)' },
  { value: 'User', label: 'User (Aadhaar)' },
  { value: 'ShieldCheck', label: 'Shield Check (FSSAI)' },
  { value: 'Percent', label: 'Percent (GST)' },
  { value: 'Briefcase', label: 'Briefcase (Consulting)' },
  { value: 'Info', label: 'Info' }
]

export default function RestaurantConsultingSettings() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState("general")
  const [role, setRole] = useState("user") // default role is user (restaurant owners are public users before onboarding)

  const [pageData, setPageData] = useState({
    heroTitle: 'Restaurant Consulting & Licensing Assistance',
    heroSubtitle: 'Get your restaurant compliant and ready to onboard quickly with our expert assistance.',
    heroBannerImage: '',
    heroCtaText: 'Become a Partner',
    applyFormUrl: 'https://docs.google.com/forms/d/e/1FAIpQLSfk0WaAX2M7r3JNTHKH9W9t6jss2bmi_eo4NSRbQuWu5d4xoQ/viewform?pli=1',
    applyButtonLabel: 'Apply Here',
    documents: [],
    contentSections: [],
    vendors: [],
    terms: []
  })

  // For vendor add/edit modal
  const [showVendorModal, setShowVendorModal] = useState(false)
  const [editingVendorIndex, setEditingVendorIndex] = useState(null)
  const [vendorForm, setVendorForm] = useState({
    name: '',
    logo: '',
    description: '',
    contactDetails: '',
    services: '',
    pricingInfo: '',
    status: 'active'
  })

  useEffect(() => {
    fetchPageData()
  }, [role])

  const fetchPageData = async () => {
    try {
      setLoading(true)
      const response = await api.get(`${API_ENDPOINTS.ADMIN.CONSULTING}?role=${role}`, { contextModule: "admin" })
      if (response.data.success) {
        const data = response.data.data
        if (data) {
          setPageData({
            heroTitle: data.heroTitle || 'Restaurant Consulting & Licensing Assistance',
            heroSubtitle: data.heroSubtitle || '',
            heroBannerImage: data.heroBannerImage || '',
            heroCtaText: data.heroCtaText || 'Become a Partner',
            applyFormUrl: data.applyFormUrl || 'https://docs.google.com/forms/d/e/1FAIpQLSfk0WaAX2M7r3JNTHKH9W9t6jss2bmi_eo4NSRbQuWu5d4xoQ/viewform?pli=1',
            applyButtonLabel: data.applyButtonLabel || 'Apply Here',
            documents: Array.isArray(data.documents) ? data.documents : [],
            contentSections: Array.isArray(data.contentSections) ? data.contentSections : [],
            vendors: Array.isArray(data.vendors) ? data.vendors : [],
            terms: Array.isArray(data.terms) ? data.terms : []
          })
        }
      }
    } catch (error) {
      console.error('Error fetching consulting data:', error)
      toast.error('Failed to load consulting page configuration')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async (updatedData = pageData) => {
    try {
      setSaving(true)
      const response = await api.put(
        API_ENDPOINTS.ADMIN.CONSULTING,
        { ...updatedData, role },
        { contextModule: "admin" }
      )
      if (response.data.success) {
        toast.success('Consulting page settings updated successfully')
        fetchPageData()
      }
    } catch (error) {
      console.error('Error saving consulting data:', error)
      toast.error(error.response?.data?.message || 'Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  // --- Document section handlers ---
  const updateDocument = (index, field, value) => {
    setPageData(prev => {
      const newDocs = [...prev.documents]
      newDocs[index] = { ...newDocs[index], [field]: value }
      return { ...prev, documents: newDocs }
    })
  }

  // --- Content sections handlers ---
  const addContentSection = () => {
    setPageData(prev => ({
      ...prev,
      contentSections: [...prev.contentSections, { heading: '', description: '' }]
    }))
  }

  const removeContentSection = (index) => {
    setPageData(prev => ({
      ...prev,
      contentSections: prev.contentSections.filter((_, i) => i !== index)
    }))
  }

  const updateContentSection = (index, field, value) => {
    setPageData(prev => {
      const newSections = [...prev.contentSections]
      newSections[index] = { ...newSections[index], [field]: value }
      return { ...prev, contentSections: newSections }
    })
  }

  // --- Vendors handlers ---
  const openAddVendorModal = () => {
    setVendorForm({
      name: '',
      logo: '',
      description: '',
      contactDetails: '',
      services: '',
      pricingInfo: '',
      status: 'active'
    })
    setEditingVendorIndex(null)
    setShowVendorModal(true)
  }

  const openEditVendorModal = (index) => {
    const v = pageData.vendors[index]
    setVendorForm({
      name: v.name || '',
      logo: v.logo || '',
      description: v.description || '',
      contactDetails: v.contactDetails || '',
      services: v.services || '',
      pricingInfo: v.pricingInfo || '',
      status: v.status || 'active'
    })
    setEditingVendorIndex(index)
    setShowVendorModal(true)
  }

  const saveVendor = () => {
    if (!vendorForm.name.trim()) {
      toast.error("Vendor Name is required")
      return
    }

    setPageData(prev => {
      const newVendors = [...prev.vendors]
      if (editingVendorIndex !== null) {
        newVendors[editingVendorIndex] = vendorForm
      } else {
        newVendors.push(vendorForm)
      }
      const updatedData = { ...prev, vendors: newVendors }
      // Auto-save
      handleSave(updatedData)
      return updatedData
    })
    setShowVendorModal(false)
  }

  const deleteVendor = (index) => {
    if (confirm("Are you sure you want to delete this vendor?")) {
      setPageData(prev => {
        const updated = {
          ...prev,
          vendors: prev.vendors.filter((_, i) => i !== index)
        }
        handleSave(updated)
        return updated
      })
    }
  }

  // --- Terms handlers ---
  const addTerm = () => {
    setPageData(prev => ({
      ...prev,
      terms: [...prev.terms, '']
    }))
  }

  const removeTerm = (index) => {
    setPageData(prev => ({
      ...prev,
      terms: prev.terms.filter((_, i) => i !== index)
    }))
  }

  const updateTerm = (index, value) => {
    setPageData(prev => {
      const newTerms = [...prev.terms]
      newTerms[index] = value
      return { ...prev, terms: newTerms }
    })
  }

  if (loading) {
    return (
      <div className="h-full overflow-y-auto bg-slate-50 p-4 lg:p-6 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#6412C6] mx-auto"></div>
          <p className="mt-4 text-slate-600 font-semibold">Loading consulting page configuration...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto bg-slate-50 p-4 lg:p-6 font-sans">
      <div className="max-w-6xl mx-auto">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-950 tracking-tight">Restaurant Consulting</h1>
            <p className="text-sm text-slate-600 mt-1">Configure licenses, required documents, vendor listing, and disclaimers</p>
          </div>
          
          <div className="flex items-center gap-4">
            {/* Role selector to match backend roles (usually 'user' since these are partners-to-be) */}
            <div className="flex p-1 bg-slate-200 rounded-xl">
              {[
                { id: "user", label: "Customer / Partner" },
                { id: "restaurant", label: "Restaurant Panel" }
              ].map((r) => (
                <button
                  key={r.id}
                  onClick={() => setRole(r.id)}
                  className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${
                    role === r.id 
                      ? "bg-white text-slate-950 shadow-sm" 
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>

            <Button onClick={() => handleSave()} disabled={saving} className="bg-[#6412C6] text-white font-bold hover:bg-[#4E0E9A] flex items-center gap-2 px-6 py-2.5 rounded-xl transition-all shadow-md hover:shadow-lg">
              <Save className="h-4 w-4" />
              {saving ? 'Saving...' : 'Save Settings'}
            </Button>
          </div>
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-slate-200 mb-6 gap-2">
          {[
            { id: "general", label: "Hero & Apply Button", icon: Settings },
            { id: "documents", label: "Required Documents", icon: CreditCard },
            { id: "helpCards", label: "Consulting Content", icon: HelpCircle },
            { id: "vendors", label: "Consultants & Vendors", icon: Briefcase },
            { id: "terms", label: "Terms & Disclaimers", icon: Info }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-all ${
                activeTab === tab.id
                  ? "border-[#6412C6] text-[#6412C6]"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Contents */}
        {activeTab === "general" && (
          <Card className="border border-slate-200 shadow-sm rounded-2xl overflow-hidden">
            <CardHeader className="bg-slate-50 border-b border-slate-100 p-6">
              <CardTitle className="text-xl font-bold text-slate-950">Hero & CTA Settings</CardTitle>
              <CardDescription>Customize the header banner copy, images, and target applications form</CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="heroTitle" className="font-semibold text-slate-800">Hero Section Title</Label>
                  <Input
                    id="heroTitle"
                    value={pageData.heroTitle}
                    onChange={(e) => setPageData(prev => ({ ...prev, heroTitle: e.target.value }))}
                    placeholder="Partner with Us & Scale Your Business"
                    className="rounded-xl border-slate-200 focus-visible:ring-[#6412C6]"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="heroCtaText" className="font-semibold text-slate-800">Hero CTA Button Text</Label>
                  <Input
                    id="heroCtaText"
                    value={pageData.heroCtaText}
                    onChange={(e) => setPageData(prev => ({ ...prev, heroCtaText: e.target.value }))}
                    placeholder="Become a Partner"
                    className="rounded-xl border-slate-200 focus-visible:ring-[#6412C6]"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="heroSubtitle" className="font-semibold text-slate-800">Hero Subtitle</Label>
                <Textarea
                  id="heroSubtitle"
                  value={pageData.heroSubtitle}
                  onChange={(e) => setPageData(prev => ({ ...prev, heroSubtitle: e.target.value }))}
                  placeholder="Get your licenses and onboard within 24 hours..."
                  rows={3}
                  className="rounded-xl border-slate-200 focus-visible:ring-[#6412C6]"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="heroBannerImage" className="font-semibold text-slate-800">Hero Banner Image URL</Label>
                <Input
                  id="heroBannerImage"
                  value={pageData.heroBannerImage}
                  onChange={(e) => setPageData(prev => ({ ...prev, heroBannerImage: e.target.value }))}
                  placeholder="https://example.com/banner.jpg"
                  className="rounded-xl border-slate-200 focus-visible:ring-[#6412C6]"
                />
                <p className="text-xs text-slate-500">Leave blank to use the modern default CSS banner gradient.</p>
              </div>

              <div className="border-t border-slate-100 pt-6 space-y-4">
                <h3 className="text-lg font-bold text-slate-900">Apply Form Settings</h3>
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="applyButtonLabel" className="font-semibold text-slate-800">Apply Button Label</Label>
                    <Input
                      id="applyButtonLabel"
                      value={pageData.applyButtonLabel}
                      onChange={(e) => setPageData(prev => ({ ...prev, applyButtonLabel: e.target.value }))}
                      placeholder="Apply Here"
                      className="rounded-xl border-slate-200 focus-visible:ring-[#6412C6]"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="applyFormUrl" className="font-semibold text-slate-800">Google Form URL</Label>
                    <Input
                      id="applyFormUrl"
                      value={pageData.applyFormUrl}
                      onChange={(e) => setPageData(prev => ({ ...prev, applyFormUrl: e.target.value }))}
                      placeholder="https://docs.google.com/forms/..."
                      className="rounded-xl border-slate-200 focus-visible:ring-[#6412C6]"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {activeTab === "documents" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-900">Required Documents Cards</h2>
              <p className="text-xs text-slate-500">Configure details for the 4 primary document cards</p>
            </div>
            
            <div className="grid md:grid-cols-2 gap-6">
              {pageData.documents.map((doc, idx) => (
                <Card key={idx} className="border border-slate-200 shadow-sm rounded-2xl">
                  <CardHeader className="bg-slate-50 border-b border-slate-100 p-4">
                    <CardTitle className="text-sm font-bold text-slate-950 flex items-center justify-between">
                      <span>Card #{idx + 1}</span>
                      <span className="text-xs px-2 py-0.5 bg-slate-200 rounded-full">{doc.title || "Untitled"}</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs font-semibold text-slate-700">Card Title</Label>
                        <Input
                          value={doc.title}
                          onChange={(e) => updateDocument(idx, 'title', e.target.value)}
                          placeholder="FSSAI License"
                          className="text-xs border-slate-200 focus-visible:ring-[#6412C6] mt-1"
                        />
                      </div>
                      <div>
                        <Label className="text-xs font-semibold text-slate-700">Icon</Label>
                        <Select
                          value={doc.icon}
                          onValueChange={(val) => updateDocument(idx, 'icon', val)}
                        >
                          <SelectTrigger className="text-xs mt-1 border-slate-200">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {iconOptions.map(opt => (
                              <SelectItem key={opt.value} value={opt.value}>
                                {opt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div>
                      <Label className="text-xs font-semibold text-slate-700">Description</Label>
                      <Input
                        value={doc.description}
                        onChange={(e) => updateDocument(idx, 'description', e.target.value)}
                        placeholder="Food safety licensing detail"
                        className="text-xs border-slate-200 focus-visible:ring-[#6412C6] mt-1"
                      />
                    </div>

                    <div>
                      <Label className="text-xs font-semibold text-slate-700">Requirement Explanation</Label>
                      <Textarea
                        value={doc.requirementExplanation}
                        onChange={(e) => updateDocument(idx, 'requirementExplanation', e.target.value)}
                        placeholder="Why is this document mandatory..."
                        rows={3}
                        className="text-xs border-slate-200 focus-visible:ring-[#6412C6] mt-1"
                      />
                    </div>
                  </CardContent>
                </Card>
              ))}
              {pageData.documents.length === 0 && (
                <div className="col-span-2 text-center py-10 bg-white border rounded-2xl text-slate-400">
                  No documents configurations found. Hit Save Settings to load fallbacks.
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "helpCards" && (
          <Card className="border border-slate-200 shadow-sm rounded-2xl overflow-hidden">
            <CardHeader className="bg-slate-50 border-b border-slate-100 p-6 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-xl font-bold text-slate-950">Consulting Content Sections</CardTitle>
                <CardDescription>Configure help cards explaining compliance details (e.g. FSSAI assistance, GST assistance)</CardDescription>
              </div>
              <Button onClick={addContentSection} size="sm" className="bg-[#6412C6] text-white font-bold hover:bg-[#4E0E9A] rounded-xl">
                <Plus className="h-4 w-4 mr-2" />
                Add Help Card
              </Button>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              {pageData.contentSections.map((sec, idx) => (
                <div key={idx} className="flex gap-4 p-4 border rounded-xl bg-slate-50/50 items-start">
                  <div className="flex-1 grid md:grid-cols-3 gap-4">
                    <div className="md:col-span-1 space-y-1">
                      <Label className="text-xs font-semibold text-slate-700">Heading</Label>
                      <Input
                        value={sec.heading}
                        onChange={(e) => updateContentSection(idx, 'heading', e.target.value)}
                        placeholder="FSSAI Registration"
                        className="border-slate-200 text-sm focus-visible:ring-[#6412C6] mt-1 bg-white"
                      />
                    </div>
                    <div className="md:col-span-2 space-y-1">
                      <Label className="text-xs font-semibold text-slate-700">Description</Label>
                      <Textarea
                        value={sec.description}
                        onChange={(e) => updateContentSection(idx, 'description', e.target.value)}
                        placeholder="We help restaurants acquire..."
                        rows={2}
                        className="border-slate-200 text-sm focus-visible:ring-[#6412C6] mt-1 bg-white"
                      />
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeContentSection(idx)}
                    className="text-red-500 hover:text-red-700 self-center hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              {pageData.contentSections.length === 0 && (
                <p className="text-center text-slate-400 py-8">No content sections added yet. Click Add Help Card to start.</p>
              )}
            </CardContent>
          </Card>
        )}

        {activeTab === "vendors" && (
          <Card className="border border-slate-200 shadow-sm rounded-2xl overflow-hidden">
            <CardHeader className="bg-slate-50 border-b border-slate-100 p-6 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-xl font-bold text-slate-950">Compliance Partners & Consultants</CardTitle>
                <CardDescription>Configure external experts restaurant owners can reach out to directly</CardDescription>
              </div>
              <Button onClick={openAddVendorModal} size="sm" className="bg-[#6412C6] text-white font-bold hover:bg-[#4E0E9A] rounded-xl">
                <Plus className="h-4 w-4 mr-2" />
                Add Consultant
              </Button>
            </CardHeader>
            <CardContent className="p-6">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left text-slate-500">
                  <thead className="text-xs text-slate-700 uppercase bg-slate-100/80 rounded-lg">
                    <tr>
                      <th className="px-4 py-3 rounded-l-lg">Consultant Details</th>
                      <th className="px-4 py-3">Services</th>
                      <th className="px-4 py-3">Pricing Info</th>
                      <th className="px-4 py-3">Contact</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right rounded-r-lg">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {pageData.vendors.map((vendor, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50">
                        <td className="px-4 py-4 flex items-center gap-3">
                          {vendor.logo ? (
                            <img src={vendor.logo} alt="Logo" className="w-10 h-10 object-contain rounded-lg border bg-white" />
                          ) : (
                            <div className="w-10 h-10 bg-slate-200 rounded-lg flex items-center justify-center font-bold text-slate-500 text-xs">CS</div>
                          )}
                          <div>
                            <div className="font-bold text-slate-900">{vendor.name}</div>
                            <div className="text-xs text-slate-500 max-w-[200px] truncate">{vendor.description}</div>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-xs font-semibold text-slate-800">{vendor.services}</td>
                        <td className="px-4 py-4 text-xs text-slate-700">{vendor.pricingInfo}</td>
                        <td className="px-4 py-4 text-xs font-mono">{vendor.contactDetails}</td>
                        <td className="px-4 py-4">
                          <span className={`px-2 py-1 text-[10px] font-bold rounded-full uppercase ${
                            vendor.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                          }`}>
                            {vendor.status}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-right space-x-1 whitespace-nowrap">
                          <Button size="icon" variant="ghost" onClick={() => openEditVendorModal(idx)} className="h-8 w-8 text-slate-700 hover:text-slate-900">
                            <Edit className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => deleteVendor(idx)} className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50">
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                    {pageData.vendors.length === 0 && (
                      <tr>
                        <td colSpan={6} className="text-center py-8 text-slate-400">No consultants listed yet. Click Add Consultant to get started.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {activeTab === "terms" && (
          <Card className="border border-slate-200 shadow-sm rounded-2xl overflow-hidden">
            <CardHeader className="bg-slate-50 border-b border-slate-100 p-6 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-xl font-bold text-slate-950">Terms & Disclaimers</CardTitle>
                <CardDescription>Add disclaimers, support processes, and terms of consulting support</CardDescription>
              </div>
              <Button onClick={addTerm} size="sm" className="bg-[#6412C6] text-white font-bold hover:bg-[#4E0E9A] rounded-xl">
                <Plus className="h-4 w-4 mr-2" />
                Add Disclaimer
              </Button>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              {pageData.terms.map((term, idx) => (
                <div key={idx} className="flex gap-3 items-center">
                  <span className="text-xs font-mono font-bold bg-slate-200 text-slate-800 h-6 w-6 rounded-full flex items-center justify-center shrink-0">
                    {idx + 1}
                  </span>
                  <Input
                    value={term}
                    onChange={(e) => updateTerm(idx, e.target.value)}
                    placeholder="Enter compliance disclaimer here..."
                    className="border-slate-200 text-sm focus-visible:ring-[#6412C6] flex-1 rounded-xl"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeTerm(idx)}
                    className="text-red-500 hover:text-red-700 hover:bg-red-50"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              {pageData.terms.length === 0 && (
                <p className="text-center text-slate-400 py-8">No terms added yet. Click Add Disclaimer to begin.</p>
              )}
            </CardContent>
          </Card>
        )}

      </div>

      {/* Vendor Add/Edit Modal */}
      {showVendorModal && (
        <div className="fixed inset-0 z-50 bg-black/55 backdrop-blur-sm flex items-center justify-center p-4 transition-all">
          <Card className="w-full max-w-lg border-none shadow-2xl rounded-3xl overflow-hidden animate-in zoom-in-95 duration-150">
            <CardHeader className="bg-[#6412C6] text-white p-6 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg font-bold">
                  {editingVendorIndex !== null ? 'Edit Consultant' : 'Add Compliance Consultant'}
                </CardTitle>
                <p className="text-xs text-purple-100 mt-1">Configure compliance agencies, consultants or lawyers</p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setShowVendorModal(false)} className="text-white/80 hover:text-white hover:bg-white/10 rounded-full">
                <X className="h-5 w-5" />
              </Button>
            </CardHeader>
            <CardContent className="p-6 space-y-4 overflow-y-auto max-h-[75vh]">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label htmlFor="vName" className="text-xs font-semibold text-slate-700">Consultant / Agency Name *</Label>
                  <Input
                    id="vName"
                    value={vendorForm.name}
                    onChange={(e) => setVendorForm(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Licensing Masters"
                    className="rounded-xl border-slate-200 focus-visible:ring-[#6412C6]"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="vStatus" className="text-xs font-semibold text-slate-700">Status</Label>
                  <Select
                    value={vendorForm.status}
                    onValueChange={(val) => setVendorForm(prev => ({ ...prev, status: val }))}
                  >
                    <SelectTrigger className="rounded-xl border-slate-200">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="vLogo" className="text-xs font-semibold text-slate-700">Logo Image URL</Label>
                <Input
                  id="vLogo"
                  value={vendorForm.logo}
                  onChange={(e) => setVendorForm(prev => ({ ...prev, logo: e.target.value }))}
                  placeholder="https://example.com/logo.png"
                  className="rounded-xl border-slate-200 focus-visible:ring-[#6412C6]"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="vDesc" className="text-xs font-semibold text-slate-700">Description</Label>
                <Textarea
                  id="vDesc"
                  value={vendorForm.description}
                  onChange={(e) => setVendorForm(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Expert FSSAI license consultancy with 10+ years experience..."
                  rows={2}
                  className="rounded-xl border-slate-200 focus-visible:ring-[#6412C6]"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label htmlFor="vServices" className="text-xs font-semibold text-slate-700">Services Offered</Label>
                  <Input
                    id="vServices"
                    value={vendorForm.services}
                    onChange={(e) => setVendorForm(prev => ({ ...prev, services: e.target.value }))}
                    placeholder="FSSAI Basic, State & Central, GST"
                    className="rounded-xl border-slate-200 focus-visible:ring-[#6412C6]"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="vPricing" className="text-xs font-semibold text-slate-700">Pricing Info</Label>
                  <Input
                    id="vPricing"
                    value={vendorForm.pricingInfo}
                    onChange={(e) => setVendorForm(prev => ({ ...prev, pricingInfo: e.target.value }))}
                    placeholder="Starts at ₹1,999 + Govt Fees"
                    className="rounded-xl border-slate-200 focus-visible:ring-[#6412C6]"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="vContact" className="text-xs font-semibold text-slate-700">Contact Details (Phone / Email)</Label>
                <Input
                  id="vContact"
                  value={vendorForm.contactDetails}
                  onChange={(e) => setVendorForm(prev => ({ ...prev, contactDetails: e.target.value }))}
                  placeholder="+91 98765 43210 / info@masters.com"
                  className="rounded-xl border-slate-200 font-mono focus-visible:ring-[#6412C6]"
                />
              </div>

              <div className="flex justify-end gap-3 border-t pt-4">
                <Button variant="outline" onClick={() => setShowVendorModal(false)} className="rounded-xl hover:bg-purple-50 hover:text-[#6412C6] hover:border-[#6412C6]">
                  Cancel
                </Button>
                <Button onClick={saveVendor} className="bg-[#6412C6] text-white hover:bg-[#4E0E9A] rounded-xl px-5 font-bold">
                  {editingVendorIndex !== null ? 'Update Consultant' : 'Add Consultant'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

    </div>
  )
}
