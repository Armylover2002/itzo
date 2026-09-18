import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import axiosInstance from '@core/api/axios';
import { toast } from 'sonner';
import {
    Loader2, ArrowLeft, Navigation, Map as MapIcon, User, Clock,
    AlertTriangle, Calendar, MapPin, Users, RefreshCw, Activity,
    CheckCircle, XCircle, Radio, ChevronRight, Wifi, WifiOff
} from 'lucide-react';
import { GoogleMap, useJsApiLoader, Polyline, Marker, InfoWindow } from '@react-google-maps/api';

const mapContainerStyle = { width: '100%', height: '100%' };
const defaultCenter = { lat: 20.5937, lng: 78.9629 }; // India Center
const mapLibraries = ['places'];

const MemoizedGoogleMap = React.memo(({ pathCoordinates, points, isLive, isMock, onLoadMap, selectedPoint, setSelectedPoint, fallbackCenter }) => {
    const latestPoint = points[points.length - 1];
    return (
        <GoogleMap
            mapContainerStyle={mapContainerStyle}
            center={pathCoordinates.length > 0 ? pathCoordinates[pathCoordinates.length - 1] : fallbackCenter}
            zoom={pathCoordinates.length > 0 ? 15 : (fallbackCenter !== defaultCenter ? 15 : 4)}
            onLoad={onLoadMap}
            options={{ streetViewControl: false, mapTypeControl: false, fullscreenControl: false }}
        >
            {pathCoordinates.length > 0 && <Polyline path={pathCoordinates} options={{ strokeColor: '#f97316', strokeOpacity: 0.8, strokeWeight: 5 }} />}

            {points.length > 0 && (
                <Marker
                    position={pathCoordinates[0]}
                    label={{ text: 'S', color: 'white', fontWeight: 'bold' }}
                    icon={{ path: window.google.maps.SymbolPath.CIRCLE, fillColor: '#10b981', fillOpacity: 1, strokeWeight: 2, strokeColor: 'white', scale: 10 }}
                    onClick={() => setSelectedPoint(points[0])}
                />
            )}

            {points.length > 1 && (
                <Marker
                    position={pathCoordinates[pathCoordinates.length - 1]}
                    icon={{ path: window.google.maps.SymbolPath.CIRCLE, fillColor: isMock ? '#ef4444' : isLive ? '#3b82f6' : '#f97316', fillOpacity: 1, strokeWeight: 2, strokeColor: 'white', scale: 10 }}
                    onClick={() => setSelectedPoint(latestPoint)}
                />
            )}

            {selectedPoint && (
                <InfoWindow
                    position={{ lat: selectedPoint.latitude, lng: selectedPoint.longitude }}
                    onCloseClick={() => setSelectedPoint(null)}
                >
                    <div className="p-1 max-w-[200px]">
                        <p className="text-xs font-bold text-slate-900 mb-1">{new Date(selectedPoint.timestamp).toLocaleTimeString()}</p>
                        <p className="text-[10px] text-slate-500 mb-2 font-mono break-all">{selectedPoint.latitude}, {selectedPoint.longitude}</p>
                        <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[10px]">
                            <span className="text-slate-500">Accuracy:</span><span className="font-medium">{Math.round(selectedPoint.accuracy)}m</span>
                            <span className="text-slate-500">Speed:</span><span className="font-medium">{selectedPoint.speed ? Math.round(selectedPoint.speed * 3.6) + ' km/h' : '0 km/h'}</span>
                            <span className="text-slate-500">Battery:</span><span className="font-medium">{selectedPoint.batteryLevel ? Math.round(selectedPoint.batteryLevel * 100) + '%' : '—'}</span>
                        </div>
                        {selectedPoint.isMocked && (
                            <div className="mt-2 flex items-center gap-1 text-red-600 bg-red-50 p-1 rounded text-[10px] font-bold">
                                <AlertTriangle className="w-3 h-3" /> MOCK LOCATION DETECTED
                            </div>
                        )}
                    </div>
                </InfoWindow>
            )}
        </GoogleMap>
    );
});

// ─────────────────────────────────────────────────────────
// Fleet Overview (no employeeId selected)
// ─────────────────────────────────────────────────────────
function LiveFleetOverview() {
    const navigate = useNavigate();
    const [liveData, setLiveData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [lastRefreshed, setLastRefreshed] = useState(null);
    const isHrmsPortal = window.location.pathname.startsWith('/hrms');

    const fetchLiveLocations = useCallback(async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const res = await axiosInstance.get('/hrms/location-tracks/live');
            setLiveData(res.data?.data || []);
            setLastRefreshed(new Date());
        } catch (e) {
            if (!silent) toast.error('Failed to load live locations');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchLiveLocations();
        // Auto-refresh every 60 seconds
        const interval = setInterval(() => fetchLiveLocations(true), 60000);
        return () => clearInterval(interval);
    }, [fetchLiveLocations]);

    const handleViewEmployee = (emp) => {
        const basePath = isHrmsPortal ? '/hrms/team/live-tracking' : '/ecs/hrms/live-tracking';
        navigate(`${basePath}?employeeId=${emp.employee._id}`);
    };

    const activeCount = liveData.filter(d => d.tracking?.isTracking).length;
    const checkedOutCount = liveData.filter(d => d.attendance && !d.tracking?.isTracking).length;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#f7f3fc] flex items-center justify-center">
                        <MapPin className="w-5 h-5 text-[#6412c6]" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">Live Tracking</h1>
                        <p className="text-sm text-slate-500 mt-0.5">
                            Field employee locations · Auto-refreshes every minute
                            {lastRefreshed && (
                                <span className="ml-2 text-slate-400">
                                    Last: {lastRefreshed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                            )}
                        </p>
                    </div>
                </div>
                <button
                    onClick={() => fetchLiveLocations()}
                    disabled={loading}
                    className="flex items-center gap-2 px-4 py-2 bg-[#6412c6] hover:bg-[#550fa8] disabled:opacity-50 text-white rounded-xl font-semibold text-sm transition-colors"
                >
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    Refresh
                </button>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white border border-slate-200 rounded-2xl p-4 flex items-center gap-4 shadow-sm">
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
                        <Radio className="w-5 h-5 text-emerald-600" />
                    </div>
                    <div>
                        <p className="text-2xl font-bold text-slate-900">{activeCount}</p>
                        <p className="text-xs text-slate-500 font-medium">Actively Tracking</p>
                    </div>
                    {activeCount > 0 && (
                        <span className="ml-auto flex h-2.5 w-2.5 relative">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                        </span>
                    )}
                </div>
                <div className="bg-white border border-slate-200 rounded-2xl p-4 flex items-center gap-4 shadow-sm">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center">
                        <CheckCircle className="w-5 h-5 text-slate-500" />
                    </div>
                    <div>
                        <p className="text-2xl font-bold text-slate-900">{checkedOutCount}</p>
                        <p className="text-xs text-slate-500 font-medium">Checked Out</p>
                    </div>
                </div>
                <div className="bg-white border border-slate-200 rounded-2xl p-4 flex items-center gap-4 shadow-sm">
                    <div className="w-10 h-10 rounded-xl bg-[#f7f3fc] flex items-center justify-center">
                        <Users className="w-5 h-5 text-[#550fa8]" />
                    </div>
                    <div>
                        <p className="text-2xl font-bold text-slate-900">{liveData.length}</p>
                        <p className="text-xs text-slate-500 font-medium">Total Field Staff Today</p>
                    </div>
                </div>
            </div>

            {/* Employee List */}
            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <Loader2 className="w-8 h-8 animate-spin text-[#6412c6]" />
                </div>
            ) : liveData.length === 0 ? (
                <div className="bg-white border border-slate-200 rounded-2xl p-16 text-center shadow-sm">
                    <MapPin className="w-14 h-14 text-slate-200 mx-auto mb-4" />
                    <h3 className="text-lg font-bold text-slate-900 mb-1">No Field Employees Today</h3>
                    <p className="text-slate-500 text-sm max-w-sm mx-auto">
                        None of your field employees have checked in today, or there are no field-type employees assigned to your team.
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {liveData.map((item) => {
                        const isTracking = item.tracking?.isTracking;
                        const hasNoLocation = !item.tracking?.currentLocation;
                        const distKm = item.tracking?.totalDistance
                            ? (item.tracking.totalDistance / 1000).toFixed(1)
                            : '0';

                        return (
                            <button
                                key={item.employee._id}
                                onClick={() => handleViewEmployee(item)}
                                className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md hover:border-[#d8c4f1] transition-all text-left group w-full"
                            >
                                <div className="flex items-start justify-between mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600 font-bold text-sm">
                                            {(item.employee.name || 'E')[0].toUpperCase()}
                                        </div>
                                        <div>
                                            <p className="font-semibold text-slate-900 text-sm">{item.employee.name || 'Unknown'}</p>
                                            <p className="text-xs text-slate-500">{item.employee.designation || item.employee.department || 'Field Employee'}</p>
                                        </div>
                                    </div>
                                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide ${
                                        isTracking
                                            ? 'bg-emerald-100 text-emerald-700'
                                            : 'bg-slate-100 text-slate-500'
                                    }`}>
                                        {isTracking ? (
                                            <>
                                                <span className="inline-flex relative h-1.5 w-1.5">
                                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                                                </span>
                                                Live
                                            </>
                                        ) : 'Checked Out'}
                                    </span>
                                </div>

                                <div className="grid grid-cols-2 gap-3 text-sm mb-4">
                                    <div className="flex items-center gap-2 text-slate-600">
                                        <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                        <span className="text-xs">
                                            {item.attendance?.checkInTime
                                                ? new Date(item.attendance.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                                : '—'}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2 text-slate-600">
                                        <Navigation className="w-3.5 h-3.5 text-[#9359d7] shrink-0" />
                                        <span className="text-xs font-semibold text-[#550fa8]">{distKm} km</span>
                                    </div>
                                    <div className="flex items-center gap-2 col-span-2">
                                        {hasNoLocation ? (
                                            <span className="flex items-center gap-1.5 text-xs text-slate-400">
                                                <WifiOff className="w-3 h-3" />
                                                No GPS data yet
                                            </span>
                                        ) : (
                                            <span className="flex items-center gap-1.5 text-xs text-slate-500">
                                                <Wifi className="w-3 h-3 text-emerald-500" />
                                                {item.tracking.totalPoints} points logged
                                            </span>
                                        )}
                                    </div>
                                </div>

                                <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                                    <span className="text-xs text-slate-400">
                                        {item.tracking?.currentLocation?.lastUpdated
                                            ? `Updated ${new Date(item.tracking.currentLocation.lastUpdated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                                            : 'No recent update'}
                                    </span>
                                    <span className="text-xs font-semibold text-[#550fa8] flex items-center gap-1 group-hover:gap-2 transition-all">
                                        View Route <ChevronRight className="w-3.5 h-3.5" />
                                    </span>
                                </div>
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

// ─────────────────────────────────────────────────────────
// Individual Employee Track Map
// ─────────────────────────────────────────────────────────
function EmployeeTrackMap({ employeeId }) {
    const dateParam = new URLSearchParams(window.location.search).get('date') || new Date().toISOString().split('T')[0];
    const isHrmsPortal = window.location.pathname.startsWith('/hrms');

    const [date, setDate] = useState(dateParam);
    const [trackingData, setTrackingData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [selectedPoint, setSelectedPoint] = useState(null);
    const [mapInstance, setMapInstance] = useState(null);
    const [polling, setPolling] = useState(false);

    const { isLoaded, loadError } = useJsApiLoader({
        googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '',
        libraries: mapLibraries
    });

    const fetchTrackingData = async (isPolling = false) => {
        if (!isPolling) setLoading(true);
        try {
            const res = await axiosInstance.get(`/hrms/location-tracks/${employeeId}/${date}`);
            setTrackingData(res.data?.data || null);

            if (!isPolling && res.data?.data?.track?.points?.length > 0 && mapInstance) {
                const bounds = new window.google.maps.LatLngBounds();
                res.data.data.track.points.forEach(p => {
                    bounds.extend({ lat: p.latitude, lng: p.longitude });
                });
                mapInstance.fitBounds(bounds);
            }
        } catch (e) {
            console.error(e);
            if (!isPolling) toast.error('Failed to load tracking data');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTrackingData();
    }, [employeeId, date]);

    useEffect(() => {
        const isToday = date === new Date().toISOString().split('T')[0];
        if (!isToday || !trackingData?.attendance?.checkInTime || trackingData?.attendance?.checkOutTime) {
            setPolling(false);
            return;
        }
        setPolling(true);
        const interval = setInterval(() => fetchTrackingData(true), 60000);
        return () => clearInterval(interval);
    }, [date, trackingData?.attendance]);

    const onLoadMap = useCallback((map) => {
        setMapInstance(map);
        if (trackingData?.track?.points?.length > 0) {
            const bounds = new window.google.maps.LatLngBounds();
            trackingData.track.points.forEach(p => {
                bounds.extend({ lat: p.latitude, lng: p.longitude });
            });
            map.fitBounds(bounds);
        }
    }, [trackingData]);

    if (loadError) return <div className="p-8 text-center text-red-500">Error loading Google Maps</div>;

    const points = trackingData?.track?.points || [];
    const pathCoordinates = points.map(p => ({ lat: p.latitude, lng: p.longitude }));
    const latestPoint = points[points.length - 1];
    const isLive = polling;
    const isMock = latestPoint?.isMocked;
    const backPath = isHrmsPortal ? '/hrms/team/live-tracking' : '/ecs/hrms/live-tracking';

    return (
        <div className="flex flex-col h-[calc(100vh-100px)] -mx-4 -mt-4 bg-slate-50">
            {/* Header */}
            <div className="bg-white border-b border-slate-200 px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0 z-10 shadow-sm">
                <div className="flex items-center gap-4">
                    <a
                        href={backPath}
                        className="p-2 -ml-2 rounded-xl hover:bg-slate-100 text-slate-600 transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </a>
                    <div>
                        <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                            Live Tracking
                            {isLive && (
                                <span className="flex h-2.5 w-2.5 relative ml-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                                </span>
                            )}
                        </h1>
                        <div className="flex items-center gap-3 text-sm text-slate-500 mt-1">
                            <span className="flex items-center gap-1.5">
                                <User className="w-3.5 h-3.5" />
                                {trackingData?.employee?.name || 'Loading...'}
                            </span>
                            <span className="flex items-center gap-1.5">
                                <Navigation className="w-3.5 h-3.5" />
                                {trackingData?.track?.totalDistance ? (trackingData.track.totalDistance / 1000).toFixed(2) + ' km' : '0 km'}
                            </span>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <div className="relative">
                        <input
                            type="date"
                            value={date}
                            onChange={e => setDate(e.target.value)}
                            className="h-10 pl-10 pr-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#6412c6]/30 bg-slate-50"
                        />
                        <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    </div>
                    {isLive && (
                        <div className="px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-2">
                            Live Auto-Update
                        </div>
                    )}
                </div>
            </div>

            {/* Map Container */}
            <div className="flex-1 relative bg-slate-200">
                {loading && !polling && (
                    <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/50 backdrop-blur-sm">
                        <div className="bg-white p-4 rounded-xl shadow-lg flex items-center gap-3">
                            <Loader2 className="w-5 h-5 animate-spin text-[#6412c6]" />
                            <span className="font-medium text-slate-700">Loading tracking data...</span>
                        </div>
                    </div>
                )}

                {!isLoaded ? (
                    <div className="w-full h-full flex items-center justify-center">
                        <Loader2 className="w-8 h-8 animate-spin text-[#6412c6]" />
                    </div>
                ) : points.length === 0 && !loading ? (
                    <div className="w-full h-full flex items-center justify-center bg-slate-50">
                        <div className="text-center p-8 max-w-md">
                            <MapIcon className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                            <h3 className="text-xl font-bold text-slate-800 mb-2">No Tracking Data</h3>
                            <p className="text-slate-500">
                                There are no GPS points recorded for this employee on{' '}
                                {new Date(date + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}.
                                Make sure they are checked in and have GPS enabled.
                            </p>
                            <a
                                href={backPath}
                                className="inline-flex items-center gap-2 mt-6 px-4 py-2 bg-[#6412c6] text-white rounded-xl text-sm font-semibold hover:bg-[#550fa8] transition-colors"
                            >
                                <ArrowLeft className="w-4 h-4" /> Back to Fleet Overview
                            </a>
                        </div>
                    </div>
                ) : (
                    <MemoizedGoogleMap 
                        pathCoordinates={pathCoordinates}
                        points={points}
                        isLive={isLive}
                        isMock={isMock}
                        onLoadMap={onLoadMap}
                        selectedPoint={selectedPoint}
                        setSelectedPoint={setSelectedPoint}
                        fallbackCenter={trackingData?.employee?.assignedOfficeDetails?.latitude ? {lat: trackingData.employee.assignedOfficeDetails.latitude, lng: trackingData.employee.assignedOfficeDetails.longitude} : defaultCenter}
                    />
                )}

                {/* Floating Info Panel */}
                <div className="absolute bottom-6 left-6 right-6 sm:right-auto sm:w-80 bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden z-10 flex flex-col">
                    <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                        <h3 className="font-bold text-slate-900 text-sm">Shift Details</h3>
                        {trackingData?.attendance?.status && (
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${trackingData.attendance.status === 'Present' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                                {trackingData.attendance.status}
                            </span>
                        )}
                    </div>
                    <div className="p-4 space-y-3 flex-1 overflow-y-auto">
                        <div className="flex flex-col gap-1">
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-slate-500 flex items-center gap-1.5"><Clock className="w-4 h-4" /> Check In</span>
                                <span className="font-medium text-slate-900">{trackingData?.attendance?.checkInTime ? new Date(trackingData.attendance.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}</span>
                            </div>
                            {trackingData?.attendance?.checkInLocation?.address && (
                                <div className="flex items-start gap-1.5 text-[11px] text-slate-500 pl-5 pr-2">
                                    <MapPin className="w-3 h-3 shrink-0 text-emerald-500 mt-0.5" />
                                    <span className="line-clamp-2 leading-tight" title={trackingData.attendance.checkInLocation.address}>
                                        {trackingData.attendance.checkInLocation.address}
                                    </span>
                                </div>
                            )}
                        </div>
                        <div className="flex flex-col gap-1">
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-slate-500 flex items-center gap-1.5"><Clock className="w-4 h-4" /> Check Out</span>
                                <span className="font-medium text-slate-900">{trackingData?.attendance?.checkOutTime ? new Date(trackingData.attendance.checkOutTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}</span>
                            </div>
                            {trackingData?.attendance?.checkOutLocation?.address && (
                                <div className="flex items-start gap-1.5 text-[11px] text-slate-500 pl-5 pr-2">
                                    <MapPin className="w-3 h-3 shrink-0 text-red-500 mt-0.5" />
                                    <span className="line-clamp-2 leading-tight" title={trackingData.attendance.checkOutLocation.address}>
                                        {trackingData.attendance.checkOutLocation.address}
                                    </span>
                                </div>
                            )}
                        </div>
                        <div className="pt-3 border-t border-slate-100">
                            <div className="flex justify-between items-center text-sm mb-1">
                                <span className="text-slate-500">Points Logged</span>
                                <span className="font-medium text-slate-900">{points.length}</span>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-slate-500">Est. Distance</span>
                                <span className="font-medium text-[#550fa8]">{trackingData?.track?.totalDistance ? (trackingData.track.totalDistance / 1000).toFixed(2) : '0'} km</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────
// Root Component — dispatches between Fleet & Individual
// ─────────────────────────────────────────────────────────
export default function HrmsLiveTracking() {
    const [searchParams] = useSearchParams();
    const employeeId = searchParams.get('employeeId');

    if (employeeId) {
        return <EmployeeTrackMap employeeId={employeeId} />;
    }

    return <LiveFleetOverview />;
}
