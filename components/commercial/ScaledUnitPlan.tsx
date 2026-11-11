"use client";

import { useState } from "react";
import { formatArea, formatDimensions, formatVolume } from "@/lib/unit-dimensions";

type Tone = "dark" | "light";

type Props = {
  lengthM?: number | null;
  widthM?: number | null;
  heightM?: number | null;
  /** Untuk zona induk: luas yang sudah dibagi ke unit lain. */
  allocatedArea?: number | null;
  /** dark = CMS & panel tour gelap, light = popup unit publik berlatar putih. */
  tone?: Tone;
  /** Gambar produk/brand yang ditempel di muka depan volume 3D (hanya di browser, tidak diunggah). */
  frontImageUrl?: string | null;
  /** "handgrip" = media digantung pada tali dan rel pegangan di kabin kereta. */
  context?: "handgrip";
};

type View = "3d" | "2d";

const VIEW_W = 360;
const VIEW_H = 230;
const PAD = 34;
/** Tampak atas orang dewasa ≈ diameter bahu 0,5 m — pembanding skala denah. */
const PERSON_M = 0.5;
/** Tinggi orang dewasa — pembanding skala volume. */
const PERSON_HEIGHT_M = 1.7;
/** Benda lebih kecil dari ini memakai pembanding tangan agar tidak tampak seperti titik di samping orang. */
const SMALL_OBJECT_M = 0.6;
/** Panjang telapak + jari tangan dewasa. */
const HAND_LENGTH_M = 0.18;
/** Jarak rel pegangan ke atas media handgrip (panjang tali). */
const HANDGRIP_STRAP_M = 0.22;
const COS30 = Math.cos(Math.PI / 6);
const SIN30 = 0.5;

const THEMES = {
  dark: {
    frame: "border-[rgba(255,214,218,0.14)] bg-[#261015]",
    empty: "border-[rgba(255,214,218,0.2)] text-[#A88990]",
    tabs: "border-[rgba(255,214,218,0.14)]",
    tabIdle: "text-[#C4A8AD] hover:text-white",
    caption: "text-[#C4A8AD]",
    captionMuted: "text-[#A88990]",
    edge: "#F8ECEE",
    label: "#F8ECEE",
    measure: "#C4A8AD",
    grid: "rgba(255,214,218,0.16)",
    hidden: "rgba(248,236,238,0.35)",
    shadow: "rgba(0,0,0,0.35)",
  },
  light: {
    frame: "border-slate-200 bg-slate-50",
    empty: "border-slate-300 text-slate-500",
    tabs: "border-slate-200 bg-white",
    tabIdle: "text-slate-600 hover:text-slate-900",
    caption: "text-slate-600",
    captionMuted: "text-slate-500",
    edge: "#475569",
    label: "#0B1220",
    measure: "#64748B",
    grid: "rgba(15,23,42,0.12)",
    hidden: "rgba(15,23,42,0.35)",
    shadow: "rgba(15,23,42,0.18)",
  },
} as const;

type Theme = (typeof THEMES)[Tone];

function formatMeter(value: number) {
  return value.toLocaleString("id-ID", { maximumFractionDigits: 2 });
}

function gridStepFor(lengthM: number, widthM: number) {
  const max = Math.max(lengthM, widthM);
  return max > 25 ? 5 : max < 1.2 ? 0.1 : 1;
}

/** Posisi garis grid di dalam rentang (0, span), tanpa galat penjumlahan desimal. */
function gridMarks(span: number, step: number) {
  const marks: number[] = [];
  for (let i = 1; i * step < span - 1e-9; i++) marks.push(Math.round(i * step * 1000) / 1000);
  return marks;
}

/**
 * Pratinjau ukuran unit yang digambar otomatis dari panjang × lebar × tinggi:
 * volume isometrik dan denah tampak atas, keduanya dengan pembanding orang. Ilustrasi, bukan gambar teknis.
 */
export default function ScaledUnitPlan({
  lengthM,
  widthM,
  heightM,
  allocatedArea,
  tone = "dark",
  frontImageUrl,
  context,
}: Props) {
  const [view, setView] = useState<View>("3d");
  const t = THEMES[tone];

  if (!lengthM || !widthM || lengthM <= 0 || widthM <= 0) {
    return (
      <div className={`flex h-[180px] items-center justify-center rounded-xl border border-dashed text-center text-xs ${t.empty}`}>
        Isi panjang dan lebar untuk melihat pratinjau ukuran.
      </div>
    );
  }

  const area = lengthM * widthM;
  const hasHeight = !!heightM && heightM > 0;

  return (
    <figure className={`rounded-xl border p-3 ${t.frame}`}>
      <div className={`mb-2 inline-flex rounded-lg border p-0.5 text-xs ${t.tabs}`}>
        {(
          [
            ["3d", "Volume 3D"],
            ["2d", "Denah 2D"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setView(value)}
            aria-pressed={view === value}
            className={`rounded-md px-3 py-1 font-semibold transition ${
              view === value ? "bg-[#E31E2D] text-white" : t.tabIdle
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {view === "3d" ? (
        hasHeight ? (
          <Volume3D
            lengthM={lengthM}
            widthM={widthM}
            heightM={heightM}
            t={t}
            frontImageUrl={frontImageUrl}
            context={context}
          />
        ) : (
          <div className={`flex h-[200px] items-center justify-center rounded-lg border border-dashed text-center text-xs ${t.empty}`}>
            Tinggi belum diisi, volume 3D belum bisa ditampilkan.
          </div>
        )
      ) : (
        <Plan2D lengthM={lengthM} widthM={widthM} heightM={heightM} allocatedArea={allocatedArea} t={t} />
      )}

      <figcaption className={`mt-2 flex flex-wrap items-center justify-between gap-2 text-xs ${t.caption}`}>
        <span>
          {formatArea(area)}
          {hasHeight ? ` · tinggi ${formatMeter(heightM)} m · volume ${formatVolume(area * heightM)}` : ""}
          {allocatedArea && allocatedArea > 0
            ? ` · terbagi ${formatArea(allocatedArea)}, sisa ${formatArea(Math.max(area - allocatedArea, 0))}`
            : ""}
        </span>
        <span className={t.captionMuted}>
          Grid {formatMeter(gridStepFor(lengthM, widthM))} m · ilustrasi, bukan gambar teknis
        </span>
      </figcaption>
    </figure>
  );
}

// ─── Volume isometrik ─────────────────────────────────────────────────────────

function Volume3D({
  lengthM,
  widthM,
  heightM,
  t,
  frontImageUrl,
  context,
}: {
  lengthM: number;
  widthM: number;
  heightM: number;
  t: Theme;
  frontImageUrl?: string | null;
  context?: "handgrip";
}) {
  // Sumbu x = panjang, y = lebar, z = tinggi; sudut pandang dari pojok depan (L, W).
  const iso = (x: number, y: number, z: number): [number, number] => [(x - y) * COS30, (x + y) * SIN30 - z];

  // Benda kecil (mis. handgrip) dibandingkan dengan tangan; benda besar dengan orang berdiri.
  const small = Math.max(lengthM, widthM, heightM) < SMALL_OBJECT_M;
  const refHeight = small ? HAND_LENGTH_M : PERSON_HEIGHT_M;
  // Pembanding berdiri di kanan-belakang unit agar tidak menutupi label lebar di rusuk depan.
  const personX = lengthM + Math.max(small ? 0.08 : 1, lengthM * 0.15);
  const personY = 0;
  const handgrip = context === "handgrip";
  const railZ = heightM + HANDGRIP_STRAP_M;
  const extents = [
    iso(0, 0, 0), iso(lengthM, 0, 0), iso(0, widthM, 0), iso(lengthM, widthM, 0),
    iso(0, 0, heightM), iso(lengthM, 0, heightM), iso(0, widthM, heightM), iso(lengthM, widthM, heightM),
    iso(personX, personY, 0), iso(personX, personY, refHeight * 1.25),
    ...(handgrip
      ? [iso(-0.12, widthM / 2, railZ + 0.04), iso(lengthM + 0.12, widthM / 2, railZ + 0.04)]
      : []),
  ];
  const xs = extents.map(([x]) => x);
  const ys = extents.map(([, y]) => y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const spanX = Math.max(...xs) - minX || 1;
  const spanY = Math.max(...ys) - minY || 1;
  const scale = Math.min((VIEW_W - PAD * 2) / spanX, (VIEW_H - PAD * 2) / spanY);
  const offsetX = (VIEW_W - spanX * scale) / 2 - minX * scale;
  const offsetY = (VIEW_H - spanY * scale) / 2 - minY * scale;
  const P = (x: number, y: number, z: number) => {
    const [px, py] = iso(x, y, z);
    return { x: px * scale + offsetX, y: py * scale + offsetY };
  };
  const poly = (points: { x: number; y: number }[]) => points.map((p) => `${p.x},${p.y}`).join(" ");

  const L = lengthM;
  const W = widthM;
  const H = heightM;
  const step = gridStepFor(L, W);

  const floorGrid: React.ReactNode[] = [];
  const topGrid: React.ReactNode[] = [];
  for (const m of gridMarks(L, step)) {
    const a = P(m, 0, 0), b = P(m, W, 0), c = P(m, 0, H), d = P(m, W, H);
    floorGrid.push(<line key={`fx${m}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} />);
    topGrid.push(<line key={`tx${m}`} x1={c.x} y1={c.y} x2={d.x} y2={d.y} />);
  }
  for (const m of gridMarks(W, step)) {
    const a = P(0, m, 0), b = P(L, m, 0), c = P(0, m, H), d = P(L, m, H);
    floorGrid.push(<line key={`fy${m}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} />);
    topGrid.push(<line key={`ty${m}`} x1={c.x} y1={c.y} x2={d.x} y2={d.y} />);
  }

  const back = P(0, 0, 0);
  const lengthMid = P(L / 2, W, 0);
  const widthMid = P(L, W / 2, 0);
  const heightMid = P(0, W, H / 2);

  const personBase = P(personX, personY, 0);
  const personTop = P(personX, personY, refHeight);
  const personPx = personBase.y - personTop.y;
  const headR = Math.max(personPx * 0.075, 1.5);
  const bodyW = Math.max(personPx * 0.24, 2);

  // Gambar produk menempel di muka depan-kiri (sisi panjang): petakan persegi 1×1 ke jajaran genjang muka itu.
  const faceTL = P(0, W, H), faceTR = P(L, W, H), faceBL = P(0, W, 0);
  const frontMatrix = [
    faceTR.x - faceTL.x, faceTR.y - faceTL.y,
    faceBL.x - faceTL.x, faceBL.y - faceTL.y,
    faceTL.x, faceTL.y,
  ].map((n) => n.toFixed(3)).join(" ");

  const railFrom = P(-0.12, W / 2, railZ);
  const railTo = P(L + 0.12, W / 2, railZ);
  const strapTop = P(L / 2, W / 2, railZ);
  const strapBottom = P(L / 2, W / 2, H);

  return (
    <svg
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      className="h-auto w-full"
      role="img"
      aria-label={`Volume ${formatDimensions({ lengthM, widthM, heightM })}`}
    >
      {/* Lantai dan grid lantai (terlihat menembus dinding transparan) */}
      <polygon points={poly([P(0, 0, 0), P(L, 0, 0), P(L, W, 0), P(0, W, 0)])} fill="rgba(227,30,45,0.10)" />
      <g stroke={t.grid} strokeWidth="1">{floorGrid}</g>

      {/* Rusuk tersembunyi di pojok belakang */}
      <g stroke={t.hidden} strokeWidth="1" strokeDasharray="3 3">
        <line x1={back.x} y1={back.y} x2={P(L, 0, 0).x} y2={P(L, 0, 0).y} />
        <line x1={back.x} y1={back.y} x2={P(0, W, 0).x} y2={P(0, W, 0).y} />
        <line x1={back.x} y1={back.y} x2={P(0, 0, H).x} y2={P(0, 0, H).y} />
      </g>

      {/* Dinding depan-kiri (sisi panjang), depan-kanan (sisi lebar), dan atap */}
      {handgrip ? (
        <g aria-hidden="true">
          {/* Rel pegangan di langit-langit kabin dan tali tempat media digantung */}
          <line x1={railFrom.x} y1={railFrom.y} x2={railTo.x} y2={railTo.y} stroke={t.measure} strokeWidth="4" strokeLinecap="round" />
          <line x1={strapTop.x} y1={strapTop.y} x2={strapBottom.x} y2={strapBottom.y} stroke={t.edge} strokeWidth="3" strokeLinecap="round" />
          <text x={railTo.x + 6} y={railTo.y + 3} fontSize="9" fill={t.label}>rel pegangan</text>
        </g>
      ) : null}
      <polygon points={poly([P(0, W, 0), P(L, W, 0), P(L, W, H), P(0, W, H)])} fill="rgba(227,30,45,0.20)" stroke={t.edge} strokeWidth="1.2" />
      {frontImageUrl ? (
        <image
          href={frontImageUrl}
          x="0"
          y="0"
          width="1"
          height="1"
          preserveAspectRatio="xMidYMid slice"
          transform={`matrix(${frontMatrix})`}
          opacity="0.95"
        />
      ) : null}
      <polygon points={poly([P(L, 0, 0), P(L, W, 0), P(L, W, H), P(L, 0, H)])} fill="rgba(227,30,45,0.30)" stroke={t.edge} strokeWidth="1.2" />
      <polygon points={poly([P(0, 0, H), P(L, 0, H), P(L, W, H), P(0, W, H)])} fill="rgba(255,107,74,0.16)" stroke={t.edge} strokeWidth="1.2" />
      <g stroke={t.grid} strokeWidth="1">{topGrid}</g>

      {/* Label ukuran */}
      <text x={lengthMid.x - 8} y={lengthMid.y + 16} textAnchor="end" fontSize="11" fill={t.label}>
        P {formatMeter(L)} m
      </text>
      <text x={widthMid.x + 8} y={widthMid.y + 16} textAnchor="start" fontSize="11" fill={t.label}>
        L {formatMeter(W)} m
      </text>
      <text x={heightMid.x - 8} y={heightMid.y + 4} textAnchor="end" fontSize="11" fill={t.label}>
        T {formatMeter(H)} m
      </text>

      {/* Pembanding: orang berdiri ±1,7 m, atau tangan ±18 cm untuk benda kecil */}
      <g>
        {small ? (
          // Tangan tegak: telapak (±55% panjang) dan empat jari, lebar ±9 cm.
          <g fill="#FF6B4A" fillOpacity="0.9">
            <rect
              x={personBase.x - personPx * 0.25}
              y={personBase.y - personPx * 0.55}
              width={personPx * 0.5}
              height={personPx * 0.55}
              rx={personPx * 0.12}
            />
            {[0, 1, 2, 3].map((i) => (
              <rect
                key={i}
                x={personBase.x - personPx * 0.25 + i * personPx * 0.125 + personPx * 0.012}
                y={personTop.y + (i === 0 || i === 3 ? personPx * 0.08 : 0)}
                width={personPx * 0.1}
                height={personPx * (i === 0 || i === 3 ? 0.42 : 0.5)}
                rx={personPx * 0.05}
              />
            ))}
          </g>
        ) : (
          <>
            <ellipse cx={personBase.x} cy={personBase.y} rx={bodyW * 0.9} ry={bodyW * 0.3} fill={t.shadow} />
            <rect
              x={personBase.x - bodyW / 2}
              y={personTop.y + headR * 2.2}
              width={bodyW}
              height={personBase.y - personTop.y - headR * 2.2}
              rx={bodyW / 2}
              fill="#FF6B4A"
              fillOpacity="0.9"
            />
            <circle cx={personBase.x} cy={personTop.y + headR} r={headR} fill="#FF6B4A" fillOpacity="0.9" />
          </>
        )}
        <text x={personBase.x} y={personTop.y - 5} textAnchor="middle" fontSize="9" fill={t.label}>
          {small ? "tangan ±18 cm" : "orang ±1,7 m"}
        </text>
      </g>
    </svg>
  );
}

// ─── Denah tampak atas ────────────────────────────────────────────────────────

function Plan2D({
  lengthM,
  widthM,
  heightM,
  allocatedArea,
  t,
}: {
  lengthM: number;
  widthM: number;
  heightM?: number | null;
  allocatedArea?: number | null;
  t: Theme;
}) {
  const scale = Math.min((VIEW_W - PAD * 2) / lengthM, (VIEW_H - PAD * 2) / widthM);
  const rectW = lengthM * scale;
  const rectH = widthM * scale;
  const x0 = (VIEW_W - rectW) / 2;
  const y0 = (VIEW_H - rectH) / 2;
  const gridStep = gridStepFor(lengthM, widthM);

  const gridLines: React.ReactNode[] = [];
  for (const m of gridMarks(lengthM, gridStep)) {
    const x = x0 + m * scale;
    gridLines.push(<line key={`v${m}`} x1={x} y1={y0} x2={x} y2={y0 + rectH} />);
  }
  for (const m of gridMarks(widthM, gridStep)) {
    const y = y0 + m * scale;
    gridLines.push(<line key={`h${m}`} x1={x0} y1={y} x2={x0 + rectW} y2={y} />);
  }

  const area = lengthM * widthM;
  const allocatedRatio = allocatedArea && allocatedArea > 0 ? Math.min(allocatedArea / area, 1) : 0;
  const personR = (PERSON_M * scale) / 2;
  const personFits = PERSON_M * 2 < Math.min(lengthM, widthM);

  return (
    <svg
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      className="h-auto w-full"
      role="img"
      aria-label={`Denah berskala ${formatDimensions({ lengthM, widthM, heightM })}`}
    >
      <defs>
        <pattern id="unit-plan-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="6" stroke="#E31E2D" strokeWidth="2" strokeOpacity="0.55" />
        </pattern>
      </defs>

      <rect x={x0} y={y0} width={rectW} height={rectH} fill="rgba(227,30,45,0.14)" />
      {allocatedRatio > 0 ? (
        <rect x={x0} y={y0} width={rectW * allocatedRatio} height={rectH} fill="url(#unit-plan-hatch)" />
      ) : null}
      <g stroke={t.grid} strokeWidth="1">{gridLines}</g>
      <rect x={x0} y={y0} width={rectW} height={rectH} fill="none" stroke={t.edge} strokeWidth="1.5" />

      {/* Garis ukur panjang (atas) dan lebar (kiri) */}
      <g stroke={t.measure} strokeWidth="1">
        <line x1={x0} y1={y0 - 12} x2={x0 + rectW} y2={y0 - 12} />
        <line x1={x0} y1={y0 - 16} x2={x0} y2={y0 - 8} />
        <line x1={x0 + rectW} y1={y0 - 16} x2={x0 + rectW} y2={y0 - 8} />
        <line x1={x0 - 12} y1={y0} x2={x0 - 12} y2={y0 + rectH} />
        <line x1={x0 - 16} y1={y0} x2={x0 - 8} y2={y0} />
        <line x1={x0 - 16} y1={y0 + rectH} x2={x0 - 8} y2={y0 + rectH} />
      </g>
      <text x={x0 + rectW / 2} y={y0 - 17} textAnchor="middle" fontSize="11" fill={t.label}>
        {formatMeter(lengthM)} m
      </text>
      <text
        x={x0 - 17}
        y={y0 + rectH / 2}
        textAnchor="middle"
        fontSize="11"
        fill={t.label}
        transform={`rotate(-90 ${x0 - 17} ${y0 + rectH / 2})`}
      >
        {formatMeter(widthM)} m
      </text>

      {personFits ? (
        <g>
          <circle
            cx={x0 + rectW - personR - 6}
            cy={y0 + rectH - personR - 6}
            r={personR}
            fill="#FF6B4A"
            fillOpacity="0.85"
          />
          <text
            x={x0 + rectW - personR * 2 - 10}
            y={y0 + rectH - personR - 2}
            textAnchor="end"
            fontSize="9"
            fill={t.label}
          >
            orang ±0,5 m
          </text>
        </g>
      ) : null}
    </svg>
  );
}
