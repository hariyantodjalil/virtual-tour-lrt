"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Building2, CheckCircle, Clock, LogOut, MapPin, MessageCircle, TrendingUp, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type User = {
  id: string;
  email: string;
  name: string;
  role: string;
};

type Lead = {
  id: string;
  companyName: string;
  contactName: string;
  email: string;
  phone: string;
  businessType: string;
  status: string;
  message: string | null;
  createdAt: string;
  space: {
    code: string;
    name: string;
    type: string;
    area: number;
    station: { name: string; slug: string };
  } | null;
};

const STATUS_CONFIG: Record<string, { label: string; icon: React.ElementType; className: string }> = {
  NEW: { label: "Baru diajukan", icon: Clock, className: "border-sky-300/30 bg-sky-400/10 text-sky-200" },
  CONTACTED: { label: "Dihubungi", icon: MessageCircle, className: "border-cyan-300/30 bg-cyan-400/10 text-cyan-200" },
  NEGOTIATING: { label: "Negosiasi", icon: TrendingUp, className: "border-amber-300/30 bg-amber-400/10 text-amber-200" },
  CLOSED_WON: { label: "Disetujui", icon: CheckCircle, className: "border-emerald-300/30 bg-emerald-400/10 text-emerald-200" },
  CLOSED_LOST: { label: "Tidak lanjut", icon: XCircle, className: "border-red-300/30 bg-red-400/10 text-red-200" },
};

export default function PartnerPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [verifyRes, leadsRes] = await Promise.all([
        fetch("/api/auth/verify"),
        fetch("/api/partner/leads"),
      ]);

      if (verifyRes.ok) {
        const verify = await verifyRes.json();
        setUser(verify.user);
      }

      if (leadsRes.ok) setLeads(await leadsRes.json());
      setLoading(false);
    }

    void load();
  }, []);

  const summary = useMemo(() => {
    return {
      total: leads.length,
      active: leads.filter((lead) => ["NEW", "CONTACTED", "NEGOTIATING"].includes(lead.status)).length,
      won: leads.filter((lead) => lead.status === "CLOSED_WON").length,
    };
  }, [leads]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
  }

  return (
    <div className="min-h-screen bg-[#07111f] text-slate-100">
      <header className="border-b border-white/10 bg-[#081426]/95">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#E31E2D] text-sm font-black text-white">LRT</div>
            <div>
              <p className="text-sm font-black text-white">Panel Mitra</p>
              <p className="text-xs text-slate-400">Virtual Tour Komersial</p>
            </div>
          </Link>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-slate-300 sm:inline">{user?.name ?? user?.email}</span>
            <Button variant="ghost" size="sm" onClick={logout} className="text-slate-300 hover:bg-white/10 hover:text-white">
              <LogOut className="h-4 w-4" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-black text-white">Status Pengajuan Sewa</h1>
          <p className="mt-1 text-slate-400">Pantau perkembangan minat sewa yang Anda ajukan dari virtual tour.</p>
        </div>

        <div className="mb-6 grid gap-4 md:grid-cols-3">
          <Metric title="Total Pengajuan" value={summary.total} />
          <Metric title="Sedang Diproses" value={summary.active} />
          <Metric title="Disetujui" value={summary.won} />
        </div>

        {loading ? (
          <p className="text-slate-400">Memuat pengajuan...</p>
        ) : leads.length === 0 ? (
          <Card className="border-white/10 bg-white/[0.055] text-slate-100">
            <CardContent className="p-8 text-center">
              <p className="font-semibold text-white">Belum ada pengajuan.</p>
              <p className="mt-1 text-sm text-slate-400">Buka virtual tour dan pilih unit yang ingin diajukan.</p>
              <Button asChild className="mt-5">
                <Link href="/">Lihat Stasiun</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {leads.map((lead) => {
              const status = STATUS_CONFIG[lead.status] ?? STATUS_CONFIG.NEW;
              const Icon = status.icon;
              return (
                <Card key={lead.id} className="border-white/10 bg-white/[0.055] text-slate-100 shadow-2xl shadow-black/20">
                  <CardContent className="grid gap-4 p-5 md:grid-cols-[1fr_auto] md:items-center">
                    <div>
                      <div className="mb-3 flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className={status.className}>
                          <Icon className="mr-1 h-3 w-3" />
                          {status.label}
                        </Badge>
                        <span className="text-xs text-slate-500">{new Date(lead.createdAt).toLocaleDateString("id-ID")}</span>
                      </div>
                      <h2 className="text-lg font-black text-white">
                        {lead.space?.code ?? "-"} - {lead.space?.name ?? "Unit Komersial"}
                      </h2>
                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-400">
                        <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {lead.space?.station?.name ?? "-"}</span>
                        <span className="inline-flex items-center gap-1"><Building2 className="h-3.5 w-3.5" /> {lead.businessType}</span>
                        {lead.space && <span>{lead.space.area} m²</span>}
                      </div>
                      {lead.message && <p className="mt-3 text-sm text-slate-300">{lead.message}</p>}
                    </div>
                    {lead.space?.station?.slug && (
                      <Button asChild variant="outline" size="sm" className="border-slate-600 text-slate-200 hover:bg-white/10">
                        <Link href={`/station/${lead.space.station.slug}`}>Lihat Unit</Link>
                      </Button>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

function Metric({ title, value }: { title: string; value: number }) {
  return (
    <Card className="border-white/10 bg-white/[0.055] text-slate-100">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-slate-400">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-black text-white">{value}</p>
      </CardContent>
    </Card>
  );
}
