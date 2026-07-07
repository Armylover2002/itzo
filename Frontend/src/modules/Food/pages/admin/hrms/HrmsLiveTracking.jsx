import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import axiosInstance from '@core/api/axios';
import { toast } from 'sonner';
import { Loader2, ArrowLeft, Navigation, Map as MapIcon, User, Clock, AlertTriangle, Calendar, MapPin } from 'lucide-react';
import { GoogleMap, useJsApiLoader, Polyline, Marker, InfoWindow } from '@react-google-maps/api';

const mapContainerStyle = { width: '100%', height: '100%' };
const defaultCenter = { lat: 20.5937, lng: 78.9629 }; // India Center
const mapLibraries = ['places'];

export default function HrmsLiveTracking() {
    const [searchParams] = useSearchParams();
    const employeeId = searchParams.get('employeeId');
    const dateParam = searchParams.get('date') || new Date().toISOString().split('T')[0];
    
    const [date, setDate] = useState(dateParam);
    const [trackingData, setTrackingData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [selectedPoint, setSelectedPoint] = useState(null);
    const [mapInstance, setMapInstance] = useState(null);
    const [polling, setPolling] = useState(false);

    // Google Maps Loader
    const { isLoaded, loadError } = useJsApiLoader({
        googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '',
        libraries: mapLibraries
    });

    const fetchTrackingData = async (isPolling = false) => {
        if (!employeeId) return;
        if (!isPolling) setLoading(true);
        try {
            const res = await axiosInstance.get(`/hrms/location-tracks/${employeeId}/${date}`);
            setTrackingData(res.data?.data || null);
            
            // If we have points and map instance, fit bounds
            if (!isPolling && res.data?.data?.points?.length > 0 && mapInstance) {
                const bounds = new window.google.maps.LatLngBounds();
                res.data.data.points.forEach(p => {
                    bounds.extend({ lat: p.location.coordinates[1], lng: p.location.coordinates[0] });
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

    // Polling effect for today
    useEffect(() => {
        const isToday = date === new Date().toISOString().split('T')[0];
        if (!isToday || !trackingData || !trackingData.attendance?.checkInTime || trackingData.attendance?.checkOutTime) {
            setPolling(false);
            return;
        }

        setPolling(true);
        const interval = setInterval(() => {
            fetchTrackingData(true);
        }, 60000); // Poll every minute

        return () => clearInterval(interval);
    }, [date, trackingData?.attendance]);

    const onLoadMap = React.useCallback((map) => {
        setMapInstance(map);
        // If data is already loaded when map loads, fit bounds
        if (trackingData?.points?.length > 0) {
            const bounds = new window.google.maps.LatLngBounds();
            trackingData.points.forEach(p => {
                bounds.extend({ lat: p.location.coordinates[1], lng: p.location.coordinates[0] });
            });
            map.fitBounds(bounds);
        }
    }, [trackingData]);

    if (!employeeId) {
        return (
            <div className="p-8 text-center bg-white rounded-2xl shadow-sm border border-slate-200">
                <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
                <h2 className="text-lg font-bold text-slate-900">Missing Employee ID</h2>
                <p className="text-slate-500">Please provide an employee ID to view live tracking.</p>
                <a href={window.location.pathname.startsWith('/hrms') ? "/hrms/team/attendance" : "/ecs/hrms/attendance"} className="inline-flex items-center gap-2 mt-4 text-orange-600 font-medium hover:underline">
                    <ArrowLeft className="w-4 h-4" /> Back to Attendance
                </a>
            </div>
        );
    }

    if (loadError) return <div className="p-8 text-center text-red-500">Error loading Google Maps</div>;
    
    const points = trackingData?.points || [];
    const pathCoordinates = points.map(p => ({ lat: p.location.coordinates[1], lng: p.location.coordinates[0] }));
    const latestPoint = points[points.length - 1];
    
    // Status color
    const isLive = polling;
    const isMock = latestPoint?.isMocked;

    return (
        <div className="flex flex-col h-[calc(100vh-100px)] -mx-4 -mt-4 bg-slate-50">
            {/* Header / Top Bar */}
            <div className="bg-white border-b border-slate-200 px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0 z-10 shadow-sm">
                <div className="flex items-center gap-4">
                    <a href={window.location.pathname.startsWith('/hrms') ? "/hrms/team/attendance" : "/ecs/hrms/attendance"} className="p-2 -ml-2 rounded-xl hover:bg-slate-100 text-slate-600 transition-colors">
                        <ArrowLeft className="w-5 h-5" />
                    </a>
                    <div>
                        <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                            Live Tracking
                            {isLive && <span className="flex h-2.5 w-2.5 relative ml-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span></span>}
                        </h1>
                        <div className="flex items-center gap-3 text-sm text-slate-500 mt-1">
                            <span className="flex items-center gap-1.5"><User className="w-3.5 h-3.5" /> {trackingData?.employee?.name || 'Loading...'}</span>
                            <span className="flex items-center gap-1.5"><Navigation className="w-3.5 h-3.5" /> {trackingData?.totalDistance ? (trackingData.totalDistance / 1000).toFixed(2) + ' km' : '0 km'}</span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <div className="relative">
                        <input type="date" value={date} onChange={e => setDate(e.target.value)}
                            className="h-10 pl-10 pr-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/30 bg-slate-50" />
                        <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    </div>
                    {isLive && <div className="px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-2">Live Auto-Update</div>}
                </div>
            </div>

            {/* Map Container */}
            <div className="flex-1 relative bg-slate-200">
                {loading && !polling && (
                    <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/50 backdrop-blur-sm">
                        <div className="bg-white p-4 rounded-xl shadow-lg flex items-center gap-3">
                            <Loader2 className="w-5 h-5 animate-spin text-orange-500" />
                            <span className="font-medium text-slate-700">Loading tracking data...</span>
                        </div>
                    </div>
                )}
                
                {!isLoaded ? (
                    <div className="w-full h-full flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-orange-500" /></div>
                ) : points.length === 0 && !loading ? (
                    <div className="w-full h-full flex items-center justify-center bg-slate-50">
                        <div className="text-center p-8 max-w-md">
                            <MapIcon className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                            <h3 className="text-xl font-bold text-slate-800 mb-2">No Tracking Data</h3>
                            <p className="text-slate-500">There are no GPS points recorded for this employee on {new Date(date).toLocaleDateString()}. Make sure they are checked in and have GPS enabled on their device.</p>
                        </div>
                    </div>
                ) : (
                    <GoogleMap mapContainerStyle={mapContainerStyle} center={pathCoordinates[0] || defaultCenter} zoom={14} onLoad={onLoadMap} options={{ streetViewControl: false, mapTypeControl: false, fullscreenControl: false }}>
                        
                        {/* The Path Polyline */}
                        <Polyline path={pathCoordinates} options={{ strokeColor: '#f97316', strokeOpacity: 0.8, strokeWeight: 5 }} />

                        {/* Start Point Marker */}
                        {points.length > 0 && (
                            <Marker position={pathCoordinates[0]} label={{ text: 'S', color: 'white', fontWeight: 'bold' }} 
                                icon={{ path: window.google.maps.SymbolPath.CIRCLE, fillColor: '#10b981', fillOpacity: 1, strokeWeight: 2, strokeColor: 'white', scale: 10 }}
                                onClick={() => setSelectedPoint(points[0])} />
                        )}

                        {/* Latest/End Point Marker */}
                        {points.length > 1 && (
                            <Marker position={pathCoordinates[pathCoordinates.length - 1]} 
                                icon={{ path: window.google.maps.SymbolPath.CIRCLE, fillColor: isMock ? '#ef4444' : isLive ? '#3b82f6' : '#f97316', fillOpacity: 1, strokeWeight: 2, strokeColor: 'white', scale: 10 }}
                                onClick={() => setSelectedPoint(latestPoint)} />
                        )}

                        {/* Info Window */}
                        {selectedPoint && (
                            <InfoWindow position={{ lat: selectedPoint.location.coordinates[1], lng: selectedPoint.location.coordinates[0] }} onCloseClick={() => setSelectedPoint(null)}>
                                <div className="p-1 max-w-[200px]">
                                    <p className="text-xs font-bold text-slate-900 mb-1">{new Date(selectedPoint.timestamp).toLocaleTimeString()}</p>
                                    <p className="text-[10px] text-slate-500 mb-2 font-mono break-all">{selectedPoint.location.coordinates[1]}, {selectedPoint.location.coordinates[0]}</p>
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
                                <span className="font-medium text-orange-600">{trackingData?.totalDistance ? (trackingData.totalDistance / 1000).toFixed(2) : '0'} km</span>
                            </div>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}
