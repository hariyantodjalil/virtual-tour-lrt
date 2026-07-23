import type { Metadata } from "next";
import { Chakra_Petch, Source_Sans_3 } from "next/font/google";
import "./globals.css";

const display = Chakra_Petch({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-chakra",
});

const body = Source_Sans_3({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-source",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
  title: "Virtual Tour LRT Jabodebek - Ruang Komersial",
  description:
    "Eksplorasi ruang komersial 18 stasiun LRT Jabodebek secara virtual 360°. Lihat ketersediaan real-time, spesifikasi lengkap, dan ajukan minat sewa online.",
  keywords: "LRT Jabodebek, virtual tour, ruang komersial, sewa kios stasiun",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" className={`${display.variable} ${body.variable} h-full scroll-smooth antialiased`}>
      <body className="min-h-full flex flex-col font-body">{children}</body>
    </html>
  );
}
