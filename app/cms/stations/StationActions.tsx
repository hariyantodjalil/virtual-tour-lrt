"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Power, PowerOff, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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
    const confirmed = window.confirm(
      `Hapus stasiun "${station.name}" secara permanen?\n\nSemua unit, tenant, dan data virtual tour di stasiun ini juga akan dihapus.`
    );
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
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={busyAction !== null}
          onClick={toggleStatus}
          className={
            station.isActive
              ? "border-amber-700 text-amber-700 hover:bg-amber-50"
              : "border-emerald-200 text-emerald-700 hover:bg-emerald-50"
          }
        >
          {station.isActive ? (
            <PowerOff className="h-3.5 w-3.5" />
          ) : (
            <Power className="h-3.5 w-3.5" />
          )}
          {busyAction === "status"
            ? "Memproses..."
            : station.isActive
              ? "Nonaktifkan"
              : "Aktifkan"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={busyAction !== null}
          onClick={deleteStation}
          className="border-red-200 text-red-600 hover:bg-red-50"
        >
          <Trash2 className="h-3.5 w-3.5" />
          {busyAction === "delete" ? "Menghapus..." : "Hapus"}
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
