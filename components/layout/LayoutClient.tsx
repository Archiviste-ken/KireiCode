"use client";

import { useState } from "react";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

export function LayoutClient({ children }: { children: React.ReactNode }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen w-full bg-[#0b0f14] overflow-hidden flex-col md:flex-row">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        <Topbar onMenuClick={() => setIsSidebarOpen(true)} />
        <main className="flex-1 w-full overflow-y-auto relative custom-scrollbar">
          <div className="mx-auto w-full max-w-7xl p-4 md:p-6 lg:p-8 relative">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
