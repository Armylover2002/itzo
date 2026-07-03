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
const MyTeam = lazy(() => import('../pages/MyTeam'));
const ManagerDashboard = lazy(() => import('../pages/team/ManagerDashboard'));
const TeamAttendance = lazy(() => import('../pages/team/TeamAttendance'));
const TeamLeaves = lazy(() => import('../pages/team/TeamLeaves'));
const TeamExpenses = lazy(() => import('../pages/team/TeamExpenses'));
const TeamReports = lazy(() => import('../pages/team/TeamReports'));

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
                        <Route index element={<Navigate to="dashboard" replace />} />
                        <Route path="dashboard" element={<Dashboard />} />
                        <Route path="attendance" element={<Attendance />} />
                        <Route path="leave" element={<Leave />} />
                        <Route path="salary" element={<Salary />} />
                        <Route path="documents" element={<Documents />} />
                        <Route path="expenses" element={<Expense />} />
                        <Route path="profile" element={<Profile />} />

                        {/* Support Center */}
                        <Route path="support" element={<Navigate to="list" replace />} />
                        <Route path="support/contact" element={<SupportContact />} />
                        <Route path="support/create" element={<SupportCreate />} />
                        <Route path="support/list" element={<SupportList />} />
                        <Route path="support/:id" element={<SupportDetails />} />

                        {/* Daily Reports */}
                        <Route path="reports" element={<Navigate to="list" replace />} />
                        <Route path="reports/list" element={<ReportList />} />
                        <Route path="reports/create" element={<CreateReport />} />
                        <Route path="reports/:id" element={<ReportDetails />} />

                        {/* Manager Module */}
                        <Route path="team" element={<MyTeam />} />
                        <Route path="team/dashboard" element={<ManagerDashboard />} />
                        <Route path="team/attendance" element={<TeamAttendance />} />
                        <Route path="team/leaves" element={<TeamLeaves />} />
                        <Route path="team/expenses" element={<TeamExpenses />} />
                        <Route path="team/reports" element={<TeamReports />} />
                    </Route>

                    {/* Fallback */}
                    <Route path="*" element={<Navigate to="dashboard" replace />} />
                </Routes>
            </Suspense>
        </HrmsSettingsProvider>
    );
}
