import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
  title: "Virtual Tour LRT Jabodebek - Ruang Komersial",
  description: "Eksplorasi ruang komersial 18 stasiun LRT Jabodebek secara virtual 360°. Lihat ketersediaan real-time, spesifikasi lengkap, dan ajukan minat sewa online.",
  keywords: "LRT Jabodebek, virtual tour, ruang komersial, sewa kios stasiun",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
