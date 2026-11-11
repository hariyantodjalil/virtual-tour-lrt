"use client";

import { Label } from "@/components/ui/label";
import { PIN_VOLUME_DISTANCE_MAX_M, PIN_VOLUME_DISTANCE_MIN_M } from "@/lib/spatial/unit-volume";

type Field = "volumeRotation" | "volumeDistance";

type Props = {
  rotation?: number;
  distance?: number;
  /** Jarak awal saat admin mematikan "Otomatis" (meter). */
  defaultDistance: number;
  /** Penjelasan cara jarak otomatis dihitung untuk konteks editor ini. */
  autoHint: string;
  onChange: (field: Field, value: number | undefined) => void;
};

function formatNumber(value: number, digits = 1) {
  return value.toLocaleString("id-ID", { maximumFractionDigits: digits });
}

/**
 * Pengaturan volume 3D pin unit: arah hadap dan jarak dari kamera, agar admin bisa menyamakan
 * kotak dengan unit di foto. Posisi kotak tetap digeser lewat titik pegangan "i" di panorama.
 */
export default function VolumeAdjustControls({ rotation, distance, defaultDistance, autoHint, onChange }: Props) {
  const rotationValue = rotation ?? 0;
  const auto = distance == null;
  const rotateBy = (delta: number) => {
    let next = rotationValue + delta;
    if (next > 180) next -= 360;
    if (next < -180) next += 360;
    onChange("volumeRotation", Math.round(next));
  };

  return (
    <div className="space-y-3 rounded-lg border border-[rgba(255,214,218,0.14)] bg-[#1C0A0E]/60 p-3">
      <div>
        <p className="text-xs font-semibold text-[#F8ECEE]">Volume 3D</p>
        <p className="mt-0.5 text-[10px] leading-relaxed text-[#A88990]">
          Seret titik ⓘ di panorama untuk menggeser, lalu atur arah dan jarak sampai pas dengan unit di foto.
        </p>
      </div>

      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <Label className="text-xs text-[#C4A8AD]">Arah hadap</Label>
          <span className="font-mono text-xs text-[#F8ECEE]">{formatNumber(rotationValue, 0)}°</span>
        </div>
        <input
          type="range"
          min={-180}
          max={180}
          step={1}
          value={rotationValue}
          onChange={(event) => onChange("volumeRotation", Number(event.target.value))}
          className="w-full accent-[#E31E2D]"
          aria-label="Arah hadap volume"
        />
        <div className="mt-1.5 flex items-center gap-1.5">
          {[-15, 15].map((delta) => (
            <button
              key={delta}
              type="button"
              onClick={() => rotateBy(delta)}
              className="rounded-md border border-[rgba(255,214,218,0.14)] px-2 py-1 text-[10px] text-[#F8ECEE] hover:bg-[#3A161C]"
            >
              {delta > 0 ? `Putar +${delta}°` : `Putar ${delta}°`}
            </button>
          ))}
          <button
            type="button"
            onClick={() => onChange("volumeRotation", undefined)}
            className="ml-auto text-[10px] text-[#A88990] hover:text-[#F8ECEE]"
          >
            Hadap kamera
          </button>
        </div>
      </div>

      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <Label className="text-xs text-[#C4A8AD]">Jarak dari kamera</Label>
          <label className="flex items-center gap-1.5 text-[10px] text-[#C4A8AD]">
            <input
              type="checkbox"
              checked={auto}
              onChange={(event) =>
                onChange("volumeDistance", event.target.checked ? undefined : defaultDistance)
              }
            />
            Otomatis
          </label>
        </div>
        {auto ? (
          <p className="text-[10px] leading-relaxed text-[#A88990]">{autoHint}</p>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min={PIN_VOLUME_DISTANCE_MIN_M}
                max={PIN_VOLUME_DISTANCE_MAX_M}
                step={0.1}
                value={distance}
                onChange={(event) => onChange("volumeDistance", Number(event.target.value))}
                className="w-full accent-[#E31E2D]"
                aria-label="Jarak volume dari kamera"
              />
              <span className="w-14 shrink-0 text-right font-mono text-xs text-[#F8ECEE]">
                {formatNumber(distance ?? defaultDistance)} m
              </span>
            </div>
            <p className="mt-1 text-[10px] leading-relaxed text-[#A88990]">
              Makin jauh, kotak tampak makin kecil di foto (ukuran unit tetap).
            </p>
          </>
        )}
      </div>
    </div>
  );
}
