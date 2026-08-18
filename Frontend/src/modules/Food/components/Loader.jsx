import { AppShellSkeleton } from "@food/components/ui/loading-skeletons"
import { useLocation } from "react-router-dom"

export default function Loader() {
  const location = useLocation();
  const path = location.pathname;

  // Show user app skeleton only for user routes (not delivery, restaurant, seller, admin, ecs)
  if (path.includes("/delivery") || path.includes("/restaurant") || path.includes("/seller") || path.includes("/admin") || path.includes("/ecs")) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return <AppShellSkeleton />
}
