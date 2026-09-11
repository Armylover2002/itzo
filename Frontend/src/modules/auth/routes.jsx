import { Routes, Route, Navigate } from "react-router-dom"
import { Suspense, lazy } from "react"
import { AuthPortalSkeleton } from "@food/components/ui/loading-skeletons"

const Login = lazy(() => import("./pages/Login"))
const Portal = lazy(() => import("./pages/Portal"))

export default function AuthRoutes() {
  return (
    <Suspense fallback={<AuthPortalSkeleton />}>
      <Routes>
        <Route path="login" element={<Login />} />
        <Route path="signup" element={<Login />} />
        <Route path="portal" element={<Navigate to="/food/user" replace />} />
        <Route path="*" element={<Navigate to="/user/auth/login" replace />} />
      </Routes>
    </Suspense>
  )
}
