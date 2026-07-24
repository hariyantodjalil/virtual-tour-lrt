import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import PublicContactFab from "@/components/PublicContactFab";
import "./globals.css";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-poppins",
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
        {children}
        <PublicContactFab />
      </body>
    </html>
  );
}
