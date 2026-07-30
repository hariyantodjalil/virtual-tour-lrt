"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Briefcase,
  Building2,
  CalendarDays,
  CheckCircle,
  Clock3,
  Loader2,
  Mail,
  MessageSquareText,
  Phone,
  Send,
  UserRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const guestSchema = z.object({
  companyName: z.string().min(2, "Nama perusahaan minimal 2 karakter"),
  contactName: z.string().min(2, "Nama kontak minimal 2 karakter"),
  phone: z.string().min(10, "Nomor telepon tidak valid").regex(/^\+?[\d\s-]+$/, "Format nomor tidak valid"),
  email: z.string().email("Format email tidak valid"),
  password: z.string().min(8, "Password minimal 8 karakter"),
  businessType: z.string().min(3, "Jenis usaha wajib diisi"),
  surveyPreference: z.string().optional(),
  message: z.string().optional(),
});

const partnerSchema = z.object({
  businessType: z.string().min(3, "Jenis usaha wajib diisi"),
  phone: z
    .string()
    .trim()
    .refine((value) => value === "" || (/^\+?[\d\s-]+$/.test(value) && value.replace(/\D/g, "").length >= 10), {
      message: "Nomor telepon tidak valid",
    })
    .optional(),
  companyName: z.string().optional(),
  surveyPreference: z.string().optional(),
  message: z.string().optional(),
});

type GuestFormValues = z.infer<typeof guestSchema>;
type PartnerFormValues = z.infer<typeof partnerSchema>;

type AuthUser = {
  id: string;
  email: string;
  name: string;
  role: string;
};

type Props = {
  spaceId: string;
  spaceCode: string;
  stationName: string;
  onSuccess?: () => void;
  variant?: "default" | "modal";
};

function FieldShell({
  icon,
  filled = false,
  children,
}: {
  icon: ReactNode;
  filled?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="relative">
      {!filled ? (
        <span className="pointer-events-none absolute top-1/2 left-3 z-10 -translate-y-1/2 text-slate-400">
          {icon}
        </span>
      ) : null}
      {children}
    </div>
  );
}

const inputClass =
  "h-11 rounded-xl border-slate-200 bg-white text-sm text-[#101828] shadow-none placeholder:text-slate-400 focus-visible:border-[#D81435] focus-visible:ring-2 focus-visible:ring-[#D81435]";

function fieldPad(filled: boolean) {
  return filled ? "pl-3.5" : "pl-10";
}

export default function TenantInterestForm({
  spaceId,
  spaceCode,
  stationName,
  onSuccess,
  variant = "default",
}: Props) {
  const [submitted, setSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [needsPhone, setNeedsPhone] = useState(false);
  const isModal = variant === "modal";

  useEffect(() => {
    let cancelled = false;
    async function checkAuth() {
      try {
        const res = await fetch("/api/auth/verify");
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && data.authenticated && data.user?.role === "MITRA") {
          setAuthUser(data.user);
        }
      } finally {
        if (!cancelled) setAuthChecked(true);
      }
    }
    void checkAuth();
    return () => {
      cancelled = true;
    };
  }, []);

  const isPartner = Boolean(authUser);

  const guestForm = useForm<GuestFormValues>({
    resolver: zodResolver(guestSchema),
  });

  const partnerForm = useForm<PartnerFormValues>({
    resolver: zodResolver(partnerSchema),
    defaultValues: {
      businessType: "",
      phone: "",
      companyName: "",
      surveyPreference: "",
      message: "",
    },
  });

  const partnerValues = partnerForm.watch();
  const guestValues = guestForm.watch();

  const onGuestSubmit = async (data: GuestFormValues) => {
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

  const onPartnerSubmit = async (data: PartnerFormValues) => {
    setIsLoading(true);
    try {
      const payload: Record<string, string> = {
        spaceId,
        businessType: data.businessType,
      };
      if (data.message?.trim()) payload.message = data.message.trim();
      if (data.companyName?.trim()) payload.companyName = data.companyName.trim();
      if (data.phone?.trim()) payload.phone = data.phone.trim();
      if (data.surveyPreference?.trim()) payload.surveyPreference = data.surveyPreference.trim();

      const res = await fetch("/api/partner/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setSubmitted(true);
        onSuccess?.();
        return;
      }

      const error = await res.json().catch(() => null);
      if (res.status === 400 && String(error?.error ?? "").includes("telepon")) {
        setNeedsPhone(true);
      }
      alert(error?.error ?? "Gagal mengirim pengajuan. Coba lagi.");
    } catch {
      alert("Gagal mengirim pengajuan. Coba lagi.");
    } finally {
      setIsLoading(false);
    }
  };

  if (!authChecked) {
    return (
      <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        Memuat formulir...
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="flex flex-col items-center gap-3 py-8 text-center">
        <CheckCircle className="h-10 w-10 text-emerald-500" />
        <div>
          <p className="font-bold text-[#101828]">Minat Anda Tercatat!</p>
          <p className="mt-1 text-sm text-slate-500">
            Pengajuan untuk unit {spaceCode} di Stasiun {stationName} sudah masuk Panel Mitra.
          </p>
        </div>
        <Button asChild className="mt-2 bg-[#D81435] hover:bg-[#B8112D]">
          <Link href="/partner">Buka Panel Mitra</Link>
        </Button>
      </div>
    );
  }

  if (isPartner && authUser) {
    const {
      register,
      handleSubmit,
      formState: { errors },
    } = partnerForm;

    const businessFilled = Boolean(partnerValues.businessType?.trim());
    const companyFilled = Boolean(partnerValues.companyName?.trim());
    const phoneFilled = Boolean(partnerValues.phone?.trim());
    const surveyFilled = Boolean(partnerValues.surveyPreference?.trim());
    const messageFilled = Boolean(partnerValues.message?.trim());

    return (
      <form onSubmit={handleSubmit(onPartnerSubmit)} className="space-y-4 text-[#101828]">
        <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-3 text-sm text-emerald-900">
          <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
            <UserRound className="size-4" />
          </span>
          <p>
            Login sebagai <span className="font-semibold">{authUser.name}</span> ({authUser.email}
            ). Pengajuan akan langsung masuk ke Panel Mitra Anda.
          </p>
        </div>

        <div className="relative py-2">
          <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-slate-200" />
          <p className="relative mx-auto w-fit bg-white px-3 text-[10px] font-bold tracking-[0.16em] text-slate-400 uppercase">
            Pengajuan Cepat
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="businessType" className="text-sm font-semibold text-[#101828]">
            Jenis Usaha *
          </Label>
          <FieldShell icon={<Briefcase className="size-4" />} filled={businessFilled}>
            <Input
              id="businessType"
              placeholder="F&B, Retail, Perbankan, dll."
              className={cn(inputClass, fieldPad(businessFilled))}
              {...register("businessType")}
            />
          </FieldShell>
          {errors.businessType && (
            <p className="text-xs text-red-500">{errors.businessType.message}</p>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="companyName" className="text-sm font-semibold text-[#101828]">
              Nama Perusahaan
            </Label>
            <FieldShell icon={<Building2 className="size-4" />} filled={companyFilled}>
              <Input
                id="companyName"
                placeholder="Opsional jika sudah pernah mengajukan"
                className={cn(inputClass, fieldPad(companyFilled))}
                {...register("companyName")}
              />
            </FieldShell>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="phone" className="text-sm font-semibold text-[#101828]">
              Telepon {needsPhone ? "*" : "(opsional)"}
            </Label>
            <FieldShell icon={<Phone className="size-4" />} filled={phoneFilled}>
              <Input
                id="phone"
                type="tel"
                placeholder="08123456789"
                className={cn(inputClass, fieldPad(phoneFilled))}
                {...register("phone")}
              />
            </FieldShell>
            {errors.phone && <p className="text-xs text-red-500">{errors.phone.message}</p>}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="surveyPreference" className="text-sm font-semibold text-[#101828]">
            Jadwal Survei <span className="font-medium text-slate-400">(opsional)</span>
          </Label>
          <FieldShell icon={<CalendarDays className="size-4" />} filled={surveyFilled}>
            <Input
              id="surveyPreference"
              placeholder="Contoh: Senin pagi, atau hubungi saya dulu"
              className={cn(inputClass, fieldPad(surveyFilled))}
              {...register("surveyPreference")}
            />
          </FieldShell>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="message" className="text-sm font-semibold text-[#101828]">
            Pesan Tambahan
          </Label>
          <div className="relative">
            {!messageFilled ? (
              <span className="pointer-events-none absolute top-3 left-3 text-slate-400">
                <MessageSquareText className="size-4" />
              </span>
            ) : null}
            <Textarea
              id="message"
              placeholder="Kebutuhan khusus, pertanyaan, dll."
              className={cn(
                "min-h-28 resize-none rounded-xl border-slate-200 bg-white text-sm text-[#101828] shadow-none placeholder:text-slate-400 focus-visible:border-[#D81435] focus-visible:ring-2 focus-visible:ring-[#D81435]",
                fieldPad(messageFilled)
              )}
              {...register("message")}
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#D81435] text-sm font-bold text-white transition hover:brightness-110 disabled:opacity-60"
        >
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Mengirim...
            </>
          ) : (
            <>
              <Send className="h-4 w-4" />
              Kirim Pengajuan Sewa
            </>
          )}
        </button>

        <p className="flex items-center justify-center gap-1.5 text-xs text-slate-500">
          <Clock3 className="size-3.5" />
          Respon dalam 1 × 24 jam
        </p>
      </form>
    );
  }

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = guestForm;

  const companyFilled = Boolean(guestValues.companyName?.trim());
  const contactFilled = Boolean(guestValues.contactName?.trim());
  const phoneFilled = Boolean(guestValues.phone?.trim());
  const emailFilled = Boolean(guestValues.email?.trim());
  const businessFilled = Boolean(guestValues.businessType?.trim());
  const surveyFilled = Boolean(guestValues.surveyPreference?.trim());
  const messageFilled = Boolean(guestValues.message?.trim());

  return (
    <form
      onSubmit={handleSubmit(onGuestSubmit)}
      className={`space-y-4 text-[#101828] ${isModal ? "" : "border-t border-gray-100 pt-6"}`}
    >
      {!isModal && (
        <p className="text-xs font-black tracking-[0.18em] text-gray-400 uppercase">
          Formulir Minat Sewa
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="companyName" className="text-sm font-semibold text-[#101828]">
            Nama Perusahaan *
          </Label>
          <FieldShell icon={<Building2 className="size-4" />} filled={companyFilled}>
            <Input
              id="companyName"
              placeholder="PT Contoh"
              className={cn(inputClass, fieldPad(companyFilled))}
              {...register("companyName")}
            />
          </FieldShell>
          {errors.companyName && (
            <p className="text-xs text-red-500">{errors.companyName.message}</p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="contactName" className="text-sm font-semibold text-[#101828]">
            Nama Kontak *
          </Label>
          <FieldShell icon={<UserRound className="size-4" />} filled={contactFilled}>
            <Input
              id="contactName"
              placeholder="Budi Santoso"
              className={cn(inputClass, fieldPad(contactFilled))}
              {...register("contactName")}
            />
          </FieldShell>
          {errors.contactName && (
            <p className="text-xs text-red-500">{errors.contactName.message}</p>
          )}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="phone" className="text-sm font-semibold text-[#101828]">
            Telepon *
          </Label>
          <FieldShell icon={<Phone className="size-4" />} filled={phoneFilled}>
            <Input
              id="phone"
              type="tel"
              placeholder="08123456789"
              className={cn(inputClass, fieldPad(phoneFilled))}
              {...register("phone")}
            />
          </FieldShell>
          {errors.phone && <p className="text-xs text-red-500">{errors.phone.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email" className="text-sm font-semibold text-[#101828]">
            Email *
          </Label>
          <FieldShell icon={<Mail className="size-4" />} filled={emailFilled}>
            <Input
              id="email"
              type="email"
              placeholder="budi@perusahaan.com"
              className={cn(inputClass, fieldPad(emailFilled))}
              {...register("email")}
            />
          </FieldShell>
          {errors.email && <p className="text-xs text-red-500">{errors.email.message}</p>}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="password" className="text-sm font-semibold text-[#101828]">
          Password Akun Mitra *
        </Label>
        <Input
          id="password"
          type="password"
          placeholder="Minimal 8 karakter"
          className="h-11 rounded-xl border-slate-200 text-sm text-[#101828] placeholder:text-slate-400 focus-visible:border-[#D81435] focus-visible:ring-2 focus-visible:ring-[#D81435]"
          {...register("password")}
        />
        <p className="text-xs text-slate-500">
          Password ini dipakai untuk login dan memantau status pengajuan Anda.
        </p>
        {errors.password && <p className="text-xs text-red-500">{errors.password.message}</p>}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="businessType" className="text-sm font-semibold text-[#101828]">
          Jenis Usaha *
        </Label>
        <FieldShell icon={<Briefcase className="size-4" />} filled={businessFilled}>
          <Input
            id="businessType"
            placeholder="F&B, Retail, Perbankan, dll."
            className={cn(inputClass, fieldPad(businessFilled))}
            {...register("businessType")}
          />
        </FieldShell>
        {errors.businessType && (
          <p className="text-xs text-red-500">{errors.businessType.message}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="surveyPreference" className="text-sm font-semibold text-[#101828]">
          Jadwal Survei <span className="font-medium text-slate-400">(opsional)</span>
        </Label>
        <FieldShell icon={<CalendarDays className="size-4" />} filled={surveyFilled}>
          <Input
            id="surveyPreference"
            placeholder="Contoh: Senin pagi, atau hubungi saya dulu"
            className={cn(inputClass, fieldPad(surveyFilled))}
            {...register("surveyPreference")}
          />
        </FieldShell>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="message" className="text-sm font-semibold text-[#101828]">
          Pesan Tambahan
        </Label>
        <div className="relative">
          {!messageFilled ? (
            <span className="pointer-events-none absolute top-3 left-3 text-slate-400">
              <MessageSquareText className="size-4" />
            </span>
          ) : null}
          <Textarea
            id="message"
            placeholder="Kebutuhan khusus, pertanyaan, dll."
            className={cn(
              "min-h-28 resize-none rounded-xl border-slate-200 text-sm text-[#101828] placeholder:text-slate-400 focus-visible:border-[#D81435] focus-visible:ring-2 focus-visible:ring-[#D81435]",
              fieldPad(messageFilled)
            )}
            {...register("message")}
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={isLoading}
        className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#D81435] text-sm font-bold text-white transition hover:brightness-110 disabled:opacity-60"
      >
        {isLoading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" /> Mengirim...
          </>
        ) : (
          <>
            <Send className="h-4 w-4" />
            Kirim Minat Sewa
          </>
        )}
      </button>

      <p className="flex items-center justify-center gap-1.5 text-xs text-slate-500">
        <Clock3 className="size-3.5" />
        Respon dalam 1 × 24 jam
      </p>
    </form>
  );
}
