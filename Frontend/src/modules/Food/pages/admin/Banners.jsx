import { Navigate } from "react-router-dom"

/** Legacy route: banners are managed under Landing Page Management. */
export default function Banners() {
  return <Navigate to="/ecs/food/hero-banner-management" replace />
}
