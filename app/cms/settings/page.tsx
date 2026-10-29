"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Wrench,
  ShieldCheck,
  Save,
  RefreshCw,
  Eye,
  AlertTriangle,
  Clock,
  User,
  CheckCircle2,
  Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cmsFetch } from "@/lib/cms-fetch";

type MaintenanceData = {
  isMaintenanceMode: boolean;
  maintenanceMessage: string;
  updatedBy: string | null;
  updatedAt: string | null;
};

const DEFAULT_MESSAGE =
  "Situs Virtual Tour LRT Jabodebek sedang dalam pemeliharaan sistem. Silakan kembali beberapa saat lagi.";

export default function SystemSettingsPage() {
  const [data, setData] = useState<MaintenanceData>({
    isMaintenanceMode: false,
    maintenanceMessage: DEFAULT_MESSAGE,
    updatedBy: null,
    updatedAt: null,
  });

  const [initialData, setInitialData] = useState<MaintenanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: "ok" | "err"; msg: string } | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [pendingMode, setPendingMode] = useState<boolean | null>(null);

  function showToast(type: "ok" | "err", msg: string) {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 4000);
  }

  async function fetchSettings(isRefresh = false) {
    if (isRefresh) setLoading(true);
    try {
      const res = await cmsFetch("/api/cms/settings/maintenance");
      if (res.ok) {
        const payload: MaintenanceData = await res.json();
        setData(payload);
        setInitialData(payload);
      } else if (isRefresh) {
        showToast("err", "Gagal memuat pengaturan maintenance");
      }
    } catch {
      if (isRefresh) showToast("err", "Terjadi kesalahan saat memuat pengaturan");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    async function init() {
      try {
        const res = await cmsFetch("/api/cms/settings/maintenance");
        if (res.ok && active) {
          const payload: MaintenanceData = await res.json();
          setData(payload);
          setInitialData(payload);
        }
      } catch (err) {
        console.error(err);
      } finally {
        if (active) setLoading(false);
      }
    }
    void init();
    return () => {
      active = false;
    };
  }, []);

  function handleToggleClick(targetState: boolean) {
    setPendingMode(targetState);
    setShowConfirmModal(true);
  }

  async function executeSave(newMode?: boolean) {
    const modeToSave = newMode !== undefined ? newMode : data.isMaintenanceMode;
    setSaving(true);
    try {
      const res = await cmsFetch("/api/cms/settings/maintenance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          isMaintenanceMode: modeToSave,
          maintenanceMessage: data.maintenanceMessage,
        }),
      });

      const resData = await res.json();
      if (res.ok) {
        setData(resData.config);
        setInitialData(resData.config);
        showToast("ok", resData.message || "Pengaturan berhasil disimpan");
      } else {
        showToast("err", resData.error || "Gagal menyimpan pengaturan");
      }
    } catch {
      showToast("err", "Gagal menghubungi server");
    } finally {
      setSaving(false);
      setShowConfirmModal(false);
      setPendingMode(null);
    }
  }

  const hasUnsavedMessage =
    initialData !== null && data.maintenanceMessage !== initialData.maintenanceMessage;

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-12">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed top-5 right-5 z-50 flex items-center gap-2 rounded-xl px-4 py-3 text-xs font-semibold shadow-2xl transition-all ${
            toast.type === "ok"
              ? "border border-emerald-500/40 bg-emerald-950 text-emerald-200"
              : "border border-red-500/40 bg-red-950 text-red-200"
          }`}
        >
          {toast.type === "ok" ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          ) : (
            <AlertTriangle className="h-4 w-4 text-red-400" />
          )}
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Pengaturan Sistem</h1>
          <p className="text-xs text-[#C4A8AD]">
            Kelola status operasional situs publik dan pembatasan akses sistem
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchSettings(true)}
            disabled={loading}
            className="border-[rgba(255,214,218,0.14)] bg-[#1C0A0E] text-xs text-[#F0DDE1] hover:bg-[#261015]"
          >
            <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button
            asChild
            variant="outline"
            size="sm"
            className="border-[rgba(255,214,218,0.14)] bg-[#1C0A0E] text-xs text-[#F0DDE1] hover:bg-[#261015]"
          >
            <Link href="/maintenance" target="_blank">
              <Eye className="mr-1.5 h-3.5 w-3.5 text-sky-400" />
              Preview Halaman Maintenance
            </Link>
          </Button>
        </div>
      </div>

      {/* Mode Status Banner Card */}
      <div
        className={`relative overflow-hidden rounded-2xl border p-6 transition-all ${
          data.isMaintenanceMode
            ? "border-rose-500/40 bg-gradient-to-r from-rose-950/60 via-[#261015]/90 to-[#261015]"
            : "border-emerald-500/40 bg-gradient-to-r from-emerald-950/40 via-[#261015]/90 to-[#261015]"
        }`}
      >
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <div
              className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border shadow-xl ${
                data.isMaintenanceMode
                  ? "border-rose-500/50 bg-rose-500/20 text-rose-300 shadow-rose-900/30"
                  : "border-emerald-500/50 bg-emerald-500/20 text-emerald-300 shadow-emerald-900/30"
              }`}
            >
              {data.isMaintenanceMode ? (
                <Wrench className="h-7 w-7 animate-pulse text-rose-400" />
              ) : (
                <ShieldCheck className="h-7 w-7 text-emerald-400" />
              )}
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-0.5 text-xs font-semibold ${
                    data.isMaintenanceMode
                      ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                      : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                  }`}
                >
                  <span
                    className={`h-2 w-2 rounded-full ${
                      data.isMaintenanceMode ? "bg-rose-400 animate-ping" : "bg-emerald-400"
                    }`}
                  />
                  {data.isMaintenanceMode
                    ? "MODE MAINTENANCE AKTIF"
                    : "SITUS PUBLIK AKTIF NORMAL"}
                </span>
              </div>
              <h2 className="text-lg font-bold text-white">
                {data.isMaintenanceMode
                  ? "Akses Pengunjung Publik Ditutup Sementara"
                  : "Seluruh Pengunjung Publik Dapat Mengakses Virtual Tour"}
              </h2>
              <p className="text-xs text-[#C4A8AD] max-w-xl">
                {data.isMaintenanceMode
                  ? "Pengunjung publik dialihkan ke halaman pemeliharaan sistem. Hanya Administrator dan Editor yang dapat mengakses CMS dan meninjau tur."
                  : "Platform virtual tour, katalog unit komersial, dan portal mitra dapat diakses secara leluasa oleh semua pengunjung."}
              </p>
            </div>
          </div>

          {/* Big Action Toggle */}
          <div className="flex shrink-0 items-center gap-3">
            <Button
              type="button"
              size="lg"
              disabled={saving || loading}
              onClick={() => handleToggleClick(!data.isMaintenanceMode)}
              className={`font-semibold shadow-lg transition-all ${
                data.isMaintenanceMode
                  ? "bg-[#E31E2D] hover:bg-[#c41926] text-white shadow-emerald-950/40"
                  : "bg-rose-600 hover:bg-rose-500 text-white shadow-rose-950/40"
              }`}
            >
              {data.isMaintenanceMode ? (
                <>
                  <ShieldCheck className="mr-2 h-4 w-4" />
                  Matikan Maintenance (Buka Publik)
                </>
              ) : (
                <>
                  <Wrench className="mr-2 h-4 w-4" />
                  Aktifkan Mode Maintenance
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Settings Form */}
        <div className="space-y-6 lg:col-span-2">
          <Card className="border-[rgba(255,214,218,0.14)] bg-[#3A161C]/60 backdrop-blur">
            <CardHeader>
              <CardTitle className="text-base font-semibold text-white">
                Pesan Pemeliharaan Publik
              </CardTitle>
              <CardDescription className="text-xs text-[#C4A8AD]">
                Pesan ini akan ditampilkan kepada pengunjung yang membuka situs saat mode
                maintenance aktif.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-[#F0DDE1]">Isi Pesan</Label>
                  <button
                    type="button"
                    onClick={() => setData({ ...data, maintenanceMessage: DEFAULT_MESSAGE })}
                    className="text-[11px] text-sky-400 hover:underline"
                  >
                    Gunakan Pesan Standar
                  </button>
                </div>
                <Textarea
                  value={data.maintenanceMessage}
                  onChange={(e) => setData({ ...data, maintenanceMessage: e.target.value })}
                  placeholder="Ketik pesan pemeliharaan untuk pengunjung..."
                  rows={4}
                  className="bg-[#1C0A0E] border-[rgba(255,214,218,0.14)] text-xs text-[#F8ECEE] focus:border-rose-500"
                />
                <div className="flex justify-between text-[11px] text-[#A88990]">
                  <span>Maksimal 300 karakter</span>
                  <span>{data.maintenanceMessage.length} karakter</span>
                </div>
              </div>

              {hasUnsavedMessage && (
                <div className="flex items-center justify-end gap-2 pt-2 border-t border-[rgba(255,214,218,0.14)]">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setData({
                        ...data,
                        maintenanceMessage: initialData?.maintenanceMessage || DEFAULT_MESSAGE,
                      })
                    }
                    className="text-xs text-[#C4A8AD] hover:text-white"
                  >
                    Batal
                  </Button>
                  <Button
                    size="sm"
                    disabled={saving}
                    onClick={() => executeSave()}
                    className="bg-rose-600 hover:bg-rose-500 text-xs text-white"
                  >
                    <Save className="mr-1.5 h-3.5 w-3.5" />
                    {saving ? "Menyimpan…" : "Simpan Pesan"}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Petunjuk Akses */}
          <Card className="border-[rgba(255,214,218,0.14)] bg-[#3A161C]/60 backdrop-blur">
            <CardHeader>
              <CardTitle className="text-base font-semibold text-white">
                Aturan & Hak Akses
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-xs text-[#F0DDE1]">
              <div className="flex items-start gap-2.5 rounded-xl border border-[rgba(255,214,218,0.14)] bg-[#1C0A0E]/40 p-3">
                <Lock className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                <div>
                  <span className="font-semibold text-[#F8ECEE]">Akses CMS & Editor:</span>
                  <p className="mt-0.5 text-[#C4A8AD]">
                    Administrator dan Editor tetap dapat login dan menggunakan seluruh menu CMS
                    untuk upload aset dan memperbarui stasiun.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2.5 rounded-xl border border-[rgba(255,214,218,0.14)] bg-[#1C0A0E]/40 p-3">
                <Eye className="mt-0.5 h-4 w-4 shrink-0 text-sky-400" />
                <div>
                  <span className="font-semibold text-[#F8ECEE]">Live Preview Admin:</span>
                  <p className="mt-0.5 text-[#C4A8AD]">
                    Admin yang sudah login tetap dapat membuka halaman depan / tur 3D stasiun untuk
                    memastikan kualitas sebelum publik dibuka.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Audit & Info Sidebar */}
        <div className="space-y-6">
          <Card className="border-[rgba(255,214,218,0.14)] bg-[#3A161C]/60 backdrop-blur">
            <CardHeader>
              <CardTitle className="text-sm font-semibold text-white">Informasi Log</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-xs">
              <div className="space-y-1">
                <span className="text-[11px] text-[#A88990]">Terakhir Diperbarui Oleh:</span>
                <div className="flex items-center gap-1.5 font-medium text-[#F8ECEE]">
                  <User className="h-3.5 w-3.5 text-[#C4A8AD]" />
                  <span className="truncate">{data.updatedBy || "Sistem"}</span>
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-[11px] text-[#A88990]">Waktu Pembaruan:</span>
                <div className="flex items-center gap-1.5 font-medium text-[#F8ECEE]">
                  <Clock className="h-3.5 w-3.5 text-[#C4A8AD]" />
                  <span>
                    {data.updatedAt
                      ? new Date(data.updatedAt).toLocaleString("id-ID", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })
                      : "-"}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && pendingMode !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-[rgba(255,214,218,0.14)] bg-[#1C0A0E] p-6 shadow-2xl">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-[rgba(255,214,218,0.14)] bg-[#1C0A0E]">
              {pendingMode ? (
                <Wrench className="h-6 w-6 text-rose-400" />
              ) : (
                <ShieldCheck className="h-6 w-6 text-emerald-400" />
              )}
            </div>

            <h3 className="text-lg font-bold text-white">
              {pendingMode
                ? "Konfirmasi Aktifkan Mode Maintenance?"
                : "Buka Kembali Situs untuk Publik?"}
            </h3>

            <p className="mt-2 text-xs leading-relaxed text-[#F0DDE1]">
              {pendingMode
                ? "Seluruh pengunjung umum akan dialihkan ke halaman pemeliharaan sistem. Anda dan tim admin tetap dapat mengakses CMS."
                : "Situs publik akan langsung dapat diakses kembali oleh seluruh pengunjung secara normal."}
            </p>

            <div className="mt-6 flex justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                disabled={saving}
                onClick={() => {
                  setShowConfirmModal(false);
                  setPendingMode(null);
                }}
                className="text-xs text-[#F0DDE1] hover:text-white"
              >
                Batal
              </Button>
              <Button
                size="sm"
                disabled={saving}
                onClick={() => executeSave(pendingMode)}
                className={`text-xs font-semibold ${
                  pendingMode
                    ? "bg-rose-600 hover:bg-rose-500 text-white"
                    : "bg-[#E31E2D] hover:bg-[#c41926] text-white"
                }`}
              >
                {saving
                  ? "Memproses…"
                  : pendingMode
                  ? "Ya, Aktifkan Maintenance"
                  : "Ya, Buka Situs Publik"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
