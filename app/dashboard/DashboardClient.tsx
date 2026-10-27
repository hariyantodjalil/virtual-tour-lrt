"use client";

import {
  BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell,
} from "recharts";
import {
  Users, Building2, TrendingUp, Eye, MessageCircle,
  Download, CheckCircle, Clock, XCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LEAD_STATUS_LABELS, type CommercialLeadStatus } from "@/lib/commercial-pipeline";
import { formatNumber } from "@/lib/utils";

type DashboardData = {
  stats: {
    totalVisits: number;
    totalLeads: number;
    totalSpaces: number;
    availableSpaces: number;
    occupiedSpaces: number;
    occupancyRate: number;
  };
  eventsByType: { type: string; count: number }[];
  recentLeads: {
    id: string;
    companyName: string;
    contactName: string;
    phone: string;
    email: string;
    businessType: string;
    status: string;
    spaceName: string;
    stationName: string;
    stationSlug: string;
    createdAt: string;
  }[];
  topStations: { stationId: string; stationName: string; visits: number }[];
  leadsByStatus: { status: string; count: number }[];
  dailyVisits: { date: string; count: number }[];
};

const EVENT_TYPE_LABELS: Record<string, string> = {
  STATION_VIEW: "Lihat Stasiun",
  SPACE_VIEW: "Lihat Ruang",
  TOUR_START: "Mulai Tour",
  FORM_SUBMIT: "Kirim Formulir",
  WHATSAPP_CLICK: "WA Click",
  PDF_DOWNLOAD: "Unduh PDF",
};

const CHIP = "border-[rgba(255,214,218,0.22)] bg-[#261015] text-[#F8ECEE]";
const LEAD_STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  NEW: { label: LEAD_STATUS_LABELS.NEW, color: CHIP, icon: <Clock className="h-3 w-3" /> },
  CONTACTED: { label: LEAD_STATUS_LABELS.CONTACTED, color: CHIP, icon: <MessageCircle className="h-3 w-3" /> },
  RDS_OFFER: { label: LEAD_STATUS_LABELS.RDS_OFFER, color: CHIP, icon: <MessageCircle className="h-3 w-3" /> },
  NEGOTIATING: { label: LEAD_STATUS_LABELS.NEGOTIATING, color: CHIP, icon: <TrendingUp className="h-3 w-3" /> },
  SITE_CHECK: { label: LEAD_STATUS_LABELS.SITE_CHECK, color: CHIP, icon: <Clock className="h-3 w-3" /> },
  BA_SIGNED: { label: LEAD_STATUS_LABELS.BA_SIGNED, color: CHIP, icon: <CheckCircle className="h-3 w-3" /> },
  DESIGN_REVIEW: { label: LEAD_STATUS_LABELS.DESIGN_REVIEW, color: CHIP, icon: <Clock className="h-3 w-3" /> },
  PKS: { label: LEAD_STATUS_LABELS.PKS, color: CHIP, icon: <CheckCircle className="h-3 w-3" /> },
  BILLING: { label: LEAD_STATUS_LABELS.BILLING, color: CHIP, icon: <Clock className="h-3 w-3" /> },
  FIT_OUT_HANDOVER: { label: LEAD_STATUS_LABELS.FIT_OUT_HANDOVER, color: CHIP, icon: <Clock className="h-3 w-3" /> },
  COMMERCIAL_OPERATION: { label: LEAD_STATUS_LABELS.COMMERCIAL_OPERATION, color: "border-emerald-400/30 bg-emerald-500/10 text-emerald-100", icon: <CheckCircle className="h-3 w-3" /> },
  CLOSED_WON: { label: LEAD_STATUS_LABELS.CLOSED_WON, color: "border-emerald-400/30 bg-emerald-500/10 text-emerald-100", icon: <CheckCircle className="h-3 w-3" /> },
  CLOSED_LOST: { label: LEAD_STATUS_LABELS.CLOSED_LOST, color: "border-red-400/30 bg-red-500/10 text-red-100", icon: <XCircle className="h-3 w-3" /> },
};

const CHART_COLORS = ["#fb3444", "#34d399", "#38bdf8", "#f59e0b", "#a78bfa"];
const PANEL_CLASS = "border-[rgba(255,214,218,0.14)] bg-[#3A161C] text-[#F8ECEE]";
const GRID_COLOR = "rgba(255,214,218,.12)";
const AXIS_COLOR = "#C4A8AD";
const TOOLTIP_STYLE = {
  backgroundColor: "#261015",
  border: "1px solid rgba(255,214,218,.18)",
  borderRadius: 12,
  color: "#F8ECEE",
  boxShadow: "0 18px 50px rgba(0,0,0,.35)",
};

function StatCard({ title, value, subtitle, icon: Icon, color }: {
  title: string; value: string | number; subtitle?: string; icon: React.ElementType; color: string;
}) {
  return (
    <Card className={PANEL_CLASS}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-[#C4A8AD]">{title}</p>
            <p className="mt-1 text-3xl font-black text-white">{value}</p>
            {subtitle && <p className="mt-1 text-xs text-[#C4A8AD]">{subtitle}</p>}
          </div>
          <div className={`rounded-xl p-3 shadow-lg ${color}`}>
            <Icon className="h-5 w-5 text-white" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function exportCSV(leads: DashboardData["recentLeads"]) {
  const headers = ["ID", "Perusahaan", "Kontak", "Telepon", "Email", "Jenis Usaha", "Status", "Ruang", "Stasiun", "Tanggal"];
  const rows = leads.map((l) => [
    l.id, l.companyName, l.contactName, l.phone, l.email,
    l.businessType, l.status, l.spaceName, l.stationName,
    new Date(l.createdAt).toLocaleDateString("id-ID"),
  ]);
  const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `leads-lrt-jabodebek-${new Date().toISOString().split("T")[0]}.csv`;
  a.click();
}

export default function DashboardClient({ data }: { data: DashboardData }) {
  const { stats, eventsByType, recentLeads, topStations, leadsByStatus, dailyVisits } = data;

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Kunjungan" value={formatNumber(stats.totalVisits)} icon={Eye} color="bg-sky-500/80" subtitle="Semua sesi virtual tour" />
        <StatCard title="Total Lead" value={formatNumber(stats.totalLeads)} icon={Users} color="bg-[#E31E2D]" subtitle="Calon tenant terdaftar" />
        <StatCard title="Unit Tersedia" value={stats.availableSpaces} icon={Building2} color="bg-emerald-500/85" subtitle={`dari ${stats.totalSpaces} total unit`} />
        <StatCard title="Tingkat Hunian" value={`${stats.occupancyRate}%`} icon={TrendingUp} color="bg-amber-500/85" subtitle={`${stats.occupiedSpaces} unit terisi`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Daily Visits Chart */}
        <Card className={`lg:col-span-2 ${PANEL_CLASS}`}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-white">Kunjungan 7 Hari Terakhir</CardTitle>
          </CardHeader>
          <CardContent>
            {dailyVisits.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={dailyVisits}>
                  <CartesianGrid stroke={GRID_COLOR} vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: AXIS_COLOR }} axisLine={false} tickLine={false} tickFormatter={(d) => d.slice(5)} />
                  <YAxis tick={{ fontSize: 11, fill: AXIS_COLOR }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => [formatNumber(Number(v)), "Kunjungan"]} />
                  <Line type="monotone" dataKey="count" stroke="#34d399" strokeWidth={2.5} dot={{ fill: "#34d399", r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-52 flex items-center justify-center text-[#C4A8AD] text-sm">
                Data kunjungan belum tersedia
              </div>
            )}
          </CardContent>
        </Card>

        {/* Occupancy Pie */}
        <Card className={PANEL_CLASS}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-white">Status Hunian</CardTitle>
          </CardHeader>
          <CardContent>
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
                  {[0, 1].map((_, i) => (
                    <Cell key={i} fill={i === 0 ? "#E31E2D" : "#10B981"} />
                  ))}
                </Pie>
                <Tooltip contentStyle={TOOLTIP_STYLE} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex justify-center gap-4 text-xs text-[#F8ECEE]">
              <div className="flex items-center gap-1"><div className="h-2.5 w-2.5 rounded-full bg-[#E31E2D]" /> Terisi ({stats.occupiedSpaces})</div>
              <div className="flex items-center gap-1"><div className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Tersedia ({stats.availableSpaces})</div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Stations */}
        <Card className={PANEL_CLASS}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-white">Stasiun Paling Banyak Dikunjungi</CardTitle>
          </CardHeader>
          <CardContent>
            {topStations.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={topStations} layout="vertical">
                  <CartesianGrid stroke={GRID_COLOR} horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11, fill: AXIS_COLOR }} axisLine={false} tickLine={false} />
                  <YAxis dataKey="stationName" type="category" tick={{ fontSize: 10, fill: AXIS_COLOR }} width={120} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => [formatNumber(Number(v)), "Kunjungan"]} />
                  <Bar dataKey="visits" fill="#34d399" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-52 flex items-center justify-center text-[#C4A8AD] text-sm">
                Belum ada data kunjungan per stasiun
              </div>
            )}
          </CardContent>
        </Card>

        {/* Event breakdown */}
        <Card className={PANEL_CLASS}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-white">Aktivitas Pengguna</CardTitle>
          </CardHeader>
          <CardContent>
            {eventsByType.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={eventsByType.map((e) => ({ ...e, label: EVENT_TYPE_LABELS[e.type] ?? e.type }))}>
                  <CartesianGrid stroke={GRID_COLOR} vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: AXIS_COLOR }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: AXIS_COLOR }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => [formatNumber(Number(v)), "Event"]} />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {eventsByType.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-52 flex items-center justify-center text-[#C4A8AD] text-sm">
                Belum ada data aktivitas
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Lead Pipeline */}
      <Card className={PANEL_CLASS}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base text-white">Pipeline Lead Tenant</CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportCSV(recentLeads)}
              className="flex items-center gap-1.5 border-white/15 bg-white/5 text-[#F8ECEE] hover:bg-white/10"
            >
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
          </div>
          {/* Status summary */}
          <div className="flex flex-wrap gap-2 mt-3">
            {leadsByStatus.map((l) => {
              const cfg = LEAD_STATUS_CONFIG[l.status];
              return (
                <span key={l.status} className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold ${cfg?.color ?? "border-white/10 bg-white/5 text-[#F8ECEE]"}`}>
                  {cfg?.icon}
                  {cfg?.label ?? LEAD_STATUS_LABELS[l.status as CommercialLeadStatus] ?? l.status}: {l.count}
                </span>
              );
            })}
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  {["Perusahaan", "Kontak", "Jenis Usaha", "Unit", "Stasiun", "Status", "Tanggal"].map((h) => (
                    <th key={h} className="text-left py-2.5 px-3 text-xs font-semibold text-[#C4A8AD] uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/8">
                {recentLeads.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-[#C4A8AD] text-sm">
                      Belum ada lead masuk
                    </td>
                  </tr>
                ) : (
                  recentLeads.map((lead) => {
                    const cfg = LEAD_STATUS_CONFIG[lead.status];
                    return (
                      <tr key={lead.id} className="transition-colors hover:bg-white/[0.04]">
                        <td className="py-3 px-3 font-semibold text-white">{lead.companyName}</td>
                        <td className="py-3 px-3 text-[#F8ECEE]">
                          <div>{lead.contactName}</div>
                          <div className="text-xs text-[#C4A8AD]">{lead.phone}</div>
                        </td>
                        <td className="py-3 px-3 text-[#F8ECEE]">{lead.businessType}</td>
                        <td className="py-3 px-3 text-[#F8ECEE] font-mono text-xs">{lead.spaceName}</td>
                        <td className="py-3 px-3 text-[#F8ECEE]">{lead.stationName}</td>
                        <td className="py-3 px-3">
                          <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold ${cfg?.color ?? "border-white/10 bg-white/5 text-[#F8ECEE]"}`}>
                            {cfg?.icon}
                            {cfg?.label ?? LEAD_STATUS_LABELS[lead.status as CommercialLeadStatus] ?? lead.status}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-[#C4A8AD] text-xs whitespace-nowrap">
                          {new Date(lead.createdAt).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
