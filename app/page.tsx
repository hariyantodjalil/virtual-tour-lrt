import { Suspense } from "react";
import { Building2, MapPin, TrendingUp, Users } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { formatNumber } from "@/lib/utils";
import StationGrid from "./StationGrid";
import Navbar from "@/components/Navbar";

async function getStationsWithStats() {
  try {
    const stations = await prisma.station.findMany({
      orderBy: { order: "asc" },
      include: {
        commercialSpaces: { select: { status: true } },
      },
    });

    return stations.map((s) => ({
      id: s.id,
      name: s.name,
      slug: s.slug,
      line: s.line,
      address: s.address,
      dailyPassengers: s.dailyPassengers,
      order: s.order,
      spaceStats: {
        total: s.commercialSpaces.length,
        available: s.commercialSpaces.filter((sp) => sp.status === "TERSEDIA").length,
        occupied: s.commercialSpaces.filter((sp) => sp.status === "TERISI").length,
      },
    }));
  } catch {
    return [];
  }
}

async function getSummaryStats() {
  try {
    const [totalSpaces, availableSpaces, totalStations, totalPassengers] = await Promise.all([
      prisma.commercialSpace.count(),
      prisma.commercialSpace.count({ where: { status: "TERSEDIA" } }),
      prisma.station.count(),
      prisma.station.aggregate({ _sum: { dailyPassengers: true } }),
    ]);
    return {
      totalSpaces,
      availableSpaces,
      totalStations,
      totalPassengers: totalPassengers._sum.dailyPassengers ?? 0,
    };
  } catch {
    return { totalSpaces: 0, availableSpaces: 0, totalStations: 18, totalPassengers: 0 };
  }
}

export default async function HomePage() {
  const [stations, stats] = await Promise.all([getStationsWithStats(), getSummaryStats()]);

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      {/* Hero Section */}
      <section className="relative bg-[#1B3A6B] overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{
            backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 40px, rgba(255,255,255,.1) 40px, rgba(255,255,255,.1) 41px), repeating-linear-gradient(90deg, transparent, transparent 40px, rgba(255,255,255,.1) 40px, rgba(255,255,255,.1) 41px)"
          }} />
        </div>
        <div className="relative container mx-auto max-w-7xl px-4 py-16 text-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 border border-white/20 px-4 py-1.5 text-sm font-medium text-white/80 mb-6">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            Virtual Tour 360° · LRT Jabodebek
          </div>
          <h1 className="text-4xl md:text-5xl font-black text-white mb-4 leading-tight">
            Jelajahi Peluang Komersial
            <br />
            <span className="text-[#E31E2D]">LRT Jabodebek</span> Secara Virtual
          </h1>
          <p className="text-lg text-white/70 max-w-2xl mx-auto mb-10">
            Eksplorasi 18 stasiun strategis, lihat ketersediaan ruang komersial secara real-time,
            dan ajukan minat sewa tanpa harus datang langsung — 24 jam sehari, 7 hari seminggu.
          </p>

          {/* Stats bar */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl mx-auto">
            {[
              { icon: MapPin, label: "Stasiun", value: stats.totalStations.toString(), color: "text-blue-300" },
              { icon: Building2, label: "Unit Komersial", value: stats.totalSpaces.toString(), color: "text-purple-300" },
              { icon: TrendingUp, label: "Tersedia", value: stats.availableSpaces.toString(), color: "text-emerald-300" },
              { icon: Users, label: "Penumpang/Hari", value: formatNumber(stats.totalPassengers), color: "text-orange-300" },
            ].map((item) => (
              <div key={item.label} className="rounded-xl bg-white/5 border border-white/10 p-4 text-center">
                <item.icon className={`h-5 w-5 mx-auto mb-2 ${item.color}`} />
                <p className="text-2xl font-black text-white">{item.value}</p>
                <p className="text-xs text-white/50 mt-0.5">{item.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Main Content */}
      <main className="container mx-auto max-w-7xl px-4 py-10">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h2 className="text-2xl font-black text-gray-900">Pilih Stasiun</h2>
            <p className="text-gray-500 mt-1">Klik stasiun untuk memulai virtual tour 360°</p>
          </div>
        </div>

        <Suspense fallback={<StationGridSkeleton />}>
          <StationGrid stations={stations} />
        </Suspense>
      </main>

      {/* Footer CTA */}
      <section className="bg-[#E31E2D] mt-8">
        <div className="container mx-auto max-w-7xl px-4 py-10 text-center">
          <h3 className="text-2xl font-black text-white mb-2">Butuh Bantuan Memilih Ruang?</h3>
          <p className="text-white/80 mb-6">Tim komersial kami siap membantu Anda menemukan ruang yang sesuai kebutuhan bisnis.</p>
          <a
            href="https://wa.me/628118012012?text=Halo%2C%20saya%20tertarik%20dengan%20ruang%20komersial%20LRT%20Jabodebek"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3 font-bold text-[#E31E2D] hover:bg-gray-100 transition-colors"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5 fill-[#25D366]">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
            </svg>
            Hubungi Tim via WhatsApp
          </a>
        </div>
      </section>
    </div>
  );
}

function StationGridSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="h-64 rounded-xl bg-gray-200 animate-pulse" />
      ))}
    </div>
  );
}
