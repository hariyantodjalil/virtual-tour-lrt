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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
    <div className="space-y-6">
      {toast && (
        <div
          role="status"
          className={`fixed top-5 right-5 z-50 flex items-center gap-2 rounded-lg border px-4 py-3 text-sm font-medium shadow-lg ${
            toast.type === "ok"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-red-200 bg-red-50 text-red-800"
          }`}
        >
          {toast.type === "ok" ? (
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
          ) : (
            <AlertTriangle className="h-4 w-4 shrink-0 text-red-600" />
          )}
          {toast.msg}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => fetchSettings(true)}
          disabled={loading}
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin motion-reduce:animate-none" : ""}`} />
          Refresh
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link href="/maintenance" target="_blank">
            <Eye className="h-3.5 w-3.5" />
            Preview Halaman Maintenance
          </Link>
        </Button>
      </div>

      <div
        className={`flex flex-col gap-4 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between ${
          data.isMaintenanceMode
            ? "border-rose-200 bg-rose-50"
            : "border-slate-200 bg-slate-50"
        }`}
      >
        <div className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className={`size-2.5 shrink-0 rounded-full ${
              data.isMaintenanceMode ? "bg-rose-500" : "bg-slate-400"
            }`}
          />
          <p className="text-sm font-semibold text-slate-900">
            {data.isMaintenanceMode
              ? "Mode maintenance aktif — pengunjung publik dialihkan."
              : "Situs publik aktif normal."}
          </p>
        </div>

        <Button
          type="button"
          size="lg"
          disabled={saving || loading}
          onClick={() => handleToggleClick(!data.isMaintenanceMode)}
          className={`shrink-0 font-semibold ${
            data.isMaintenanceMode ? "" : "bg-rose-600 text-white hover:bg-rose-500"
          }`}
        >
          {data.isMaintenanceMode ? (
            <>
              <ShieldCheck className="h-4 w-4" />
              Matikan Maintenance
            </>
          ) : (
            <>
              <Wrench className="h-4 w-4" />
              Aktifkan Mode Maintenance
            </>
          )}
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Pesan Pemeliharaan Publik</CardTitle>
              <CardDescription>Tampil di halaman pemeliharaan saat mode aktif.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="maintenance-message">Isi Pesan</Label>
                  <button
                    type="button"
                    onClick={() => setData({ ...data, maintenanceMessage: DEFAULT_MESSAGE })}
                    className="text-xs font-medium text-[#D81435] hover:underline focus-visible:outline-2 focus-visible:outline-[#D81435]"
                  >
                    Gunakan Pesan Standar
                  </button>
                </div>
                <Textarea
                  id="maintenance-message"
                  value={data.maintenanceMessage}
                  onChange={(e) => setData({ ...data, maintenanceMessage: e.target.value })}
                  placeholder="Ketik pesan pemeliharaan untuk pengunjung…"
                  rows={4}
                />
                <div className="flex justify-between text-xs text-slate-500">
                  <span>Maksimal 300 karakter</span>
                  <span>{data.maintenanceMessage.length} karakter</span>
                </div>
              </div>

              {hasUnsavedMessage && (
                <div className="flex items-center justify-end gap-2 border-t border-slate-200 pt-4">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setData({
                        ...data,
                        maintenanceMessage: initialData?.maintenanceMessage || DEFAULT_MESSAGE,
                      })
                    }
                  >
                    Batal
                  </Button>
                  <Button size="sm" disabled={saving} onClick={() => executeSave()}>
                    <Save className="h-3.5 w-3.5" />
                    {saving ? "Menyimpan…" : "Simpan Pesan"}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Aturan & Hak Akses</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-600">
              <div className="flex items-start gap-2.5 rounded-lg border border-slate-200 bg-slate-50 p-3">
                <Lock className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                <div>
                  <span className="font-semibold text-slate-900">Akses CMS & Editor</span>
                  <p className="mt-0.5">ADMIN dan EDITOR tetap masuk CMS selama maintenance.</p>
                </div>
              </div>

              <div className="flex items-start gap-2.5 rounded-lg border border-slate-200 bg-slate-50 p-3">
                <Eye className="mt-0.5 h-4 w-4 shrink-0 text-sky-600" />
                <div>
                  <span className="font-semibold text-slate-900">Live Preview Admin</span>
                  <p className="mt-0.5">Admin login tetap bisa membuka tur 3D untuk cek kualitas.</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Informasi Log</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="space-y-1">
                <span className="text-xs text-slate-500">Terakhir Diperbarui Oleh:</span>
                <div className="flex items-center gap-1.5 font-medium text-slate-900">
                  <User className="h-3.5 w-3.5 text-slate-500" />
                  <span className="truncate">{data.updatedBy || "Sistem"}</span>
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-xs text-slate-500">Waktu Pembaruan:</span>
                <div className="flex items-center gap-1.5 font-medium text-slate-900">
                  <Clock className="h-3.5 w-3.5 text-slate-500" />
                  <span>
                    {data.updatedAt
                      ? new Date(data.updatedAt).toLocaleString("id-ID", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })
                      : "—"}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog
        open={showConfirmModal && pendingMode !== null}
        onOpenChange={(open) => {
          if (!open) {
            setShowConfirmModal(false);
            setPendingMode(null);
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {pendingMode
                ? "Konfirmasi Aktifkan Mode Maintenance?"
                : "Buka Kembali Situs untuk Publik?"}
            </DialogTitle>
            <DialogDescription>
              {pendingMode
                ? "Seluruh pengunjung umum akan dialihkan ke halaman pemeliharaan sistem. Anda dan tim admin tetap dapat mengakses CMS."
                : "Situs publik akan langsung dapat diakses kembali oleh seluruh pengunjung secara normal."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="ghost"
              disabled={saving}
              onClick={() => {
                setShowConfirmModal(false);
                setPendingMode(null);
              }}
            >
              Batal
            </Button>
            <Button
              disabled={saving}
              onClick={() => void executeSave(pendingMode ?? undefined)}
              className={pendingMode ? "bg-rose-600 text-white hover:bg-rose-500" : ""}
            >
              {saving
                ? "Memproses…"
                : pendingMode
                  ? "Ya, Aktifkan Maintenance"
                  : "Ya, Buka Situs Publik"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
