import { Routes, Route, Navigate } from "react-router-dom"
import { Suspense, lazy } from "react"
import { AuthPortalSkeleton } from "@food/components/ui/loading-skeletons"
import { AuthPageGuard } from "@core/guards/RouteGuard"

const Login = lazy(() => import("./pages/Login"))
const Portal = lazy(() => import("./pages/Portal"))

export default function AuthRoutes() {
  return (
    <Suspense fallback={<AuthPortalSkeleton />}>
      <Routes>
        {/* If user already logged in, go to food home */}
        <Route path="login" element={<AuthPageGuard module="user" home="/food/user"><Login /></AuthPageGuard>} />
        <Route path="portal" element={<Navigate to="/food/user" replace />} />
        <Route path="*" element={<Navigate to="/user/auth/login" replace />} />
      </Routes>
    </Suspense>
  )
}
