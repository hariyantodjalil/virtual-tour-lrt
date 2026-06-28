import Link from "next/link";
import { MapPin, BarChart3, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";

type NavbarProps = {
  variant?: "light" | "dark";
};

export default function Navbar({ variant = "light" }: NavbarProps) {
  const isDark = variant === "dark";

  return (
    <header
      className={`sticky top-0 z-40 w-full border-b backdrop-blur supports-[backdrop-filter]:backdrop-blur ${
        isDark
          ? "border-white/10 bg-[#081426]/92"
          : "border-gray-200 bg-white/95 supports-[backdrop-filter]:bg-white/80"
      }`}
    >
      <div className="container mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#E31E2D]">
            <span className="text-sm font-black text-white">LRT</span>
          </div>
          <div className="flex flex-col leading-tight">
            <span className={`text-sm font-black tracking-tight ${isDark ? "text-white" : "text-[#1B3A6B]"}`}>
              LRT Jabodebek
            </span>
            <span className={`text-[10px] font-medium uppercase tracking-wide ${isDark ? "text-white/50" : "text-gray-500"}`}>
              Virtual Tour Komersial
            </span>
          </div>
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          <Link
            href="/"
            className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              isDark ? "text-white/65 hover:bg-white/10 hover:text-white" : "text-gray-600 hover:bg-gray-100 hover:text-[#1B3A6B]"
            }`}
          >
            <MapPin className="h-4 w-4" />
            18 Stasiun
          </Link>
          <Link
            href="/dashboard"
            className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              isDark ? "text-white/65 hover:bg-white/10 hover:text-white" : "text-gray-600 hover:bg-gray-100 hover:text-[#1B3A6B]"
            }`}
          >
            <BarChart3 className="h-4 w-4" />
            Dashboard
          </Link>
        </nav>

        <Button size="sm" variant="default" asChild>
          <Link href="tel:+622180800000" className="flex items-center gap-2">
            <Phone className="h-4 w-4" />
            <span className="hidden sm:inline">Hubungi Tim</span>
          </Link>
        </Button>
      </div>
    </header>
  );
}
