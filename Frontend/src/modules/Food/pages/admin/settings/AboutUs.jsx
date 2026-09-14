import { useState, useEffect } from "react"
import { toast } from "sonner"
import api, { adminAPI } from "@food/api"
import { API_ENDPOINTS } from "@food/api/config"
import { Heart, Users, Shield, Clock, Star, Award, Plus, X, GripVertical } from "lucide-react"
import { Button } from "@food/components/ui/button"
import { Input } from "@food/components/ui/input"
import { Textarea } from "@food/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@food/components/ui/card"
import { Label } from "@food/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@food/components/ui/select"
import { useCompanyName } from "@food/hooks/useCompanyName"
const debugLog = (...args) => {}
const debugWarn = (...args) => {}
const debugError = (...args) => {}


// Icon mapping
const iconMap = {
  Heart,
  Users,
  Shield,
  Clock,
  Star,
  Award
}

const iconOptions = [
  { value: 'Heart', label: 'Heart' },
  { value: 'Users', label: 'Users' },
  { value: 'Shield', label: 'Shield' },
  { value: 'Clock', label: 'Clock' },
  { value: 'Star', label: 'Star' },
  { value: 'Award', label: 'Award' }
]

const colorOptions = [
  { value: 'text-pink-600 dark:text-pink-400', label: 'Pink', bg: 'bg-pink-100 dark:bg-pink-900/30' },
  { value: 'text-blue-600 dark:text-blue-400', label: 'Blue', bg: 'bg-blue-100 dark:bg-blue-900/30' },
  { value: 'text-green-600 dark:text-green-400', label: 'Green', bg: 'bg-green-100 dark:bg-green-900/30' },
  { value: 'text-red-600 dark:text-red-400', label: 'Orange', bg: 'bg-red-100 dark:bg-red-900/30' },
  { value: 'text-purple-600 dark:text-purple-400', label: 'Purple', bg: 'bg-purple-100 dark:bg-purple-900/30' },
  { value: 'text-red-600 dark:text-red-400', label: 'Red', bg: 'bg-red-100 dark:bg-red-900/30' }
]

export default function AboutUs() {
  const companyName = useCompanyName()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [aboutData, setAboutData] = useState({
    appName: 'Appzeto Food',
    version: '1.0.0',
    description: '',
    logo: '',
    features: []
  })

  useEffect(() => {
    fetchAboutData()
  }, [])

  const fetchAboutData = async () => {
    try {
      setLoading(true)
      const response = await api.get(API_ENDPOINTS.ADMIN.ABOUT, { contextModule: "admin" })
      if (response.data.success) {
        const data = response.data.data
        if (data && typeof data === "object") {
          setAboutData((prev) => ({
            ...prev,
            ...data,
            features: Array.isArray(data.features) ? data.features : [],
          }))
        }
      }
    } catch (error) {
      debugError('Error fetching about data:', error)
      toast.error('Failed to load about page data')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    try {
      setSaving(true)
      const response = await api.put(API_ENDPOINTS.ADMIN.ABOUT, aboutData, { contextModule: "admin" })
      if (response.data.success) {
        toast.success('About page updated successfully')
        const data = response.data.data
        if (data && typeof data === "object") {
          setAboutData((prev) => ({
            ...prev,
            ...data,
            features: Array.isArray(data.features) ? data.features : [],
          }))
        }
      }
    } catch (error) {
      debugError('Error saving about data:', error)
      toast.error(error.response?.data?.message || 'Failed to save about page')
    } finally {
      setSaving(false)
    }
  }

  const addFeature = () => {
    setAboutData(prev => ({
      ...prev,
      features: [
        ...prev.features,
        {
          icon: 'Heart',
          title: '',
          description: '',
          color: 'text-pink-600 dark:text-pink-400',
          bgColor: 'bg-pink-100 dark:bg-pink-900/30',
          order: prev.features.length
        }
      ]
    }))
  }

  const removeFeature = async (index) => {
    try {
      // Update state immediately for better UX
      const updatedData = {
        ...aboutData,
        features: aboutData.features.filter((_, i) => i !== index)
      }

      setAboutData(updatedData)

      // Save to backend immediately
      setSaving(true)
      const response = await api.put(API_ENDPOINTS.ADMIN.ABOUT, updatedData, { contextModule: "admin" })
      if (response.data.success) {
        toast.success('Feature deleted successfully')
        const data = response.data.data
        if (data && typeof data === "object") {
          setAboutData((prev) => ({
            ...prev,
            ...data,
            features: Array.isArray(data.features) ? data.features : [],
          }))
        }
      }
    } catch (error) {
      debugError('Error deleting feature:', error)
      toast.error(error.response?.data?.message || 'Failed to delete feature')
      // Revert state on error
      fetchAboutData()
    } finally {
      setSaving(false)
    }
  }

  const updateFeature = (index, field, value) => {
    setAboutData(prev => {
      const newFeatures = [...prev.features]
      newFeatures[index] = { ...newFeatures[index], [field]: value }

      // Update bgColor when color changes
      if (field === 'color') {
        const colorOption = colorOptions.find(opt => opt.value === value)
        if (colorOption) {
          newFeatures[index].bgColor = colorOption.bg
        }
      }

      return { ...prev, features: newFeatures }
    })
  }

  if (loading) {
    return (
      <div className="h-full overflow-y-auto bg-slate-50 p-4 lg:p-6 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-slate-600">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto bg-slate-50 p-4 lg:p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">About Us</h1>
            <p className="text-sm text-slate-600 mt-1">Manage your About page content</p>
          </div>
          <Button onClick={handleSave} disabled={saving} size="lg" className="shrink-0">
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>

        {/* Basic Information */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="appName">App Name</Label>
              <Input
                id="appName"
                value={aboutData.appName}
                onChange={(e) => setAboutData(prev => ({ ...prev, appName: e.target.value }))}
                placeholder={companyName}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="version">Version</Label>
              <Input
                id="version"
                value={aboutData.version}
                onChange={(e) => setAboutData(prev => ({ ...prev, version: e.target.value }))}
                placeholder="1.0.0"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={aboutData.description}
                onChange={(e) => setAboutData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Your trusted food delivery partner..."
                rows={4}
                className="mt-1 w-full"
              />
            </div>
            <div>
              <Label htmlFor="logo">Logo URL</Label>
              <Input
                id="logo"
                value={aboutData.logo}
                onChange={(e) => setAboutData(prev => ({ ...prev, logo: e.target.value }))}
                placeholder="https://example.com/logo.png"
                className="mt-1"
              />
            </div>
          </CardContent>
        </Card>

        {/* Features */}
        <Card className="mb-6">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Features</CardTitle>
            <Button onClick={addFeature} size="sm" variant="outline">
              <Plus className="h-4 w-4 mr-2" />
              Add Feature
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {aboutData.features.map((feature, index) => {
              const IconComponent = iconMap[feature.icon] || Heart
              return (
                <Card key={index} className="border-2">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-4">
                      <div className={`${feature.bgColor} rounded-lg p-3 shrink-0`}>
                        <IconComponent className={`h-6 w-6 ${feature.color}`} />
                      </div>
                      <div className="flex-1 space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label>Icon</Label>
                            <Select
                              value={feature.icon}
                              onValueChange={(value) => updateFeature(index, 'icon', value)}
                            >
                              <SelectTrigger>
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
                          <div>
                            <Label>Color</Label>
                            <Select
                              value={feature.color}
                              onValueChange={(value) => updateFeature(index, 'color', value)}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {colorOptions.map(opt => (
                                  <SelectItem key={opt.value} value={opt.value}>
                                    {opt.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div>
                          <Label>Title</Label>
                          <Input
                            value={feature.title}
                            onChange={(e) => updateFeature(index, 'title', e.target.value)}
                            placeholder="Feature title"
                          />
                        </div>
                        <div>
                          <Label>Description</Label>
                          <Textarea
                            value={feature.description}
                            onChange={(e) => updateFeature(index, 'description', e.target.value)}
                            placeholder="Feature description"
                            rows={4}
                            className="w-full"
                          />
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeFeature(index)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
            {aboutData.features.length === 0 && (
              <p className="text-center text-slate-500 py-8">No features added yet. Click "Add Feature" to get started.</p>
            )}
          </CardContent>
        </Card>

      </div>
    </div>
  )
}

