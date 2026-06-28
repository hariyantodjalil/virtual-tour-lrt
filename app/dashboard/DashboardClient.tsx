"use client";

import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell,
} from "recharts";
import {
  Users, Building2, TrendingUp, Eye, MessageCircle,
  Download, CheckCircle, Clock, XCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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

const LEAD_STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  NEW: { label: "Baru", color: "bg-blue-100 text-blue-800", icon: <Clock className="h-3 w-3" /> },
  CONTACTED: { label: "Dihubungi", color: "bg-purple-100 text-purple-800", icon: <MessageCircle className="h-3 w-3" /> },
  NEGOTIATING: { label: "Negosiasi", color: "bg-amber-100 text-amber-800", icon: <TrendingUp className="h-3 w-3" /> },
  CLOSED_WON: { label: "Berhasil", color: "bg-emerald-100 text-emerald-800", icon: <CheckCircle className="h-3 w-3" /> },
  CLOSED_LOST: { label: "Gagal", color: "bg-red-100 text-red-800", icon: <XCircle className="h-3 w-3" /> },
};

const CHART_COLORS = ["#E31E2D", "#1B3A6B", "#10B981", "#F59E0B", "#8B5CF6"];

function StatCard({ title, value, subtitle, icon: Icon, color }: {
  title: string; value: string | number; subtitle?: string; icon: React.ElementType; color: string;
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500">{title}</p>
            <p className="text-3xl font-black text-gray-900 mt-1">{value}</p>
            {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
          </div>
          <div className={`rounded-xl p-3 ${color}`}>
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
        <StatCard title="Total Kunjungan" value={formatNumber(stats.totalVisits)} icon={Eye} color="bg-[#1B3A6B]" subtitle="Semua sesi virtual tour" />
        <StatCard title="Total Lead" value={formatNumber(stats.totalLeads)} icon={Users} color="bg-[#E31E2D]" subtitle="Calon tenant terdaftar" />
        <StatCard title="Unit Tersedia" value={stats.availableSpaces} icon={Building2} color="bg-emerald-600" subtitle={`dari ${stats.totalSpaces} total unit`} />
        <StatCard title="Tingkat Hunian" value={`${stats.occupancyRate}%`} icon={TrendingUp} color="bg-amber-500" subtitle={`${stats.occupiedSpaces} unit terisi`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Daily Visits Chart */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Kunjungan 7 Hari Terakhir</CardTitle>
          </CardHeader>
          <CardContent>
            {dailyVisits.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={dailyVisits}>
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(d) => d.slice(5)} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => [formatNumber(Number(v)), "Kunjungan"]} />
                  <Line type="monotone" dataKey="count" stroke="#E31E2D" strokeWidth={2.5} dot={{ fill: "#E31E2D", r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-52 flex items-center justify-center text-gray-400 text-sm">
                Data kunjungan belum tersedia
              </div>
            )}
          </CardContent>
        </Card>

        {/* Occupancy Pie */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Status Hunian</CardTitle>
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
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex justify-center gap-4 text-xs">
              <div className="flex items-center gap-1"><div className="h-2.5 w-2.5 rounded-full bg-[#E31E2D]" /> Terisi ({stats.occupiedSpaces})</div>
              <div className="flex items-center gap-1"><div className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Tersedia ({stats.availableSpaces})</div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Stations */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Stasiun Paling Banyak Dikunjungi</CardTitle>
          </CardHeader>
          <CardContent>
            {topStations.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={topStations} layout="vertical">
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis dataKey="stationName" type="category" tick={{ fontSize: 10 }} width={120} />
                  <Tooltip formatter={(v) => [formatNumber(Number(v)), "Kunjungan"]} />
                  <Bar dataKey="visits" fill="#1B3A6B" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-52 flex items-center justify-center text-gray-400 text-sm">
                Belum ada data kunjungan per stasiun
              </div>
            )}
          </CardContent>
        </Card>

        {/* Event breakdown */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Aktivitas Pengguna</CardTitle>
          </CardHeader>
          <CardContent>
            {eventsByType.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={eventsByType.map((e) => ({ ...e, label: EVENT_TYPE_LABELS[e.type] ?? e.type }))}>
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => [formatNumber(Number(v)), "Event"]} />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {eventsByType.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-52 flex items-center justify-center text-gray-400 text-sm">
                Belum ada data aktivitas
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Lead Pipeline */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Pipeline Lead Tenant</CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportCSV(recentLeads)}
              className="flex items-center gap-1.5"
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
                <span key={l.status} className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${cfg?.color ?? "bg-gray-100 text-gray-700"}`}>
                  {cfg?.icon}
                  {cfg?.label ?? l.status}: {l.count}
                </span>
              );
            })}
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  {["Perusahaan", "Kontak", "Jenis Usaha", "Unit", "Stasiun", "Status", "Tanggal"].map((h) => (
                    <th key={h} className="text-left py-2.5 px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {recentLeads.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-gray-400 text-sm">
                      Belum ada lead masuk
                    </td>
                  </tr>
                ) : (
                  recentLeads.map((lead) => {
                    const cfg = LEAD_STATUS_CONFIG[lead.status];
                    return (
                      <tr key={lead.id} className="hover:bg-gray-50 transition-colors">
                        <td className="py-3 px-3 font-semibold text-gray-900">{lead.companyName}</td>
                        <td className="py-3 px-3 text-gray-600">
                          <div>{lead.contactName}</div>
                          <div className="text-xs text-gray-400">{lead.phone}</div>
                        </td>
                        <td className="py-3 px-3 text-gray-600">{lead.businessType}</td>
                        <td className="py-3 px-3 text-gray-600 font-mono text-xs">{lead.spaceName}</td>
                        <td className="py-3 px-3 text-gray-600">{lead.stationName}</td>
                        <td className="py-3 px-3">
                          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${cfg?.color ?? "bg-gray-100 text-gray-700"}`}>
                            {cfg?.icon}
                            {cfg?.label ?? lead.status}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-gray-400 text-xs whitespace-nowrap">
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
