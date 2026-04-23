"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  BarChart2,
  FileText,
  MessageSquare,
} from "lucide-react";

export function Sidebar({ isOpen, onClose }: { isOpen?: boolean; onClose?: () => void }) {
  const pathname = usePathname();

  const navLinks = [
    { name: "Dashboard", href: "/", icon: LayoutDashboard },
    { name: "Analyze", href: "/analyze", icon: BarChart2 },
    { name: "Results", href: "/results", icon: FileText },
    { name: "Chat", href: "/chat", icon: MessageSquare },
  ];

  const sidebarContent = (
    <>
      <div className="flex h-16 items-center justify-center border-b border-white/10 px-4 lg:justify-start">
        <span className="text-xl font-bold tracking-tight text-white hidden lg:block">
          KireiCode
        </span>
        <span className="text-xl font-bold tracking-tight text-white lg:hidden">
          KC
        </span>
      </div>
      <nav className="flex flex-1 flex-col gap-2 px-2 py-4">
        {navLinks.map((link) => {
          const isActive = pathname === link.href;
          const Icon = link.icon;
          return (
            <Link
              key={link.name}
              href={link.href}
              onClick={() => onClose?.()}
              className={`flex items-center justify-center gap-3 rounded-md px-3 py-2.5 transition-colors lg:justify-start ${
                isActive
                  ? "bg-cyan-400/15 text-cyan-200"
                  : "text-slate-400 hover:bg-white/5 hover:text-white"
              }`}
            >
              <Icon size={20} className="shrink-0" />
              <span className="hidden lg:block text-sm font-medium">
                {link.name}
              </span>
              <span className="lg:hidden text-sm font-medium md:hidden">
                {link.name}
              </span>
            </Link>
          );
        })}
      </nav>
    </>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden h-full w-20 flex-col border-r border-white/10 bg-slate-950/70 backdrop-blur md:flex lg:w-52 transition-all duration-200 shrink-0">
        {sidebarContent}
      </aside>

      {/* Mobile Sidebar Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm md:hidden"
          onClick={onClose}
        >
          <aside 
            className="h-full w-64 bg-slate-950 flex flex-col border-r border-white/10"
            onClick={(e) => e.stopPropagation()}
          >
            {sidebarContent}
          </aside>
        </div>
      )}
    </>
  );
}
