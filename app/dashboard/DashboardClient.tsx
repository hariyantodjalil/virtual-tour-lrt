"use client";

import Link from "next/link";
import {
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  AlertTriangle,
  Users,
  Building2,
  TrendingUp,
  Eye,
  ArrowRight,
  Check,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  PUBLIC_LEAD_PROCESS_STEPS,
  publicLeadStageIndex,
} from "@/lib/commercial-pipeline";
import { cn, formatNumber } from "@/lib/utils";

type DashboardData = {
  stats: {
    totalVisits: number | null;
    totalLeads: number | null;
    totalSpaces: number | null;
    availableSpaces: number | null;
    occupiedSpaces: number | null;
    occupancyRate: number | null;
  };
  eventsByType: { type: string; count: number }[];
  topStations: { stationId: string; stationName: string; visits: number }[];
  leadsByStatus: { status: string; count: number }[];
  dailyVisits: { date: string; count: number }[];
  errors: string[];
};

const EVENT_TYPE_LABELS: Record<string, string> = {
  STATION_VIEW: "Lihat Stasiun",
  SPACE_VIEW: "Lihat Ruang",
  TOUR_START: "Mulai Tour",
  FORM_SUBMIT: "Kirim Formulir",
  WHATSAPP_CLICK: "WA Click",
  PDF_DOWNLOAD: "Unduh PDF",
};

const JOURNEY_SHORT_TITLES = [
  "Pengajuan",
  "Kontak",
  "Negosiasi",
  "Desain",
  "PKS",
  "Sewa aktif",
] as const;

const CHART_COLORS = ["#E31E2D", "#1B3A6B", "#0f766e", "#b45309", "#7c3aed"];
/** Chart chrome pakai netral Operate (bukan Void); hex wajib untuk Recharts. */
const GRID_COLOR = "#e2e8f0";
const AXIS_COLOR = "#64748b";
const TOOLTIP_STYLE = {
  backgroundColor: "#ffffff",
  border: "1px solid #e2e8f0",
  borderRadius: 12,
  color: "#0f172a",
  boxShadow: "0 10px 30px rgba(15, 23, 42, 0.12)",
};

function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ElementType;
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-500">{title}</p>
            <p className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">{value}</p>
            {subtitle ? <p className="mt-1 text-xs text-slate-500">{subtitle}</p> : null}
          </div>
          <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-600">
            <Icon className="size-4" aria-hidden />
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

function ChartEmpty({ message }: { message: string }) {
  return (
    <div className="flex h-52 items-center justify-center text-sm text-slate-500">{message}</div>
  );
}

function buildLeadJourney(leadsByStatus: DashboardData["leadsByStatus"]) {
  const steps = PUBLIC_LEAD_PROCESS_STEPS.map((step, index) => {
    const count = leadsByStatus.reduce((sum, item) => {
      if (item.status === "CLOSED_LOST") return sum;
      return publicLeadStageIndex(item.status) === index ? sum + item.count : sum;
    }, 0);
    return {
      key: step.status,
      title: JOURNEY_SHORT_TITLES[index] ?? step.title,
      fullTitle: step.title,
      count,
    };
  });
  const inJourney = steps.reduce((sum, step) => sum + step.count, 0);
  const peak = Math.max(1, ...steps.map((step) => step.count));
  return { steps, inJourney, peak };
}

export default function DashboardClient({ data }: { data: DashboardData }) {
  const { stats, eventsByType, topStations, leadsByStatus, dailyVisits, errors } = data;
  const hasError = (key: string) => errors.includes(key);
  const unavailable = "—";
  const journey = buildLeadJourney(leadsByStatus);

  return (
    <div className="space-y-5">
      {errors.length > 0 ? (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"
        >
          <AlertTriangle aria-hidden className="mt-0.5 size-5 shrink-0" />
          <div>
            <p className="font-semibold">Sebagian data dashboard gagal dimuat</p>
            <p className="mt-1 text-amber-800">
              Nilai yang tidak tersedia ditandai dengan garis. Muat ulang halaman untuk mencoba lagi.
            </p>
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          title="Total Kunjungan"
          value={stats.totalVisits === null ? unavailable : formatNumber(stats.totalVisits)}
          icon={Eye}
          subtitle="Semua sesi virtual tour"
        />
        <StatCard
          title="Total Lead"
          value={stats.totalLeads === null ? unavailable : formatNumber(stats.totalLeads)}
          icon={Users}
          subtitle="Calon tenant terdaftar"
        />
        <StatCard
          title="Unit Tersedia"
          value={stats.availableSpaces ?? unavailable}
          icon={Building2}
          subtitle={`dari ${stats.totalSpaces ?? unavailable} total unit`}
        />
        <StatCard
          title="Tingkat Hunian"
          value={stats.occupancyRate === null ? unavailable : `${stats.occupancyRate}%`}
          icon={TrendingUp}
          subtitle={
            stats.occupiedSpaces === null ? "Data unit tidak tersedia" : `${stats.occupiedSpaces} unit terisi`
          }
        />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Kunjungan 7 Hari Terakhir</CardTitle>
            <CardDescription>Agregat STATION_VIEW per hari</CardDescription>
          </CardHeader>
          <CardContent>
            {hasError("dailyVisits") ? (
              <ChartEmpty message="Data kunjungan gagal dimuat" />
            ) : dailyVisits.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={dailyVisits}>
                  <CartesianGrid stroke={GRID_COLOR} vertical={false} />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11, fill: AXIS_COLOR }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(value) => String(value).slice(5)}
                  />
                  <YAxis tick={{ fontSize: 11, fill: AXIS_COLOR }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
                    formatter={(value) => [formatNumber(Number(value)), "Kunjungan"]}
                  />
                  <Line
                    type="monotone"
                    dataKey="count"
                    stroke="#1B3A6B"
                    strokeWidth={2.5}
                    dot={{ fill: "#1B3A6B", r: 3.5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <ChartEmpty message="Data kunjungan belum tersedia" />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Status Hunian</CardTitle>
            <CardDescription>Terisi vs tersedia</CardDescription>
          </CardHeader>
          <CardContent>
            {stats.occupiedSpaces === null || stats.availableSpaces === null ? (
              <ChartEmpty message="Data hunian gagal dimuat" />
            ) : (
              <>
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie
                      data={[
                        { name: "Terisi", value: stats.occupiedSpaces },
                        { name: "Tersedia", value: stats.availableSpaces },
                      ]}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      dataKey="value"
                    >
                      {[0, 1].map((index) => (
                        <Cell key={index} fill={index === 0 ? "#E31E2D" : "#0f766e"} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={TOOLTIP_STYLE} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex justify-center gap-4 text-xs text-slate-600">
                  <div className="flex items-center gap-1.5">
                    <span className="size-2.5 rounded-full bg-[#E31E2D]" aria-hidden />
                    Terisi ({stats.occupiedSpaces})
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="size-2.5 rounded-full bg-teal-700" aria-hidden />
                    Tersedia ({stats.availableSpaces})
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Stasiun Paling Banyak Dikunjungi</CardTitle>
            <CardDescription>Top 8 stasiun dari STATION_VIEW</CardDescription>
          </CardHeader>
          <CardContent>
            {hasError("topStations") ? (
              <ChartEmpty message="Data stasiun gagal dimuat" />
            ) : topStations.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={topStations} layout="vertical">
                  <CartesianGrid stroke={GRID_COLOR} horizontal={false} />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 11, fill: AXIS_COLOR }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    dataKey="stationName"
                    type="category"
                    tick={{ fontSize: 10, fill: AXIS_COLOR }}
                    width={120}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
                    formatter={(value) => [formatNumber(Number(value)), "Kunjungan"]}
                  />
                  <Bar dataKey="visits" fill="#1B3A6B" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <ChartEmpty message="Belum ada data kunjungan per stasiun" />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Aktivitas Pengguna</CardTitle>
            <CardDescription>Breakdown event analitik</CardDescription>
          </CardHeader>
          <CardContent>
            {hasError("eventsByType") ? (
              <ChartEmpty message="Data aktivitas gagal dimuat" />
            ) : eventsByType.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart
                  data={eventsByType.map((event) => ({
                    ...event,
                    label: EVENT_TYPE_LABELS[event.type] ?? event.type,
                  }))}
                >
                  <CartesianGrid stroke={GRID_COLOR} vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 10, fill: AXIS_COLOR }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis tick={{ fontSize: 11, fill: AXIS_COLOR }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
                    formatter={(value) => [formatNumber(Number(value)), "Event"]}
                  />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {eventsByType.map((_, index) => (
                      <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <ChartEmpty message="Belum ada data aktivitas" />
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1.5">
            <CardTitle className="text-base">Journey Lead Tenant</CardTitle>
            <CardDescription>
              {hasError("leadsByStatus")
                ? "Ringkasan tahap gagal dimuat"
                : `${formatNumber(journey.inJourney)} pengajuan aktif di enam tahap proses sewa`}
            </CardDescription>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href="/cms/leads" prefetch={false}>
              Lihat pengajuan
              <ArrowRight className="size-3.5" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          {hasError("leadsByStatus") ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-8 text-center text-sm text-amber-900">
              Data journey gagal dimuat
            </div>
          ) : journey.inJourney === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-500">
              Belum ada pengajuan di pipeline
            </div>
          ) : (
            <ol className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
              {journey.steps.map((step, index) => {
                const hasLeads = step.count > 0;
                const width = `${Math.max(8, Math.round((step.count / journey.peak) * 100))}%`;
                return (
                  <li key={step.key} className="relative min-w-0">
                    {index < journey.steps.length - 1 ? (
                      <span
                        aria-hidden
                        className="pointer-events-none absolute top-5 left-[calc(50%+1.25rem)] hidden h-px w-[calc(100%-1.5rem)] bg-slate-200 xl:block"
                      />
                    ) : null}
                    <div
                      className={cn(
                        "relative flex h-full flex-col rounded-xl border px-3 py-4",
                        hasLeads
                          ? "border-slate-200 bg-white"
                          : "border-dashed border-slate-200 bg-slate-50/70"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            "inline-flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                            hasLeads
                              ? "bg-[#E31E2D] text-white"
                              : "border border-slate-200 bg-white text-slate-500"
                          )}
                          aria-hidden
                        >
                          {hasLeads && index === journey.steps.length - 1 ? (
                            <Check className="size-3.5" />
                          ) : (
                            index + 1
                          )}
                        </span>
                        <p className="min-w-0 text-sm font-semibold text-slate-900" title={step.fullTitle}>
                          {step.title}
                        </p>
                      </div>
                      <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">
                        {formatNumber(step.count)}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">pengajuan di tahap ini</p>
                      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-slate-100" aria-hidden>
                        <div
                          className={cn(
                            "h-full rounded-full transition-[width]",
                            hasLeads ? "bg-[#1B3A6B]" : "bg-transparent"
                          )}
                          style={{ width: hasLeads ? width : "0%" }}
                        />
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
