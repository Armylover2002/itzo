import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import axiosInstance from '@core/api/axios';
import { useNavigate } from 'react-router-dom';
import { Users, UserPlus, CalendarDays, Loader2, TrendingUp, AlertCircle, Search, ArrowRight, Bell, FileEdit, Clock, LifeBuoy } from 'lucide-react';

/* ───────── live date hook ───────── */
function useLiveDate() {
    const [now, setNow] = useState(() => new Date());

    useEffect(() => {
        const msUntilMidnight = () => {
            const tomorrow = new Date();
            tomorrow.setHours(24, 0, 0, 0);
            return tomorrow - new Date();
        };
        let timeout;
        const schedule = () => {
            setNow(new Date());
            timeout = setTimeout(schedule, msUntilMidnight());
        };
        timeout = setTimeout(schedule, msUntilMidnight());
        return () => clearTimeout(timeout);
    }, []);

    return now.toLocaleDateString('en-US', {
        weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
    }).toUpperCase();
}

/* ───────── smooth SVG area chart ───────── */
const AttendanceChart = React.memo(function AttendanceChart({ data }) {
    const W = 800, H = 260, PAD = { top: 24, right: 24, bottom: 44, left: 44 };
    const innerW = W - PAD.left - PAD.right;
    const innerH = H - PAD.top - PAD.bottom;

    const maxVal = Math.max(...data.map(d => d.present), 1);
    // round up to nearest 5 for clean y-axis
    const yMax = Math.ceil((maxVal + 1) / 5) * 5;
    const yMin = 0;

    const xPos = (i) => PAD.left + (i / (data.length - 1 || 1)) * innerW;
    const yPos = (v) => PAD.top + innerH - ((v - yMin) / (yMax - yMin || 1)) * innerH;

    // Build cubic bezier smooth path
    const smoothPath = (pts) => {
        if (pts.length < 2) return '';
        let d = `M ${pts[0][0]} ${pts[0][1]}`;
        for (let i = 0; i < pts.length - 1; i++) {
            const [x0, y0] = pts[i];
            const [x1, y1] = pts[i + 1];
            const cpX = (x0 + x1) / 2;
            d += ` C ${cpX} ${y0}, ${cpX} ${y1}, ${x1} ${y1}`;
        }
        return d;
    };

    const pts = data.map((d, i) => [xPos(i), yPos(d.present)]);
    const linePath = smoothPath(pts);
    const areaPath = linePath
        ? `${linePath} L ${pts[pts.length - 1][0]} ${PAD.top + innerH} L ${pts[0][0]} ${PAD.top + innerH} Z`
        : '';

    const yTicks = Array.from({ length: 5 }, (_, i) => Math.round(yMin + (yMax - yMin) * (i / 4)));

    const [tooltip, setTooltip] = useState(null);
    const svgRef = useRef(null);

    const handleMouseMove = (e) => {
        const rect = svgRef.current?.getBoundingClientRect();
        if (!rect) return;
        const relX = (e.clientX - rect.left) * (W / rect.width);
        // Find closest point
        let closest = 0, minDist = Infinity;
        pts.forEach(([px], i) => {
            const dist = Math.abs(px - relX);
            if (dist < minDist) { minDist = dist; closest = i; }
        });
        setTooltip({ idx: closest, x: pts[closest][0], y: pts[closest][1] });
    };

    return (
        <div className="relative w-full overflow-x-auto">
            <svg
                ref={svgRef}
                viewBox={`0 0 ${W} ${H}`}
                className="w-full"
                style={{ minWidth: 320 }}
                onMouseMove={handleMouseMove}
                onMouseLeave={() => setTooltip(null)}
            >
                <defs>
                    <linearGradient id="hrmsAreaGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#f97316" stopOpacity="0.18" />
                        <stop offset="100%" stopColor="#f97316" stopOpacity="0.01" />
                    </linearGradient>
                </defs>

                {/* Y grid lines */}
                {yTicks.map(tick => (
                    <g key={tick}>
                        <line
                            x1={PAD.left} y1={yPos(tick)}
                            x2={PAD.left + innerW} y2={yPos(tick)}
                            stroke="#f1f5f9" strokeWidth="1"
                        />
                        <text
                            x={PAD.left - 8} y={yPos(tick) + 4}
                            fontSize="10" fill="#94a3b8" textAnchor="end"
                        >{tick}</text>
                    </g>
                ))}

                {/* X axis labels */}
                {data.map((d, i) => (
                    <text
                        key={i}
                        x={xPos(i)} y={H - 10}
                        fontSize="10" fill="#94a3b8" textAnchor="middle"
                    >{d.label}</text>
                ))}

                {/* Area fill */}
                {areaPath && (
                    <path d={areaPath} fill="url(#hrmsAreaGrad)" />
                )}

                {/* Line */}
                {linePath && (
                    <path
                        d={linePath}
                        fill="none"
                        stroke="#f97316"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                )}

                {/* Data points */}
                {pts.map(([px, py], i) => (
                    <circle
                        key={i} cx={px} cy={py} r="4"
                        fill="#f97316" stroke="white" strokeWidth="2"
                        style={{ cursor: 'pointer' }}
                    />
                ))}

                {/* Tooltip */}
                {tooltip !== null && data[tooltip.idx] && (() => {
                    const d = data[tooltip.idx];
                    const tx = tooltip.x;
                    const ty = tooltip.y;
                    const boxW = 110, boxH = 48, boxR = 8;
                    const bx = Math.min(Math.max(tx - boxW / 2, PAD.left), PAD.left + innerW - boxW);
                    const by = ty - boxH - 12;
                    return (
                        <g>
                            <line x1={tx} y1={ty} x2={tx} y2={PAD.top + innerH}
                                stroke="#f97316" strokeWidth="1" strokeDasharray="4 3" opacity="0.5" />
                            <rect x={bx} y={by} width={boxW} height={boxH} rx={boxR}
                                fill="#1e293b" opacity="0.92" />
                            <text x={bx + boxW / 2} y={by + 17}
                                fontSize="10" fill="#94a3b8" textAnchor="middle">{d.label}</text>
                            <text x={bx + boxW / 2} y={by + 34}
                                fontSize="12" fill="white" textAnchor="middle" fontWeight="600">
                                {d.present} Present · {d.absent} Absent
                            </text>
                        </g>
                    );
                })()}
            </svg>
        </div>
    );
});

export default function HrmsDashboard() {
    const navigate = useNavigate();
    const [stats, setStats] = useState(null);
    const [pendingRequests, setPendingRequests] = useState(0);
    const [loading, setLoading] = useState(true);

    /* ── attendance chart state ── */
    const [chartData, setChartData] = useState([]);
    const [chartLoading, setChartLoading] = useState(true);

    /* ── search state ── */
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);
    const [showResults, setShowResults] = useState(false);
    const searchRef = useRef(null);

    const dateStr = useLiveDate();

    /* ── notifications state ── */
    const [notifications, setNotifications] = useState([]);
    const [notifLoading, setNotifLoading] = useState(true);
    const [showNotifPanel, setShowNotifPanel] = useState(false);
    const bellRef = useRef(null);

    /* ── stats fetch ── */
    useEffect(() => {
        const fetch = async () => {
            try {
                const [statsRes, jrRes] = await Promise.all([
                    axiosInstance.get('/hrms/employees/stats').catch(() => ({ data: { data: null } })),
                    axiosInstance.get('/hrms/joining-requests?status=Pending&limit=1').catch(() => ({ data: { data: { counts: {} } } }))
                ]);
                setStats(statsRes.data?.data || null);
                setPendingRequests(jrRes.data?.data?.counts?.pending || 0);
            } catch (e) { console.error(e); }
            finally { setLoading(false); }
        };
        fetch();
    }, []);

    /* ── notifications fetch ── */
    useEffect(() => {
        const fetchNotifications = async () => {
            setNotifLoading(true);
            try {
                const [jrRes, leavesRes, editsRes, regRes, supportRes] = await Promise.all([
                    axiosInstance.get('/hrms/joining-requests?status=Pending&limit=5').catch(() => ({ data: { data: { requests: [], counts: {} } } })),
                    axiosInstance.get('/hrms/leaves/pending').catch(() => ({ data: { data: [] } })),
                    axiosInstance.get('/hrms/employees/pending-edits').catch(() => ({ data: { data: [] } })),
                    axiosInstance.get('/hrms/attendance/pending-regularizations').catch(() => ({ data: { data: [] } })),
                    axiosInstance.get('/hrms/support/admin/tickets?limit=5').catch(() => ({ data: { data: { tickets: [] } } }))
                ]);

                const items = [];

                // Joining requests
                const jrList = jrRes.data?.data?.requests || [];
                jrList.forEach(jr => items.push({
                    id: jr._id,
                    type: 'Joining Request',
                    icon: 'UserPlus',
                    title: jr.fullName || 'New Applicant',
                    subtitle: `${jr.requestId || ''} · ${jr.preferredDepartment || 'No dept'}`,
                    time: jr.createdAt,
                    path: '/ecs/hrms/joining-requests'
                }));

                // Leave requests
                const leaveList = Array.isArray(leavesRes.data?.data) ? leavesRes.data.data : [];
                leaveList.forEach(lv => items.push({
                    id: lv._id,
                    type: 'Leave Request',
                    icon: 'CalendarDays',
                    title: lv.employeeId?.adminId?.name || 'Employee',
                    subtitle: `${lv.leaveType || 'Leave'} · ${lv.totalDays || 0} day(s)`,
                    time: lv.createdAt,
                    path: '/ecs/hrms/attendance'
                }));

                // Profile edits
                const editList = Array.isArray(editsRes.data?.data) ? editsRes.data.data : [];
                editList.forEach(ed => items.push({
                    id: ed._id,
                    type: 'Profile Edit',
                    icon: 'FileEdit',
                    title: ed.adminId?.name || 'Employee',
                    subtitle: `Wants to update ${Object.keys(ed.pendingProfileEdit || {}).join(', ') || 'profile'}`,
                    time: ed.updatedAt,
                    path: '/ecs/hrms/employees'
                }));

                // Regularizations
                const regList = Array.isArray(regRes.data?.data) ? regRes.data.data : [];
                regList.forEach(rg => items.push({
                    id: rg._id,
                    type: 'Regularization',
                    icon: 'Clock',
                    title: rg.employeeId?.adminId?.name || 'Employee',
                    subtitle: `${new Date(rg.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} attendance`,
                    time: rg.updatedAt || rg.createdAt,
                    path: '/ecs/hrms/attendance'
                }));

                // Support Tickets
                const supportList = Array.isArray(supportRes.data?.data?.tickets) ? supportRes.data.data.tickets : [];
                // Only take those unread by admin
                const unreadSupport = supportList.filter(t => t.unreadByAdmin);
                unreadSupport.forEach(t => items.push({
                    id: t._id,
                    type: 'Support Request',
                    icon: 'LifeBuoy',
                    title: t.subject || 'Ticket',
                    subtitle: `${t.ticketId || ''} · ${t.employeeId?.adminId?.name || 'Employee'}`,
                    time: t.updatedAt,
                    path: `/ecs/hrms/support/requests/${t._id}`
                }));

                // Sort by time (newest first)
                items.sort((a, b) => new Date(b.time) - new Date(a.time));
                setNotifications(items);
            } catch (e) {
                console.error('Notification fetch error:', e);
                setNotifications([]);
            } finally {
                setNotifLoading(false);
            }
        };
        fetchNotifications();
    }, []);

    /* ── close notification panel on outside click ── */
    useEffect(() => {
        const handleClick = (e) => {
            if (bellRef.current && !bellRef.current.contains(e.target)) setShowNotifPanel(false);
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, []);

    /* ── weekly attendance chart fetch ── */
    useEffect(() => {
        const fetchChart = async () => {
            setChartLoading(true);
            try {
                // Build last-7-days date range
                const today = new Date();
                today.setHours(0, 0, 0, 0);

                const days = Array.from({ length: 7 }, (_, i) => {
                    const d = new Date(today);
                    d.setDate(today.getDate() - (6 - i));
                    return d;
                });

                // Fetch current month attendance (may span two months; handle edge case below)
                const month = today.getMonth() + 1;
                const year = today.getFullYear();

                // If the 7-day window crosses a month boundary, also fetch previous month
                const firstDay = days[0];
                const requests = [axiosInstance.get(`/hrms/attendance?month=${month}&year=${year}&limit=500`).catch(() => ({ data: { data: { records: [] } } }))];
                if (firstDay.getMonth() !== today.getMonth()) {
                    const pm = firstDay.getMonth() + 1;
                    const py = firstDay.getFullYear();
                    requests.push(axiosInstance.get(`/hrms/attendance?month=${pm}&year=${py}&limit=500`).catch(() => ({ data: { data: { records: [] } } })));
                }

                const responses = await Promise.all(requests);
                const allRecords = responses.flatMap(r => r.data?.data?.records || []);

                // Map date string → records
                const byDate = {};
                allRecords.forEach(rec => {
                    const key = new Date(rec.date).toDateString();
                    if (!byDate[key]) byDate[key] = [];
                    byDate[key].push(rec);
                });

                const DAY_LABELS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

                const built = days.map(d => {
                    const key = d.toDateString();
                    const recs = byDate[key] || [];
                    const present = recs.filter(r => r.status === 'Present').length;
                    const absent = recs.filter(r => r.status === 'Absent').length;
                    return {
                        label: DAY_LABELS[d.getDay()],
                        date: d,
                        present,
                        absent,
                    };
                });

                setChartData(built);
            } catch (e) {
                console.error('Chart fetch error:', e);
                setChartData([]);
            } finally {
                setChartLoading(false);
            }
        };
        fetchChart();
    }, []);

    /* ── debounced search ── */
    useEffect(() => {
        if (searchQuery.trim().length < 2) {
            setSearchResults([]);
            return;
        }
        setIsSearching(true);
        const timer = setTimeout(async () => {
            try {
                const [empRes, jrRes] = await Promise.all([
                    axiosInstance.get(`/hrms/employees?status=all&limit=10&search=${encodeURIComponent(searchQuery)}`),
                    axiosInstance.get(`/hrms/joining-requests?status=all&limit=10&search=${encodeURIComponent(searchQuery)}`)
                ]);
                const emps = empRes.data?.data?.employees || [];
                const requests = jrRes.data?.data?.requests || [];
                const results = [];
                emps.forEach(emp => results.push({
                    id: emp._id, type: 'Employee',
                    title: emp.adminId?.name || 'Unnamed Employee',
                    description: `ID: ${emp.employeeId || '-'} | ${emp.designation || ''} (${emp.department || ''}) [${emp.status}]`,
                    path: `/ecs/hrms/employees?search=${encodeURIComponent(emp.adminId?.name || '')}`
                }));
                requests.forEach(req => results.push({
                    id: req._id, type: 'Joining Request',
                    title: req.fullName || 'Unnamed Applicant',
                    description: `ID: ${req.requestId || '-'} | Dept: ${req.preferredDepartment || ''} | Status: ${req.status}`,
                    path: `/ecs/hrms/joining-requests?status=all&search=${encodeURIComponent(req.fullName || '')}`
                }));
                setSearchResults(results);
            } catch (err) {
                console.error('Error searching HRMS:', err);
                setSearchResults([]);
            } finally {
                setIsSearching(false);
            }
        }, 350);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    /* ── close results on outside click ── */
    useEffect(() => {
        const handleClick = (e) => {
            if (searchRef.current && !searchRef.current.contains(e.target)) setShowResults(false);
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, []);

    const handleResultClick = (result) => {
        setShowResults(false);
        setSearchQuery('');
        navigate(result.path);
    };

    const groupedResults = useMemo(() => {
        const groups = {};
        searchResults.forEach((r) => {
            if (!groups[r.type]) groups[r.type] = [];
            groups[r.type].push(r);
        });
        return groups;
    }, [searchResults]);

    const resultIcon = (type) => {
        switch (type) {
            case 'Employee': return <Users className="w-4 h-4 text-orange-600" />;
            case 'Joining Request': return <UserPlus className="w-4 h-4 text-orange-600" />;
            default: return <Search className="w-4 h-4 text-slate-400" />;
        }
    };

    if (loading) return <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-slate-400" /></div>;

    const cards = [
        { label: 'Active Employees', value: stats?.totalActive || 0, icon: Users, color: 'text-orange-600 bg-orange-50', path: '/ecs/hrms/employees' },
        { label: 'Pending Requests', value: pendingRequests, icon: UserPlus, color: 'text-orange-600 bg-orange-50', path: '/ecs/hrms/joining-requests', highlight: pendingRequests > 0 },
        { label: 'Suspended', value: stats?.totalSuspended || 0, icon: AlertCircle, color: 'text-orange-600 bg-orange-50', path: '/ecs/hrms/employees' },
        { label: 'Total Employees', value: stats?.totalEmployees || 0, icon: TrendingUp, color: 'text-orange-600 bg-orange-50', path: '/ecs/hrms/employees' },
    ];

    const totalPresent = chartData.reduce((s, d) => s + d.present, 0);
    const totalAbsent = chartData.reduce((s, d) => s + d.absent, 0);

    return (
        <div className="space-y-6">
            {/* ── Title ── */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">HRMS Dashboard</h1>
                    <p className="text-sm text-slate-500 mt-1">Overview of your workforce</p>
                </div>

                {/* Bell Icon */}
                <div className="relative" ref={bellRef}>
                    <button
                        onClick={() => setShowNotifPanel(prev => !prev)}
                        className="relative w-10 h-10 flex items-center justify-center rounded-full bg-white border border-slate-200 hover:bg-orange-50 hover:border-orange-200 transition-all shadow-sm"
                    >
                        <Bell className="w-5 h-5 text-slate-600" />
                        {notifications.length > 0 && (
                            <span className="absolute -top-1 -right-1 min-w-[20px] h-5 flex items-center justify-center px-1 bg-orange-500 text-white text-[11px] font-bold rounded-full shadow-md">
                                {notifications.length > 99 ? '99+' : notifications.length}
                            </span>
                        )}
                    </button>

                    {/* Notification Panel */}
                    {showNotifPanel && (
                        <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-white border border-slate-200 rounded-2xl shadow-2xl z-50 overflow-hidden">
                            <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                                <h3 className="text-sm font-bold text-slate-800">Notifications</h3>
                                <span className="text-[11px] font-semibold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full">
                                    {notifications.length} pending
                                </span>
                            </div>

                            <div className="max-h-80 overflow-y-auto">
                                {notifLoading ? (
                                    <div className="flex items-center justify-center py-10 gap-2">
                                        <Loader2 className="w-5 h-5 animate-spin text-orange-500" />
                                        <span className="text-sm text-slate-500">Loading…</span>
                                    </div>
                                ) : notifications.length === 0 ? (
                                    <div className="text-center py-10">
                                        <Bell className="w-10 h-10 text-slate-200 mx-auto mb-2" />
                                        <p className="text-sm text-slate-400 font-medium">All caught up!</p>
                                        <p className="text-xs text-slate-300 mt-0.5">No pending approvals</p>
                                    </div>
                                ) : (
                                    <div className="divide-y divide-slate-100">
                                        {notifications.map((n, i) => {
                                            const IconComp = n.icon === 'UserPlus' ? UserPlus : n.icon === 'CalendarDays' ? CalendarDays : n.icon === 'FileEdit' ? FileEdit : n.icon === 'LifeBuoy' ? LifeBuoy : Clock;
                                            const typeColor = n.icon === 'UserPlus' ? 'bg-orange-50 text-orange-600' : n.icon === 'CalendarDays' ? 'bg-amber-50 text-amber-600' : n.icon === 'FileEdit' ? 'bg-violet-50 text-violet-600' : n.icon === 'LifeBuoy' ? 'bg-orange-50 text-orange-600' : 'bg-emerald-50 text-emerald-600';
                                            const timeAgo = (() => {
                                                if (!n.time) return '';
                                                const diff = Date.now() - new Date(n.time).getTime();
                                                const mins = Math.floor(diff / 60000);
                                                if (mins < 1) return 'Just now';
                                                if (mins < 60) return `${mins}m ago`;
                                                const hrs = Math.floor(mins / 60);
                                                if (hrs < 24) return `${hrs}h ago`;
                                                const days = Math.floor(hrs / 24);
                                                return `${days}d ago`;
                                            })();
                                            return (
                                                <button
                                                    key={`${n.type}-${n.id}-${i}`}
                                                    onClick={() => { setShowNotifPanel(false); navigate(n.path); }}
                                                    className="w-full flex items-start gap-3 px-5 py-3.5 hover:bg-orange-50/50 transition-colors text-left group"
                                                >
                                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${typeColor}`}>
                                                        <IconComp className="w-4 h-4" />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center justify-between gap-2">
                                                            <p className="text-sm font-medium text-slate-800 truncate">{n.title}</p>
                                                            <span className="text-[10px] text-slate-400 shrink-0">{timeAgo}</span>
                                                        </div>
                                                        <p className="text-xs text-slate-400 truncate mt-0.5">{n.subtitle}</p>
                                                        <span className="inline-block mt-1 text-[10px] font-semibold uppercase tracking-wider text-orange-500">{n.type}</span>
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>

                            {notifications.length > 0 && (
                                <div className="px-5 py-3 border-t border-slate-100 bg-slate-50">
                                    <button
                                        onClick={() => { setShowNotifPanel(false); navigate('/ecs/hrms/joining-requests'); }}
                                        className="text-xs font-semibold text-orange-600 hover:text-orange-700 transition-colors"
                                    >
                                        View all approvals →
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* ── Dashboard Sub-Header ── */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm px-5 py-3 flex flex-col sm:flex-row items-center gap-3 sm:gap-4">
                {/* Search */}
                <div className="relative flex-1 w-full sm:max-w-md" ref={searchRef}>
                    <div className="flex items-center bg-slate-50 border border-slate-200 rounded-full px-4 py-2.5 focus-within:border-orange-400 focus-within:ring-2 focus-within:ring-orange-100 transition-all">
                        <Search className="w-4 h-4 text-slate-400 shrink-0 mr-2" />
                        <input
                            type="text"
                            placeholder="Search employees or approvals…"
                            value={searchQuery}
                            onChange={(e) => { setSearchQuery(e.target.value); setShowResults(true); }}
                            onFocus={() => setShowResults(true)}
                            className="bg-transparent w-full text-sm text-slate-700 placeholder:text-slate-400 placeholder:uppercase placeholder:tracking-wider placeholder:text-xs focus:outline-none"
                        />
                        {isSearching && <Loader2 className="w-4 h-4 animate-spin text-orange-500 ml-2 shrink-0" />}
                    </div>

                    {/* Search Results Dropdown */}
                    {showResults && searchQuery.trim().length >= 2 && (
                        <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-xl shadow-xl z-50 max-h-80 overflow-y-auto">
                            {isSearching ? (
                                <div className="flex items-center justify-center py-8 gap-2">
                                    <Loader2 className="w-5 h-5 animate-spin text-orange-500" />
                                    <span className="text-sm text-slate-500">Searching…</span>
                                </div>
                            ) : searchResults.length === 0 ? (
                                <div className="text-center py-8">
                                    <AlertCircle className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                                    <p className="text-sm text-slate-500">No results for "{searchQuery}"</p>
                                </div>
                            ) : (
                                <div className="py-2">
                                    <p className="px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                                        {searchResults.length} result{searchResults.length !== 1 ? 's' : ''}
                                    </p>
                                    {Object.entries(groupedResults).map(([type, results]) => (
                                        <div key={type}>
                                            <p className="px-4 pt-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-orange-500">{type}s</p>
                                            {results.map((result, idx) => (
                                                <button
                                                    key={`${type}-${idx}`}
                                                    onClick={() => handleResultClick(result)}
                                                    className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-orange-50 transition-colors text-left group"
                                                >
                                                    <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 group-hover:bg-orange-100 group-hover:text-orange-600 transition-colors shrink-0">
                                                        {resultIcon(result.type)}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-medium text-slate-800 truncate">{result.title}</p>
                                                        <p className="text-xs text-slate-400 truncate">{result.description}</p>
                                                    </div>
                                                    <ArrowRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-orange-500 shrink-0 transition-colors" />
                                                </button>
                                            ))}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Right side: Status + Date */}
                <div className="flex items-center gap-3 shrink-0">
                    <div className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-full">
                        <span className="relative flex h-2.5 w-2.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                        </span>
                        <span className="text-xs font-semibold uppercase tracking-wider text-slate-600">System Active</span>
                    </div>
                    <div className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-full">
                        <CalendarDays className="w-3.5 h-3.5 text-orange-500" />
                        <span className="text-xs font-semibold uppercase tracking-wider text-slate-600">{dateStr}</span>
                    </div>
                </div>
            </div>

            {/* ── Stat Cards ── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                {cards.map((card, i) => (
                    <button key={i} onClick={() => navigate(card.path)}
                        className={`bg-white rounded-2xl border shadow-sm p-5 text-left hover:shadow-md transition-all group ${card.highlight ? 'border-orange-300 ring-2 ring-orange-100' : 'border-slate-200'}`}>
                        <div className="flex items-center justify-between mb-3">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${card.color.split(' ')[1]}`}>
                                <card.icon className={`w-5 h-5 ${card.color.split(' ')[0]}`} />
                            </div>
                            {card.highlight && <span className="w-2.5 h-2.5 rounded-full bg-orange-500 animate-pulse" />}
                        </div>
                        <p className="text-3xl font-bold text-slate-900">{card.value}</p>
                        <p className="text-sm text-slate-500 mt-0.5">{card.label}</p>
                    </button>
                ))}
            </div>

            {/* ── Weekly Attendance Chart ── */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-6">
                    <div>
                        <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-0.5">Attendance Activity</p>
                        <h3 className="text-lg font-bold text-slate-900">Weekly Statistics</h3>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-orange-500 inline-block"></span>
                            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Present</span>
                        </div>
                        {chartLoading ? (
                            <Loader2 className="w-4 h-4 animate-spin text-orange-400" />
                        ) : (
                            <div className="flex gap-3 text-xs text-slate-500">
                                <span className="font-semibold text-orange-600">{totalPresent}</span> present this week ·
                                <span className="font-semibold text-slate-500">{totalAbsent}</span> absent
                            </div>
                        )}
                    </div>
                </div>

                {chartLoading ? (
                    <div className="flex items-center justify-center h-48">
                        <Loader2 className="w-8 h-8 animate-spin text-orange-400" />
                    </div>
                ) : chartData.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-48 text-slate-400">
                        <AlertCircle className="w-10 h-10 mb-2 text-slate-300" />
                        <p className="text-sm">No attendance data for this week</p>
                    </div>
                ) : (
                    <AttendanceChart data={chartData} />
                )}
            </div>

            {/* ── Department Breakdown ── */}
            {stats?.departments?.length > 0 && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                    <h3 className="font-semibold text-slate-900 mb-4">Department Breakdown</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                        {stats.departments.map((dept, i) => (
                            <div key={i} className="bg-slate-50 rounded-xl p-4 text-center">
                                <p className="text-2xl font-bold text-slate-900">{dept.count}</p>
                                <p className="text-sm text-slate-500 mt-0.5">{dept._id || 'Unassigned'}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}


