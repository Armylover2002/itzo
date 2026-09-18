import { Suspense, lazy } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import Loader from "@food/components/Loader";
import { HrmsSettingsProvider } from "../../../../hrms/context/HrmsSettingsContext";

const HrmsDashboard = lazy(() => import("./HrmsDashboard"));
const HrmsJoiningRequests = lazy(() => import("./HrmsJoiningRequests"));
const HrmsEmployees = lazy(() => import("./HrmsEmployees"));
const HrmsEmployeeDocs = lazy(() => import("./HrmsEmployeeDocs"));
const HrmsAttendance = lazy(() => import("./HrmsAttendance"));
const HrmsLiveTracking = lazy(() => import("./HrmsLiveTracking"));
const HrmsPayroll = lazy(() => import("./HrmsPayroll"));
const HrmsSettings = lazy(() => import("./HrmsSettings"));
const SupportDashboard = lazy(() => import("./support/SupportDashboard"));
const SupportRequests = lazy(() => import("./support/SupportRequests"));
const SupportSettings = lazy(() => import("./support/SupportSettings"));
const SupportAdminDetails = lazy(() => import("./support/SupportAdminDetails"));

const AdminReportDashboard = lazy(() => import("./reports/AdminReportDashboard"));
const AdminReportList = lazy(() => import("./reports/AdminReportList"));
const AdminReportDetails = lazy(() => import("./reports/AdminReportDetails"));
const AdminReportSettings = lazy(() => import("./reports/AdminReportSettings"));

// Assessments
const QuestionBank = lazy(() => import('./assessments/QuestionBank'));
const AssessmentSettings = lazy(() => import('./assessments/AssessmentSettings'));
const TestAnalysis = lazy(() => import('./assessments/TestAnalysis'));

// Performance
const HrmsAdminPerformance = lazy(() => import('./HrmsAdminPerformance'));
const HrmsKpiSettings = lazy(() => import('./HrmsKpiSettings'));

export default function HrmsRouter() {
    return (
        <Suspense fallback={<Loader />}>
            <HrmsSettingsProvider>
                <Routes>
                    <Route path="/" element={<Navigate to="/ecs/hrms/dashboard" replace />} />
                <Route path="dashboard" element={<HrmsDashboard />} />
                <Route path="joining-requests" element={<HrmsJoiningRequests />} />
                <Route path="employees" element={<HrmsEmployees />} />
                <Route path="employee-docs" element={<HrmsEmployeeDocs />} />
                <Route path="attendance" element={<HrmsAttendance />} />
                <Route path="live-tracking" element={<HrmsLiveTracking />} />
                <Route path="payroll" element={<HrmsPayroll />} />
                <Route path="settings" element={<HrmsSettings />} />

                {/* Support Center */}
                <Route path="support" element={<Navigate to="/ecs/hrms/support/dashboard" replace />} />
                <Route path="support/dashboard" element={<SupportDashboard />} />
                <Route path="support/requests" element={<SupportRequests />} />
                <Route path="support/requests/:id" element={<SupportAdminDetails />} />
                <Route path="support/settings" element={<SupportSettings />} />

                {/* Assessments */}
                <Route path="assessments" element={<Navigate to="/ecs/hrms/assessments/question-bank" replace />} />
                <Route path="assessments/question-bank" element={<QuestionBank />} />
                <Route path="assessments/settings" element={<AssessmentSettings />} />
                <Route path="assessments/analysis" element={<TestAnalysis />} />

                {/* Daily Reports */}
                <Route path="reports" element={<Navigate to="/ecs/hrms/reports/dashboard" replace />} />
                <Route path="reports/dashboard" element={<AdminReportDashboard />} />
                <Route path="reports/all" element={<AdminReportList />} />
                <Route path="reports/:id" element={<AdminReportDetails />} />
                <Route path="reports/settings" element={<AdminReportSettings />} />

                {/* Performance & KPIs */}
                <Route path="performance" element={<HrmsAdminPerformance />} />
                <Route path="kpi-settings" element={<HrmsKpiSettings />} />
                </Routes>
            </HrmsSettingsProvider>
        </Suspense>
    );
}
