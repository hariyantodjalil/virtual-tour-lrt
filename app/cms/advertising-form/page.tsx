"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Plus, RefreshCw, Save } from "lucide-react";
import { cmsFetch } from "@/lib/cms-fetch";
import {
  advertisingOptionsSchema,
  type AdvertisingFormOption,
} from "@/lib/advertising-form-shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

async function fetchOptions() {
  const response = await cmsFetch("/api/cms/advertising-form-options");
  if (!response.ok) throw new Error("Gagal memuat pilihan formulir.");
  return advertisingOptionsSchema.parse(await response.json());
}

const KIND_TITLES = [
  ["APPLICANT_STATUS", "Status pengaju"],
  ["BUSINESS_CATEGORY", "Kategori bisnis"],
] as const;

export default function AdvertisingFormSettings() {
  const [options, setOptions] = useState<AdvertisingFormOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState("");
  const [feedbackTone, setFeedbackTone] = useState<"ok" | "error">("ok");
  const [draft, setDraft] = useState<AdvertisingFormOption | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      setOptions(await fetchOptions());
      setFeedback("");
    } catch (error) {
      setFeedbackTone("error");
      setFeedback(error instanceof Error ? error.message : "Gagal memuat pilihan.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    fetchOptions()
      .then((data) => {
        if (active) setOptions(data);
      })
      .catch(() => {
        if (active) {
          setFeedbackTone("error");
          setFeedback("Gagal memuat pilihan formulir.");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  function add(kind: AdvertisingFormOption["kind"]) {
    const order =
      Math.max(0, ...options.filter((option) => option.kind === kind).map((option) => option.order)) +
      1;
    setDraft({
      id: "",
      kind,
      label: "",
      order,
      allowsRepresentedBrand: false,
      requiresDetail: false,
      isActive: true,
      updatedAt: "",
    });
    setFeedback("");
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!draft || saving) return;
    setSaving(true);
    setFeedback("");
    try {
      const { id, updatedAt, ...option } = draft;
      const response = await cmsFetch("/api/cms/advertising-form-options", {
        method: id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(id ? { id, updatedAt, option } : { option }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Pilihan gagal disimpan.");
      setDraft(null);
      await load();
      setFeedbackTone("ok");
      setFeedback("Pilihan disimpan.");
    } catch (error) {
      setFeedbackTone("error");
      setFeedback(error instanceof Error ? error.message : "Pilihan gagal disimpan.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={loading || saving}
          onClick={() => {
            setLoading(true);
            void load();
          }}
        >
          <RefreshCw
            className={`h-3.5 w-3.5 ${loading ? "animate-spin motion-reduce:animate-none" : ""}`}
          />
          Muat ulang
        </Button>
      </div>

      {feedback && (
        <p
          role="status"
          className={`rounded-lg border p-3 text-sm ${
            feedbackTone === "ok"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-red-200 bg-red-50 text-red-800"
          }`}
        >
          {feedback}
        </p>
      )}

      {loading ? (
        <p role="status" className="text-sm text-slate-500">
          Memuat pilihan…
        </p>
      ) : (
        KIND_TITLES.map(([kind, title]) => (
          <Card key={kind}>
            <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
              <CardTitle className="text-base">{title}</CardTitle>
              <Button type="button" size="sm" disabled={saving} onClick={() => add(kind)}>
                <Plus className="h-4 w-4" />
                Tambah
              </Button>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border border-slate-200">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>Nama</TableHead>
                      <TableHead className="w-24">Urutan</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="hidden md:table-cell">Opsi</TableHead>
                      <TableHead className="text-right">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {options
                      .filter((option) => option.kind === kind)
                      .map((option) => (
                        <TableRow key={option.id}>
                          <TableCell className="max-w-64 break-words font-medium">
                            {option.label}
                          </TableCell>
                          <TableCell className="text-sm text-slate-600">{option.order}</TableCell>
                          <TableCell>
                            {option.isActive ? (
                              <span className="sr-only">Aktif</span>
                            ) : (
                              <Badge variant="maintenance">Nonaktif</Badge>
                            )}
                          </TableCell>
                          <TableCell className="hidden text-xs text-slate-500 md:table-cell">
                            {[
                              option.allowsRepresentedBrand ? "Kolom brand" : null,
                              option.requiresDetail ? "Isian manual wajib" : null,
                            ]
                              .filter(Boolean)
                              .join(" · ") || "—"}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={saving}
                              onClick={() => {
                                setDraft({ ...option });
                                setFeedback("");
                              }}
                            >
                              Edit
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </div>
              {options.filter((option) => option.kind === kind).length === 0 && (
                <p className="mt-3 text-sm text-slate-500">Belum ada pilihan.</p>
              )}
            </CardContent>
          </Card>
        ))
      )}

      <Dialog open={Boolean(draft)} onOpenChange={(open) => !open && !saving && setDraft(null)}>
        <DialogContent>
          {draft && (
            <form onSubmit={save} className="space-y-4">
              <DialogHeader>
                <DialogTitle>
                  {draft.id ? "Edit" : "Tambah"}{" "}
                  {draft.kind === "APPLICANT_STATUS" ? "status pengaju" : "kategori bisnis"}
                </DialogTitle>
              </DialogHeader>
              <fieldset disabled={saving} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
                  <div className="space-y-2">
                    <Label htmlFor="option-label">Nama pilihan</Label>
                    <Input
                      id="option-label"
                      required
                      minLength={2}
                      maxLength={120}
                      value={draft.label}
                      onChange={(event) => setDraft({ ...draft, label: event.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="option-order">Urutan</Label>
                    <Input
                      id="option-order"
                      required
                      type="number"
                      min={0}
                      max={10000}
                      step={1}
                      value={draft.order}
                      onChange={(event) =>
                        setDraft({ ...draft, order: Number(event.target.value) })
                      }
                    />
                  </div>
                </div>
                <label className="flex min-h-11 items-center gap-3 text-sm">
                  <input
                    type="checkbox"
                    checked={draft.isActive}
                    onChange={(event) => setDraft({ ...draft, isActive: event.target.checked })}
                    className="size-4 accent-[#D81435]"
                  />
                  Tampilkan dalam form
                </label>
                {draft.kind === "APPLICANT_STATUS" ? (
                  <label className="flex min-h-11 items-center gap-3 text-sm">
                    <input
                      type="checkbox"
                      checked={draft.allowsRepresentedBrand}
                      onChange={(event) =>
                        setDraft({ ...draft, allowsRepresentedBrand: event.target.checked })
                      }
                      className="size-4 accent-[#D81435]"
                    />
                    Tampilkan nama brand yang diwakili (opsional)
                  </label>
                ) : (
                  <label className="flex min-h-11 items-center gap-3 text-sm">
                    <input
                      type="checkbox"
                      checked={draft.requiresDetail}
                      onChange={(event) =>
                        setDraft({ ...draft, requiresDetail: event.target.checked })
                      }
                      className="size-4 accent-[#D81435]"
                    />
                    Wajib isi kategori secara manual
                  </label>
                )}
              </fieldset>
              <DialogFooter>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={saving}
                  onClick={() => setDraft(null)}
                >
                  Batal
                </Button>
                <Button type="submit" disabled={saving}>
                  <Save className="h-4 w-4" />
                  {saving ? "Menyimpan…" : "Simpan pilihan"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
