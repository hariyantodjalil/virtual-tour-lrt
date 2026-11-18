"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Power, PowerOff, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useConfirmDialog } from "@/components/ui/confirm-dialog";
import { cmsFetch } from "@/lib/cms-fetch";

type Props = {
  station: {
    id: string;
    name: string;
    isActive: boolean;
  };
};

async function readError(response: Response, fallback: string) {
  const data = await response.json().catch(() => null);
  return typeof data?.error === "string" ? data.error : fallback;
}

export default function StationActions({ station }: Props) {
  const router = useRouter();
  const [busyAction, setBusyAction] = useState<"status" | "delete" | null>(null);
  const [error, setError] = useState("");
  const { confirmDialog, confirmElement } = useConfirmDialog();

  async function toggleStatus() {
    const nextActive = !station.isActive;
    setBusyAction("status");
    setError("");

    try {
      const response = await cmsFetch(`/api/cms/stations/${station.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: nextActive }),
      });

      if (!response.ok) {
        setError(await readError(response, "Gagal mengubah status stasiun."));
        return;
      }

      router.refresh();
    } catch {
      setError("Gagal terhubung ke server.");
    } finally {
      setBusyAction(null);
    }
  }

  async function deleteStation() {
    const confirmed = await confirmDialog({
      title: `Hapus stasiun "${station.name}" secara permanen?`,
      description: "Semua unit, tenant, dan data virtual tour di stasiun ini juga akan dihapus.",
      confirmLabel: "Ya, Hapus Stasiun",
      destructive: true,
    });
    if (!confirmed) return;

    setBusyAction("delete");
    setError("");

    try {
      const response = await cmsFetch(`/api/cms/stations/${station.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        setError(await readError(response, "Gagal menghapus stasiun."));
        return;
      }

      router.refresh();
    } catch {
      setError("Gagal terhubung ke server.");
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={busyAction !== null}
        onClick={toggleStatus}
        aria-label={station.isActive ? "Nonaktifkan stasiun" : "Aktifkan stasiun"}
        title={station.isActive ? "Nonaktifkan" : "Aktifkan"}
        className={
          station.isActive
            ? "border-amber-300 text-amber-800 hover:bg-amber-50"
            : "border-emerald-300 text-emerald-800 hover:bg-emerald-50"
        }
      >
        {station.isActive ? <PowerOff className="size-3.5" /> : <Power className="size-3.5" />}
        <span className="sr-only">
          {busyAction === "status" ? "Memproses" : station.isActive ? "Nonaktifkan" : "Aktifkan"}
        </span>
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={busyAction !== null}
        onClick={deleteStation}
        aria-label={busyAction === "delete" ? "Menghapus stasiun" : "Hapus stasiun"}
        title="Hapus"
        className="border-red-300 text-red-700 hover:bg-red-50"
      >
        <Trash2 className="size-3.5" />
      </Button>
      {error ? (
        <p role="alert" className="basis-full text-xs text-red-700">
          {error}
        </p>
      ) : null}
      {confirmElement}
    </>
  );
}
