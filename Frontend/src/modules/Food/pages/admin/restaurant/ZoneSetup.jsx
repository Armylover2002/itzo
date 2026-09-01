import { useState, useEffect, useMemo } from "react"
import { useNavigate } from "react-router-dom"
import { MapPin, Plus, Search, Edit, Trash2, Eye, Map, Bike } from "lucide-react"
import { adminAPI } from "@food/api"
import { useAuth } from "@core/context/AuthContext"
import { getCurrentUser } from "@food/utils/auth"
import { canPerformAdminPermissionAction, extractAdminPermissions, extractAdminRoleId, fetchAdminRolePermissions } from "@food/utils/adminPermissions"
const debugLog = (...args) => {}
const debugWarn = (...args) => {}
const debugError = (...args) => {}

const EARTH_RADIUS_METERS = 6371000
const toRadians = (deg) => (deg * Math.PI) / 180

// Exact for circle zones (radiusMeters), approximated (shoelace) for polygons.
const formatZoneArea = (zone) => {
  let areaMeters = 0
  if (zone.shapeType === 'circle' && Number.isFinite(zone.radiusMeters)) {
    areaMeters = Math.PI * zone.radiusMeters ** 2
  } else if (Array.isArray(zone.coordinates) && zone.coordinates.length >= 3) {
    const coords = zone.coordinates
    const refLat = toRadians(coords.reduce((sum, c) => sum + c.latitude, 0) / coords.length)
    const projected = coords.map((c) => ({
      x: EARTH_RADIUS_METERS * toRadians(c.longitude) * Math.cos(refLat),
      y: EARTH_RADIUS_METERS * toRadians(c.latitude),
    }))
    let area = 0
    for (let i = 0; i < projected.length; i++) {
      const p1 = projected[i]
      const p2 = projected[(i + 1) % projected.length]
      area += p1.x * p2.y - p2.x * p1.y
    }
    areaMeters = Math.abs(area / 2)
  }
  if (!areaMeters) return null
  return zone.unit === 'miles'
    ? `${(areaMeters / (1609.344 * 1609.344)).toFixed(2)} mi²`
    : `${(areaMeters / 1_000_000).toFixed(2)} km²`
}

export default function ZoneSetup() {
  const navigate = useNavigate()
  const { user: authUser } = useAuth()
  const currentUser = useMemo(() => authUser || getCurrentUser("admin"), [authUser])
  const [resolvedPermissions, setResolvedPermissions] = useState({})

  useEffect(() => {
    let isMounted = true

    const resolvePermissions = async () => {
      if (!currentUser || currentUser.role === "ADMIN") {
        if (isMounted) setResolvedPermissions({})
        return
      }

      const existingPermissions = extractAdminPermissions(currentUser)
      if (Object.keys(existingPermissions).length > 0) {
        if (isMounted) setResolvedPermissions(existingPermissions)
        return
      }

      const roleId = extractAdminRoleId(currentUser)
      if (!roleId) {
        if (isMounted) setResolvedPermissions({})
        return
      }

      try {
        const rolePermissions = await fetchAdminRolePermissions(roleId)
        if (isMounted) setResolvedPermissions(rolePermissions)
      } catch {
        if (isMounted) setResolvedPermissions({})
      }
    }

    resolvePermissions()

    return () => {
      isMounted = false
    }
  }, [currentUser])

  const canCreate = useMemo(() => {
    return canPerformAdminPermissionAction(currentUser, resolvedPermissions, "food::restaurant_management::zone_setup", "create")
  }, [currentUser, resolvedPermissions])

  const canEdit = useMemo(() => {
    return canPerformAdminPermissionAction(currentUser, resolvedPermissions, "food::restaurant_management::zone_setup", "edit")
  }, [currentUser, resolvedPermissions])

  const canDelete = useMemo(() => {
    return canPerformAdminPermissionAction(currentUser, resolvedPermissions, "food::restaurant_management::zone_setup", "delete")
  }, [currentUser, resolvedPermissions])

  const [zones, setZones] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")

  useEffect(() => {
    fetchZones()
  }, [])

  const fetchZones = async () => {
    try {
      setLoading(true)
      const response = await adminAPI.getZones()
      if (response.data?.success && response.data.data?.zones) {
        setZones(response.data.data.zones)
      }
    } catch (error) {
      debugError("Error fetching zones:", error)
      setZones([])
    } finally {
      setLoading(false)
    }
  }


  const handleDeleteZone = async (zoneId) => {
    if (!canDelete) {
      alert("Permission denied")
      return
    }
    if (!window.confirm("Are you sure you want to delete this zone?")) {
      return
    }
    try {
      await adminAPI.deleteZone(zoneId)
      alert("Zone deleted successfully!")
      fetchZones()
    } catch (error) {
      debugError("Error deleting zone:", error)
      alert(error.response?.data?.message || "Failed to delete zone")
    }
  }

  const filteredZones = zones.filter(zone =>
    zone.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    zone.serviceLocation?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="p-2 lg:p-3 bg-slate-50 min-h-screen">
      <div className="w-full mx-auto max-w-7xl">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
          <div className="flex items-center gap-3 mb-4 md:mb-0">
            <div className="w-10 h-10 rounded-lg bg-red-500 flex items-center justify-center">
              <MapPin className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Zone Setup Restaurant</h1>
              <p className="text-sm text-slate-600">Manage delivery zones for restaurants</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate("/ecs/food/zone-setup/delivery-boy-view")}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors"
            >
              <Bike className="w-5 h-5" />
              <span>Delivery Boy View</span>
            </button>
            <button
              onClick={() => navigate("/ecs/food/zone-setup/map")}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <Map className="w-5 h-5" />
              <span>View Map</span>
            </button>
            {canCreate && (
              <button
                onClick={() => navigate("/ecs/food/zone-setup/add")}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
              >
                <Plus className="w-5 h-5" />
                <span>Add Zone</span>
              </button>
            )}
          </div>
        </div>

        {/* Search Bar */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4 mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Search zones by name or location..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>

        {/* Zones List */}
        {loading ? (
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-slate-600">Loading zones...</p>
          </div>
        ) : filteredZones.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-12 text-center">
            <MapPin className="w-16 h-16 text-slate-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-900 mb-2">No zones found</h3>
            <p className="text-slate-600 mb-6">
              {searchQuery ? "Try adjusting your search query" : "Create your first delivery zone to get started"}
            </p>
            {!searchQuery && canCreate && (
              <button
                onClick={() => navigate("/ecs/food/zone-setup/add")}
                className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
              >
                <Plus className="w-5 h-5" />
                <span>Add Zone</span>
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredZones.map((zone) => (
              <div
                key={zone._id || zone.id}
                className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-slate-900 mb-1">{zone.name || "Unnamed Zone"}</h3>
                    <p className="text-sm text-slate-600">{zone.serviceLocation || "N/A"}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => navigate(`/ecs/food/zone-setup/view/${zone._id || zone.id}`)}
                      className="p-2 text-slate-600 hover:text-primary hover:bg-orange-50 rounded-lg transition-colors"
                      title="View"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    {canEdit && (
                      <button
                        onClick={() => navigate(`/ecs/food/zone-setup/edit/${zone._id || zone.id}`)}
                        className="p-2 text-slate-600 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                        title="Edit"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                    )}
                    {canDelete && (
                      <button
                        onClick={() => handleDeleteZone(zone._id || zone.id)}
                        className="p-2 text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600">Unit:</span>
                    <span className="font-medium text-slate-900">{zone.unit || "km"}</span>
                  </div>
                  {formatZoneArea(zone) && (
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600">Area:</span>
                      <span className="font-medium text-slate-900">{formatZoneArea(zone)}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600">Status:</span>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      zone.isActive ? "bg-green-100 text-green-800" : "bg-slate-100 text-slate-800"
                    }`}>
                      {zone.isActive ? "Active" : "Inactive"}
                    </span>
                  </div>
                  {zone.coordinates && zone.coordinates.length > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600">Points:</span>
                      <span className="font-medium text-slate-900">{zone.coordinates.length}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

