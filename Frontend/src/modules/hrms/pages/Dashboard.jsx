import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@core/context/AuthContext';
import axiosInstance from '@core/api/axios';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { useHrmsSettings } from '../context/HrmsSettingsContext';
import { useLocationTracker } from '../hooks/useLocationTracker';
import { Clock, CalendarDays, Wallet, FileCheck, LogIn, LogOut, Loader2, TrendingUp, Timer, MapPin, Building2, Navigation, AlertTriangle, Briefcase, Map as MapIcon } from 'lucide-react';
import { GoogleMap, useJsApiLoader, Polyline, Marker } from '@react-google-maps/api';

const mapLibraries = ['places'];

export default function Dashboard() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const { hrmsSettings } = useHrmsSettings();
    const [attendance, setAttendance] = useState(null);
    const [leaveBalance, setLeaveBalance] = useState(null);
    const [employeeProfile, setEmployeeProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [elapsed, setElapsed] = useState('0:00');
    const [locationStatus, setLocationStatus] = useState(''); // 'fetching', 'success', 'error'
    const [trackingData, setTrackingData] = useState(null);
    const [mapInstance, setMapInstance] = useState(null);

    const { isLoaded, loadError } = useJsApiLoader({
        googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '',
        libraries: mapLibraries
    });

    // Determine if we should track (field employee + checked in + not checked out)
    const isFieldEmployee = employeeProfile?.employeeType === 'Field';
    const isCheckedIn = attendance?.checkInTime && !attendance?.checkOutTime;
    const isDone = !!attendance?.checkOutTime;
    const shouldTrack = isFieldEmployee && isCheckedIn;

    const { isTracking, error: trackingError, lastLocation, pointsCount, getCurrentPosition, stopTracking } = useLocationTracker({
        enabled: shouldTrack,
        intervalSeconds: hrmsSettings?.trackingIntervalSeconds || 60,
        accuracyThreshold: hrmsSettings?.gpsAccuracyThreshold || 50
    });

    const fetchData = useCallback(async () => {
        try {
            const [attRes, leaveRes, profileRes] = await Promise.all([
                axiosInstance.get('/hrms/attendance/me').catch(() => ({ data: { data: [] } })),
                axiosInstance.get('/hrms/leaves/balance').catch(() => ({ data: { data: null } })),
                axiosInstance.get('/hrms/employees/me').catch(() => ({ data: { data: null } }))
            ]);
            const records = attRes.data?.data || [];
            if (records.length > 0) {
                const latest = records[0];
                const today = new Date().toDateString();
                if (new Date(latest.date).toDateString() === today) setAttendance(latest);
            }
            setLeaveBalance(leaveRes.data?.data || null);
            setEmployeeProfile(profileRes.data?.data?.employee || null);
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    useEffect(() => {
        if (!attendance?.checkInTime || attendance?.checkOutTime) return;
        const update = () => {
            const diff = Date.now() - new Date(attendance.checkInTime).getTime();
            const h = Math.floor(diff / 3600000);
            const m = Math.floor((diff % 3600000) / 60000);
            setElapsed(`${h}:${String(m).padStart(2, '0')}`);
        };
        update();
        const interval = setInterval(update, 60000);
        return () => clearInterval(interval);
    }, [attendance]);

    const fetchMyTrack = useCallback(async () => {
        if (!isFieldEmployee) return;
        try {
            const today = new Date().toISOString().split('T')[0];
            const res = await axiosInstance.get(`/hrms/location-tracks/my/${today}`);
            setTrackingData(res.data?.data || null);
        } catch (e) { console.error('Failed to load tracking data', e); }
    }, [isFieldEmployee]);

    useEffect(() => {
        fetchMyTrack();
    }, [fetchMyTrack]);

    useEffect(() => {
        if (!shouldTrack) return;
        const interval = setInterval(fetchMyTrack, 60000);
        return () => clearInterval(interval);
    }, [shouldTrack, fetchMyTrack]);

    const onLoadMap = React.useCallback((map) => {
        setMapInstance(map);
    }, []);

    useEffect(() => {
        if (mapInstance && trackingData?.points?.length > 0) {
            const bounds = new window.google.maps.LatLngBounds();
            trackingData.points.forEach(p => {
                bounds.extend({ lat: p.location.coordinates[1], lng: p.location.coordinates[0] });
            });
            mapInstance.fitBounds(bounds);
        }
    }, [mapInstance, trackingData]);

    const pathCoordinates = trackingData?.points?.map(p => ({
        lat: p.location.coordinates[1], lng: p.location.coordinates[0]
    })) || [];

    const handleCheckIn = async () => {
        setActionLoading(true);
        setLocationStatus('fetching');
        try {
            // Get GPS position
            let coords = {};
            try {
                coords = await getCurrentPosition();
                setLocationStatus('success');
            } catch (gpsErr) {
                setLocationStatus('error');
                toast.error(gpsErr.message || 'Unable to get your location. Please enable GPS.');
                setActionLoading(false);
                return;
            }

            const res = await axiosInstance.post('/hrms/attendance/check-in', {
                latitude: coords.latitude,
                longitude: coords.longitude,
                accuracy: coords.accuracy
            });
            setAttendance(res.data.data);
            toast.success('Checked in successfully!');
            setLocationStatus('');
        } catch (e) {
            toast.error(e.response?.data?.message || 'Check-in failed');
            setLocationStatus('');
        }
        finally { setActionLoading(false); }
    };

    const handleCheckOut = async () => {
        setActionLoading(true);
        setLocationStatus('fetching');
        try {
            // Stop tracking first for field employees
            if (isFieldEmployee) {
                await stopTracking();
            }

            let coords = {};
            try {
                coords = await getCurrentPosition();
                setLocationStatus('success');
            } catch (gpsErr) {
                setLocationStatus('error');
                toast.error(gpsErr.message || 'Unable to get your location. Please enable GPS.');
                setActionLoading(false);
                return;
            }

            const res = await axiosInstance.post('/hrms/attendance/check-out', {
                latitude: coords.latitude,
                longitude: coords.longitude,
                accuracy: coords.accuracy
            });
            setAttendance(res.data.data);
            toast.success('Checked out successfully!');
            setLocationStatus('');
        } catch (e) {
            toast.error(e.response?.data?.message || 'Check-out failed');
            setLocationStatus('');
        }
        finally { setActionLoading(false); }
    };

    const firstName = user?.name?.split(' ')[0] || 'Employee';

    if (loading) {
        return <div className="flex items-center justify-center h-96"><Loader2 className="w-8 h-8 animate-spin text-orange-500" /></div>;
    }

    return (
        <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
            {/* Welcome Banner */}
            <div className="bg-gradient-to-r from-orange-500 to-amber-500 rounded-2xl p-6 sm:p-8 text-white shadow-xl shadow-orange-500/15">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-bold">Welcome back, {firstName}!</h1>
                        <p className="text-orange-100 mt-1 text-sm sm:text-base">{new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                    </div>
                    <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2">
                        {employeeProfile?.hrmsRole === 'Manager' && (
                            <div className="px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 bg-white text-orange-600 shadow-sm">
                                <Briefcase className="w-3.5 h-3.5" /> Manager
                            </div>
                        )}
                        {employeeProfile && (
                            <div className="px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 bg-white/20 text-white">
                                {employeeProfile.employeeType === 'Field'
                                    ? <><MapPin className="w-3.5 h-3.5" /> Field Employee</>
                                    : <><Building2 className="w-3.5 h-3.5" /> Office Employee</>
                                }
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                {/* Check-in Card */}
                <div className={`bg-white rounded-2xl border shadow-sm overflow-hidden ${isDone ? 'border-slate-200' : isCheckedIn ? 'border-orange-300' : 'border-orange-200'}`}>
                    <div className={`h-1 ${isDone ? 'bg-slate-300' : 'bg-gradient-to-r from-orange-500 to-amber-500'}`} />
                    <div className="p-6 text-center">
                        <div className={`w-20 h-20 rounded-full mx-auto mb-4 flex items-center justify-center border-4 ${
                            isDone ? 'border-slate-100 bg-slate-50' : 'border-orange-100 bg-orange-50'
                        }`}>
                            {isDone ? (
                                <span className="text-base font-bold text-slate-500">
                                    {Math.floor(attendance.workingHours)}h {Math.round((attendance.workingHours % 1) * 60)}m
                                </span>
                            ) : isCheckedIn ? (
                                <span className="text-lg font-bold text-orange-600">{elapsed}</span>
                            ) : (
                                <Timer className="w-8 h-8 text-orange-500" />
                            )}
                        </div>
                        <h3 className="font-bold text-slate-900 text-lg mb-1">
                            {isDone ? 'Shift Complete' : isCheckedIn ? 'Working' : 'Not Checked In'}
                        </h3>
                        <p className="text-sm text-slate-500 mb-3">
                            {isDone
                                ? `Checked out at ${new Date(attendance.checkOutTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                                : isCheckedIn
                                    ? `Since ${new Date(attendance.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                                    : 'Start your workday'}
                        </p>

                        {/* Check-In Location for Field Employees */}
                        {isFieldEmployee && attendance?.checkInLocation?.address && (
                            <div className="flex items-center justify-center gap-1.5 text-xs text-slate-500 mb-2 px-2">
                                <MapPin className="w-3.5 h-3.5 shrink-0 text-emerald-500" />
                                <span className="line-clamp-2" title={attendance.checkInLocation.address}>
                                    <strong>In:</strong> {attendance.checkInLocation.address}
                                </span>
                            </div>
                        )}
                        {/* Check-Out Location for Field Employees */}
                        {isFieldEmployee && attendance?.checkOutLocation?.address && (
                            <div className="flex items-center justify-center gap-1.5 text-xs text-slate-500 mb-3 px-2">
                                <MapPin className="w-3.5 h-3.5 shrink-0 text-red-500" />
                                <span className="line-clamp-2" title={attendance.checkOutLocation.address}>
                                    <strong>Out:</strong> {attendance.checkOutLocation.address}
                                </span>
                            </div>
                        )}

                        {/* Location Status Indicator */}
                        {locationStatus === 'fetching' && (
                            <div className="flex items-center justify-center gap-2 text-xs text-orange-500 mb-3">
                                <Loader2 className="w-3 h-3 animate-spin" /> Verifying your location...
                            </div>
                        )}

                        {/* Tracking Status for Field Employees */}
                        {isFieldEmployee && isCheckedIn && (
                            <div className={`flex items-center justify-center gap-2 text-xs mb-3 px-3 py-1.5 rounded-lg ${
                                isTracking ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
                            }`}>
                                {isTracking ? (
                                    <><Navigation className="w-3 h-3" /> Live tracking active — {pointsCount} points</>
                                ) : trackingError ? (
                                    <><AlertTriangle className="w-3 h-3" /> {trackingError}</>
                                ) : (
                                    <><Loader2 className="w-3 h-3 animate-spin" /> Starting tracker...</>
                                )}
                            </div>
                        )}

                        {/* Office Validation Info */}
                        {attendance?.locationValidation && attendance.employeeType === 'Office' && (
                            <div className="text-xs text-slate-500 mb-3 flex items-center justify-center gap-1">
                                <Building2 className="w-3 h-3" />
                                {attendance.locationValidation.officeName} — {attendance.locationValidation.distanceFromOffice}m away
                            </div>
                        )}

                        {/* Assigned Office Info (Before or During Check-in) */}
                        {employeeProfile?.employeeType === 'Office' && (
                            <div className="mb-4 bg-orange-50/50 border border-orange-100 rounded-xl p-3 flex flex-col items-center justify-center text-center">
                                <div className="text-xs font-semibold text-orange-800 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                                    <Building2 className="w-3.5 h-3.5" /> Your Office Location
                                </div>
                                <div className="text-sm font-medium text-slate-800">
                                    {employeeProfile?.assignedOfficeDetails?.name || 'No GPS-enabled office found'}
                                </div>
                                {employeeProfile?.assignedOfficeDetails?.address && (
                                    <div className="text-xs text-slate-500 mt-0.5 line-clamp-2 px-2">
                                        {employeeProfile.assignedOfficeDetails.address}
                                    </div>
                                )}
                            </div>
                        )}

                        {!attendance?.checkInTime && (
                            <button onClick={handleCheckIn} disabled={actionLoading}
                                className="w-full h-11 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-xl shadow-lg shadow-orange-500/20 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
                                {actionLoading ? 'Verifying Location...' : 'Check In'}
                            </button>
                        )}
                        {isCheckedIn && (
                            <button onClick={handleCheckOut} disabled={actionLoading}
                                className="w-full h-11 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-xl shadow-lg shadow-orange-500/20 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />}
                                {actionLoading ? 'Verifying Location...' : 'Check Out'}
                            </button>
                        )}
                    </div>
                </div>

                {/* Leave Balance */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="h-1 bg-gradient-to-r from-orange-500 to-amber-500" />
                    <div className="p-6">
                        <div className="flex items-center gap-3 mb-5">
                            <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center">
                                <CalendarDays className="w-5 h-5 text-orange-600" />
                            </div>
                            <h3 className="font-bold text-slate-900">Leave Balance</h3>
                        </div>
                        {leaveBalance ? (
                            <div className="space-y-3">
                                <div className="flex justify-between items-center">
                                    <span className="text-sm text-slate-500">Monthly Allowed</span>
                                    <span className="font-bold text-slate-900">{leaveBalance.monthly?.allowed || 4}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-sm text-slate-500">Used This Month</span>
                                    <span className="font-bold text-orange-500">{leaveBalance.monthly?.used || 0}</span>
                                </div>
                                <div className="flex justify-between items-center pt-2 border-t border-slate-100">
                                    <span className="text-sm font-medium text-slate-700">Remaining</span>
                                    <span className="font-bold text-lg text-orange-600">{leaveBalance.monthly?.remaining || 4}</span>
                                </div>
                            </div>
                        ) : (
                            <p className="text-sm text-slate-400">No leave data available</p>
                        )}
                    </div>
                </div>

                {/* Quick Actions */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden md:col-span-2 xl:col-span-1">
                    <div className="h-1 bg-gradient-to-r from-orange-500 to-amber-500" />
                    <div className="p-6">
                        <div className="flex items-center gap-3 mb-5">
                            <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center">
                                <TrendingUp className="w-5 h-5 text-orange-600" />
                            </div>
                            <h3 className="font-bold text-slate-900">Quick Actions</h3>
                        </div>
                        <div className="space-y-2.5">
                            {[
                                { label: 'Apply for Leave', path: '/hrms/leave', icon: CalendarDays, color: 'text-orange-600 bg-orange-50' },
                                { label: 'Submit Expense', path: '/hrms/expenses', icon: Wallet, color: 'text-orange-600 bg-orange-50' },
                                { label: 'View Attendance', path: '/hrms/attendance', icon: Clock, color: 'text-orange-600 bg-orange-50' },
                                { label: 'View Payslip', path: '/hrms/salary', icon: FileCheck, color: 'text-orange-600 bg-orange-50' },
                            ].map((item) => (
                                <button key={item.path} onClick={() => navigate(item.path)}
                                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-slate-100 hover:bg-slate-50 hover:border-slate-200 transition-all text-left group">
                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${item.color}`}>
                                        <item.icon className="w-4 h-4" />
                                    </div>
                                    <span className="text-sm font-medium text-slate-700 group-hover:text-slate-900">{item.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
                {/* Live Tracking Map for Field Employees */}
                {isFieldEmployee && (
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden md:col-span-2 xl:col-span-3">
                        <div className="h-1 bg-gradient-to-r from-emerald-400 to-emerald-600" />
                        <div className="p-6 h-full flex flex-col">
                            <div className="flex items-center justify-between mb-5">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
                                        <MapIcon className="w-5 h-5 text-emerald-600" />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-slate-900 flex items-center gap-2">
                                            My Live Route
                                            {shouldTrack && <span className="flex h-2.5 w-2.5 relative ml-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span></span>}
                                        </h3>
                                        <p className="text-xs text-slate-500">
                                            {trackingData?.totalDistance ? (trackingData.totalDistance / 1000).toFixed(2) + ' km traveled today' : 'No movement recorded yet'}
                                        </p>
                                    </div>
                                </div>
                            </div>
                            <div className="flex-1 w-full h-[400px] rounded-xl overflow-hidden border border-slate-200 relative bg-slate-100">
                                {loadError ? (
                                    <div className="absolute inset-0 flex items-center justify-center text-red-500 text-sm">Failed to load Google Maps</div>
                                ) : !isLoaded ? (
                                    <div className="absolute inset-0 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-emerald-500" /></div>
                                ) : (
                                    <GoogleMap
                                        mapContainerStyle={{ width: '100%', height: '100%' }}
                                        center={pathCoordinates.length > 0 ? pathCoordinates[pathCoordinates.length - 1] : { lat: 20.5937, lng: 78.9629 }}
                                        zoom={pathCoordinates.length > 0 ? 15 : 4}
                                        onLoad={onLoadMap}
                                        options={{
                                            disableDefaultUI: false,
                                            zoomControl: true,
                                            mapTypeControl: false,
                                            scaleControl: true,
                                            streetViewControl: false,
                                            rotateControl: false,
                                            fullscreenControl: true
                                        }}
                                    >
                                        {pathCoordinates.length > 0 && (
                                            <Polyline
                                                path={pathCoordinates}
                                                options={{ strokeColor: '#10b981', strokeOpacity: 0.8, strokeWeight: 4 }}
                                            />
                                        )}
                                        {pathCoordinates.length > 0 && (
                                            <Marker
                                                position={pathCoordinates[0]}
                                                title="Start Position"
                                                icon={{ url: 'http://maps.google.com/mapfiles/ms/icons/green-dot.png' }}
                                            />
                                        )}
                                        {pathCoordinates.length > 1 && (
                                            <Marker
                                                position={pathCoordinates[pathCoordinates.length - 1]}
                                                title="Current/End Position"
                                                icon={{ url: 'http://maps.google.com/mapfiles/ms/icons/red-dot.png' }}
                                            />
                                        )}
                                    </GoogleMap>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
