import Link from "next/link";
import { MapPin, BarChart3, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Navbar() {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-gray-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
      <div className="container mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#E31E2D]">
            <span className="text-sm font-black text-white">LRT</span>
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-sm font-black text-[#1B3A6B] tracking-tight">LRT Jabodebek</span>
            <span className="text-[10px] text-gray-500 font-medium tracking-wide uppercase">Virtual Tour Komersial</span>
          </div>
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          <Link href="/" className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-gray-600 hover:text-[#1B3A6B] hover:bg-gray-100 transition-colors">
            <MapPin className="h-4 w-4" />
            18 Stasiun
          </Link>
          <Link href="/dashboard" className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-gray-600 hover:text-[#1B3A6B] hover:bg-gray-100 transition-colors">
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
