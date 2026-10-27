import type { Metadata } from "next";
import localFont from "next/font/local";
import PublicContactFab from "@/components/PublicContactFab";
import { CommercialProfileProvider } from "@/components/commercial/CommercialProfileProvider";
import "./globals.css";

const poppins = localFont({
  src: [
    { path: "./fonts/poppins-400.woff2", weight: "400", style: "normal" },
    { path: "./fonts/poppins-500.woff2", weight: "500", style: "normal" },
    { path: "./fonts/poppins-600.woff2", weight: "600", style: "normal" },
    { path: "./fonts/poppins-700.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-poppins",
  display: "swap",
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
    <html lang="id" className={`${poppins.variable} h-full scroll-smooth antialiased`}>
      <body className="flex min-h-full flex-col font-body">
        <CommercialProfileProvider>
          {children}
          <PublicContactFab />
        </CommercialProfileProvider>
      </body>
    </html>
  );
}
