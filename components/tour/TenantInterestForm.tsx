"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CheckCircle, Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

const schema = z.object({
  companyName: z.string().min(2, "Nama perusahaan minimal 2 karakter"),
  contactName: z.string().min(2, "Nama kontak minimal 2 karakter"),
  phone: z.string().min(10, "Nomor telepon tidak valid").regex(/^\+?[\d\s-]+$/, "Format nomor tidak valid"),
  email: z.string().email("Format email tidak valid"),
  password: z.string().min(8, "Password minimal 8 karakter"),
  businessType: z.string().min(3, "Jenis usaha wajib diisi"),
  message: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

type Props = {
  spaceId: string;
  spaceCode: string;
  stationName: string;
  onSuccess?: () => void;
};

export default function TenantInterestForm({ spaceId, spaceCode, stationName, onSuccess }: Props) {
  const [submitted, setSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormValues) => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, spaceId }),
      });

      if (res.ok) {
        setSubmitted(true);
        onSuccess?.();
      } else {
        const error = await res.json().catch(() => null);
        alert(error?.error ?? "Gagal mengirim formulir. Coba lagi.");
      }
    } catch {
      alert("Gagal mengirim formulir. Coba lagi.");
    } finally {
      setIsLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="flex flex-col items-center gap-3 py-6 text-center">
        <CheckCircle className="h-10 w-10 text-emerald-500" />
        <div>
          <p className="font-bold text-gray-900">Minat Anda Tercatat!</p>
          <p className="mt-1 text-sm text-gray-500">
            Akun mitra sudah disiapkan dari email Anda untuk memantau status unit {spaceCode} di Stasiun {stationName}.
          </p>
        </div>
        <Button asChild className="mt-2">
          <Link href="/partner">Buka Panel Mitra</Link>
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 border-t border-gray-100 pt-6">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-gray-400">Formulir Minat Sewa</p>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="companyName" className="text-sm font-semibold text-gray-800">Nama Perusahaan *</Label>
          <Input id="companyName" placeholder="PT Contoh" className="h-12 text-base" {...register("companyName")} />
          {errors.companyName && <p className="text-xs text-red-500">{errors.companyName.message}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="contactName" className="text-sm font-semibold text-gray-800">Nama Kontak *</Label>
          <Input id="contactName" placeholder="Budi Santoso" className="h-12 text-base" {...register("contactName")} />
          {errors.contactName && <p className="text-xs text-red-500">{errors.contactName.message}</p>}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="phone" className="text-sm font-semibold text-gray-800">Telepon *</Label>
          <Input id="phone" type="tel" placeholder="08123456789" className="h-12 text-base" {...register("phone")} />
          {errors.phone && <p className="text-xs text-red-500">{errors.phone.message}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="email" className="text-sm font-semibold text-gray-800">Email *</Label>
          <Input id="email" type="email" placeholder="budi@perusahaan.com" className="h-12 text-base" {...register("email")} />
          {errors.email && <p className="text-xs text-red-500">{errors.email.message}</p>}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="password" className="text-sm font-semibold text-gray-800">Password Akun Mitra *</Label>
        <Input id="password" type="password" placeholder="Minimal 8 karakter" className="h-12 text-base" {...register("password")} />
        <p className="text-xs text-gray-500">Password ini dipakai untuk login dan memantau status pengajuan Anda.</p>
        {errors.password && <p className="text-xs text-red-500">{errors.password.message}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="businessType" className="text-sm font-semibold text-gray-800">Jenis Usaha *</Label>
        <Input id="businessType" placeholder="F&B, Retail, Perbankan, dll." className="h-12 text-base" {...register("businessType")} />
        {errors.businessType && <p className="text-xs text-red-500">{errors.businessType.message}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="message" className="text-sm font-semibold text-gray-800">Pesan Tambahan</Label>
        <Textarea id="message" placeholder="Kebutuhan khusus, pertanyaan, dll." className="min-h-28 resize-none text-base" {...register("message")} />
      </div>

      <Button type="submit" className="h-12 w-full text-base" disabled={isLoading}>
        {isLoading ? (
          <><Loader2 className="h-4 w-4 animate-spin" /> Mengirim...</>
        ) : (
          <><Send className="h-4 w-4" /> Kirim Minat Sewa</>
        )}
      </Button>
    </form>
  );
}
