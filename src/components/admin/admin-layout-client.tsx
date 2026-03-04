"use client";

import { useState } from "react";
import { AdminSidebar } from "@/components/admin/sidebar";
import { MobileSidebarDrawer } from "@/components/admin/mobile-sidebar-drawer";

export function AdminLayoutClient({ children, shopName }: { children: React.ReactNode; shopName: string }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen bg-warm-gray">
      {/* Desktop sidebar */}
      <div className="hidden lg:flex">
        <AdminSidebar shopName={shopName} />
      </div>

      {/* Mobile sidebar drawer */}
      <MobileSidebarDrawer open={sidebarOpen} onClose={() => setSidebarOpen(false)}>
        <AdminSidebar shopName={shopName} onNavClick={() => setSidebarOpen(false)} />
      </MobileSidebarDrawer>

      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Mobile top bar */}
        <header className="flex h-14 items-center gap-4 border-b border-warm-brown/10 bg-white px-4 lg:hidden">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="flex min-h-[44px] min-w-[44px] cursor-pointer items-center justify-center rounded-lg text-warm-brown/70 transition-colors hover:bg-warm-gray hover:text-warm-brown"
            aria-label="Open sidebar"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="4" x2="20" y1="12" y2="12" />
              <line x1="4" x2="20" y1="6" y2="6" />
              <line x1="4" x2="20" y1="18" y2="18" />
            </svg>
          </button>
          <span className="font-display text-lg font-bold text-teal-primary">
            {shopName} Admin
          </span>
        </header>

        <main className="flex-1 overflow-auto p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
