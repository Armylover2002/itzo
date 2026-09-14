import React, { useState } from "react";
import DesktopSidebar from "./DesktopSidebar";

export default function RestaurantLayout({ children }) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  return (
    <div className="flex h-screen bg-white md:bg-gray-50 overflow-hidden">
      <DesktopSidebar isCollapsed={isCollapsed} onToggle={() => setIsCollapsed(!isCollapsed)} />
      {/* 
        On mobile (default), there is no left margin since the sidebar is hidden.
        On desktop (md:), we add a left margin equal to the sidebar width.
      */}
      <main className={`flex-1 min-w-0 ${isCollapsed ? "md:ml-20" : "md:ml-64"} relative h-screen overflow-y-auto flex flex-col custom-scrollbar transition-all duration-300`}>
        {/* We can optionally wrap the children in a container if we want max-width on desktop, 
            but keeping it flex-1 ensures it fills the remaining space. */}
        <div className="w-full flex-1 flex flex-col md:rounded-tl-2xl md:shadow-sm md:border-l md:border-t md:border-gray-200 bg-white md:bg-transparent min-h-full">
           {children}
        </div>
      </main>
    </div>
  );
}
