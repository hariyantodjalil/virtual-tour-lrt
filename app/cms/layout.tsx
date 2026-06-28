"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Building2,
  LayoutDashboard,
  LogOut,
  Map,
  Store,
  Users,
  UserCircle,
  Train,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const navItems = [
  { href: "/cms/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/cms/stations", label: "Stasiun", icon: Train },
  { href: "/cms/virtual-tour", label: "Virtual Tour", icon: Map },
  { href: "/cms/spaces", label: "Ruang Komersial", icon: Store },
  { href: "/cms/leads", label: "Leads", icon: UserCircle },
  { href: "/cms/users", label: "Users", icon: Users, adminOnly: true },
];

export default function CmsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  if (pathname === "/cms/login") {
    return <>{children}</>;
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/cms/login");
  }

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-100">
      <aside className="w-64 border-r border-slate-800 bg-slate-900 flex flex-col">
        <div className="p-5 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Building2 className="h-6 w-6 text-emerald-400" />
            <div>
              <p className="font-semibold text-sm">Virtual Tour CMS</p>
              <p className="text-xs text-slate-400">LRT Jabodebek</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {navItems.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                  active ? "bg-emerald-600/20 text-emerald-300" : "text-slate-300 hover:bg-slate-800"
                }`}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t border-slate-800">
          <Button variant="ghost" className="w-full justify-start text-slate-300" onClick={handleLogout}>
            <LogOut className="h-4 w-4 mr-2" />
            Logout
          </Button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto">
        <div className="p-6 max-w-7xl mx-auto">{children}</div>
      </main>
    </div>
  );
}
