import { ImageResponse } from "next/og";

export const alt = "Virtual Tour LRT Jabodebek - Ruang Komersial";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: 72,
          background: "linear-gradient(135deg, #1B3A6B 0%, #0f2444 55%, #07111f 100%)",
          color: "white",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            fontSize: 28,
            color: "rgba(255,255,255,0.75)",
            marginBottom: 28,
          }}
        >
          <div
            style={{
              display: "flex",
              width: 14,
              height: 14,
              borderRadius: 999,
              background: "#34d399",
            }}
          />
          <div style={{ display: "flex" }}>Virtual Tour 360° · LRT Jabodebek</div>
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            fontSize: 64,
            fontWeight: 900,
            lineHeight: 1.1,
            maxWidth: 980,
          }}
        >
          <div style={{ display: "flex" }}>Jelajahi Peluang Komersial</div>
          <div style={{ display: "flex", color: "#E31E2D" }}>LRT Jabodebek</div>
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 24,
            fontSize: 28,
            color: "rgba(255,255,255,0.7)",
            maxWidth: 900,
            lineHeight: 1.35,
          }}
        >
          Eksplorasi ruang komersial stasiun secara virtual — ketersediaan real-time, 24/7.
        </div>
      </div>
    ),
    { ...size }
  );
}
