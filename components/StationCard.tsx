import Link from "next/link";
import { Users, MapPin, Building2, ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatNumber } from "@/lib/utils";

type SpaceStats = {
  total: number;
  available: number;
  occupied: number;
};

type StationCardProps = {
  name: string;
  slug: string;
  line: string;
  address: string;
  dailyPassengers: number;
  spaceStats?: SpaceStats;
  order: number;
};

const STATION_GRADIENTS = [
  "from-blue-600 to-blue-800",
  "from-red-600 to-red-800",
  "from-emerald-600 to-emerald-800",
  "from-purple-600 to-purple-800",
  "from-orange-500 to-orange-700",
  "from-teal-600 to-teal-800",
];

export default function StationCard({
  name, slug, line, address, dailyPassengers, spaceStats, order,
}: StationCardProps) {
  const gradient = STATION_GRADIENTS[(order - 1) % STATION_GRADIENTS.length];
  const availableCount = spaceStats?.available ?? 0;
  const hasAvailable = availableCount > 0;

  return (
    <Card className="group overflow-hidden hover:shadow-lg transition-all duration-300 hover:-translate-y-1 border-gray-200">
      {/* Station Visual Header */}
      <div className={`relative h-36 bg-gradient-to-br ${gradient} flex items-end p-4`}>
        {/* 360 Badge */}
        <div className="absolute top-3 left-3 flex items-center gap-1 rounded-full bg-black/40 backdrop-blur-sm px-2.5 py-1">
          <svg className="h-3.5 w-3.5 text-white animate-spin-slow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
          </svg>
          <span className="text-[10px] font-bold text-white tracking-wider">360° VR</span>
        </div>

        {/* Status badge */}
        <div className="absolute top-3 right-3">
          {hasAvailable ? (
            <span className="flex items-center gap-1 rounded-full bg-emerald-500/90 backdrop-blur-sm px-2.5 py-1 text-[10px] font-bold text-white">
              <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
              {availableCount} Tersedia
            </span>
          ) : (
            <span className="rounded-full bg-gray-600/70 backdrop-blur-sm px-2.5 py-1 text-[10px] font-bold text-white">
              Penuh
            </span>
          )}
        </div>

        {/* Station name overlay */}
        <div>
          <p className="text-xs text-white/70 font-medium mb-0.5">Stasiun #{order}</p>
          <h3 className="text-lg font-black text-white leading-tight">{name}</h3>
        </div>
      </div>

      <CardContent className="p-4">
        {/* Info rows */}
        <div className="space-y-2 mb-4">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <MapPin className="h-3.5 w-3.5 shrink-0 text-gray-400" />
            <span className="truncate">{address}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Users className="h-3.5 w-3.5 shrink-0 text-[#E31E2D]" />
            <span><strong className="text-gray-900">{formatNumber(dailyPassengers)}</strong> penumpang/hari</span>
          </div>
          {spaceStats && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Building2 className="h-3.5 w-3.5 shrink-0 text-[#1B3A6B]" />
              <span>
                <strong className="text-gray-900">{spaceStats.total}</strong> unit komersial
                {" · "}
                <span className="text-emerald-600 font-medium">{spaceStats.available} tersedia</span>
              </span>
            </div>
          )}
        </div>

        {/* Line badge */}
        <div className="flex items-center justify-between mb-4">
          <Badge variant="secondary" className="text-[10px] font-semibold">
            {line}
          </Badge>
        </div>

        {/* CTA */}
        <Button asChild className="w-full" size="sm">
          <Link href={`/station/${slug}`} className="flex items-center justify-center gap-1.5">
            Mulai Virtual Tour
            <ChevronRight className="h-4 w-4" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
