import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import HrmsGuard from '../guards/HrmsGuard';
import { HrmsSettingsProvider } from '../context/HrmsSettingsContext';

const Login = lazy(() => import('../pages/Login'));
const Signup = lazy(() => import('../pages/Signup'));
const HrmsLayout = lazy(() => import('../components/HrmsLayout'));
const Dashboard = lazy(() => import('../pages/Dashboard'));
const Attendance = lazy(() => import('../pages/Attendance'));
const Leave = lazy(() => import('../pages/Leave'));
const Salary = lazy(() => import('../pages/Salary'));
const Documents = lazy(() => import('../pages/Documents'));
const Expense = lazy(() => import('../pages/Expense'));
const Profile = lazy(() => import('../pages/Profile'));
const SupportContact = lazy(() => import('../pages/support/SupportContact'));
const SupportCreate = lazy(() => import('../pages/support/SupportCreate'));
const SupportList = lazy(() => import('../pages/support/SupportList'));
const SupportDetails = lazy(() => import('../pages/support/SupportDetails'));
const ReportList = lazy(() => import('../pages/reports/ReportList'));
const CreateReport = lazy(() => import('../pages/reports/CreateReport'));
const ReportDetails = lazy(() => import('../pages/reports/ReportDetails'));
const ManagerDashboard = lazy(() => import('../pages/team/ManagerDashboard'));
const MyTeam = lazy(() => import('../pages/MyTeam'));
const TeamReports = lazy(() => import('../pages/team/TeamReports'));
const HrmsEmployeesAdmin = lazy(() => import('../../Food/pages/admin/hrms/HrmsEmployees'));
const HrmsAttendanceAdmin = lazy(() => import('../../Food/pages/admin/hrms/HrmsAttendance'));
const HrmsPayrollAdmin = lazy(() => import('../../Food/pages/admin/hrms/HrmsPayroll'));

const HrmsEmployeeDocsAdmin = lazy(() => import('../../Food/pages/admin/hrms/HrmsEmployeeDocs'));
const HrmsLiveTrackingAdmin = lazy(() => import('../../Food/pages/admin/hrms/HrmsLiveTracking'));

// Performance
const EmployeePerformance = lazy(() => import('../pages/performance/EmployeePerformance'));
const TeamPerformance = lazy(() => import('../pages/team/TeamPerformance'));

export default function HrmsEmployeeApp() {
    return (
        <HrmsSettingsProvider>
            <Suspense fallback={<div className="flex h-screen items-center justify-center"><div className="w-8 h-8 animate-spin border-4 border-orange-500 border-t-transparent rounded-full" /></div>}>
                <Routes>
                    {/* Public Routes */}
                    <Route path="login" element={<Login />} />
                    <Route path="signup" element={<Signup />} />

                    {/* Protected Routes - Only accessible by HRMS_EMPLOYEE role */}
                    <Route
                        element={
                            <HrmsGuard>
                                <HrmsLayout />
                            </HrmsGuard>
                        }
                    >
                        <Route index element={<Navigate to="/hrms/dashboard" replace />} />
                        <Route path="dashboard" element={<Dashboard />} />
                        <Route path="attendance" element={<Attendance />} />
                        <Route path="leave" element={<Leave />} />
                        <Route path="salary" element={<Salary />} />
                        <Route path="documents" element={<Documents />} />
                        <Route path="expenses" element={<Expense />} />
                        <Route path="profile" element={<Profile />} />

                        {/* Support Center */}
                        <Route path="support" element={<Navigate to="/hrms/support/list" replace />} />
                        <Route path="support/contact" element={<SupportContact />} />
                        <Route path="support/create" element={<SupportCreate />} />
                        <Route path="support/list" element={<SupportList />} />
                        <Route path="support/:id" element={<SupportDetails />} />

                        {/* Daily Reports */}
                        <Route path="reports" element={<Navigate to="/hrms/reports/list" replace />} />
                        <Route path="reports/list" element={<ReportList />} />
                        <Route path="reports/create" element={<CreateReport />} />
                        <Route path="reports/:id" element={<ReportDetails />} />

                        {/* Manager Module - Using exact ECS Admin UI components scoped to Manager's team */}
                        <Route path="team" element={<Navigate to="/hrms/team/employees" replace />} />
                        <Route path="team/dashboard" element={<ManagerDashboard />} />
                        <Route path="team/my-team" element={<MyTeam />} />
                        <Route path="team/employees" element={<HrmsEmployeesAdmin />} />
                        <Route path="team/attendance" element={<HrmsAttendanceAdmin />} />
                        <Route path="team/leaves" element={<HrmsAttendanceAdmin defaultTab="leaves" />} />
                        <Route path="team/expenses" element={<HrmsPayrollAdmin defaultTab="expenses" />} />
                        <Route path="team/salary" element={<HrmsPayrollAdmin defaultTab="payroll" />} />

                        <Route path="team/employee-docs" element={<HrmsEmployeeDocsAdmin />} />
                        <Route path="team/live-tracking" element={<HrmsLiveTrackingAdmin />} />
                        <Route path="team/reports" element={<TeamReports />} />
                        {/* Performance Module */}
                        <Route path="performance" element={<EmployeePerformance />} />
                        <Route path="team/performance" element={<TeamPerformance />} />
                    </Route>

                    {/* Fallback */}
                    <Route path="*" element={<Navigate to="/hrms/dashboard" replace />} />
                </Routes>
            </Suspense>
        </HrmsSettingsProvider>
    );
}
