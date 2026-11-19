"use client";

import { useTourLanguage } from "@/components/tour/TourLanguageProvider";
import { useEffect, useState, type BaseSyntheticEvent, type ReactNode } from "react";
import Link from "next/link";
import { useActiveInquiry } from "@/lib/use-active-inquiry";
import { trainInquiryInputSchema, type TrainInquiryInput } from "@/lib/train-advertising-shared";
import { useForm, type UseFormRegisterReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Briefcase,
  Building2,
  CheckCircle,
  KeyRound,
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
import { useInquiryWorkflow } from "@/lib/use-inquiry-workflow";
import { cn } from "@/lib/utils";

const guestSchema = z.object({
  companyName: z.string().min(2, "Nama perusahaan minimal 2 karakter"),
  contactName: z.string().min(2, "Nama kontak minimal 2 karakter"),
  phone: z.string().min(10, "Nomor telepon tidak valid").regex(/^\+?[\d\s-]+$/, "Format nomor tidak valid"),
  email: z.string().email("Format email tidak valid"),
  password: z.string().min(8, "Password minimal 8 karakter"),
  businessType: z.string().min(3, "Jenis usaha wajib diisi"),
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
  spaceId?: string;
  trainRentalSpaceId?: string;
  trainInquiry?: TrainInquiryInput;
  spaceCode: string;
  stationName: string;
  extraMessage?: string;
  onSuccess?: () => void;
  variant?: "default" | "modal";
  tone?: "light" | "dark";
  layout?: "stack" | "ledger";
  aside?: ReactNode;
};

const TONES = {
  light: {
    text: "text-[#101828]",
    muted: "text-slate-500",
    faint: "text-slate-400",
    label: "text-sm font-semibold text-[#101828]",
    error: "text-xs text-red-500",
    field:
      "rounded-xl border-slate-200 bg-white text-sm text-[#101828] shadow-none placeholder:text-slate-400 focus-visible:border-[#D81435] focus-visible:ring-2 focus-visible:ring-[#D81435]",
    divider: "bg-slate-200",
    dividerLabel: "bg-white text-slate-400",
    partnerNote: "border-emerald-200 bg-emerald-50 text-emerald-900",
    partnerIcon: "bg-emerald-100 text-emerald-700",
    sectionTitle: "text-gray-400",
    sectionBorder: "border-gray-100",
    ledgerHairline: "border-black/10",
    ledgerDivide: "divide-black/10",
    ledgerIcon:
      "border-black/10 bg-white text-slate-700 shadow-sm shadow-black/5 group-focus-within:border-[#E31E2D]/50 group-focus-within:bg-[#E31E2D]/8 group-focus-within:text-[#E31E2D]",
    ledgerIconError: "border-red-400/70 text-red-500",
    ledgerControl: "text-[#0B1220] placeholder:text-slate-500",
    ledgerFieldLabel: "text-slate-700 group-focus-within:text-[#0B1220]",
    ledgerOptional: "text-slate-500",
    ledgerHint: "text-slate-600",
    ledgerStepTitle: "text-[#0B1220]",
    ledgerStepDetail: "text-slate-600",
    ledgerStepHead: "text-slate-500",
    ledgerRequired: "text-[#E31E2D]",
  },
  dark: {
    text: "text-white",
    muted: "text-white/60",
    faint: "text-white/40",
    label: "text-sm font-semibold text-white/85",
    error: "text-xs text-[#FF8A8A]",
    field:
      "rounded-xl border-white/12 bg-black/35 text-sm text-white shadow-none placeholder:text-white/35 focus-visible:border-[#E31E2D] focus-visible:ring-2 focus-visible:ring-[#E31E2D]/40",
    divider: "bg-white/10",
    dividerLabel: "bg-transparent text-white/45",
    partnerNote: "border-emerald-400/25 bg-emerald-500/10 text-emerald-100",
    partnerIcon: "bg-emerald-500/20 text-emerald-300",
    sectionTitle: "text-white/45",
    sectionBorder: "border-white/10",
    ledgerHairline: "border-white/10",
    ledgerDivide: "divide-white/10",
    ledgerIcon:
      "border-white/12 bg-white/8 text-white/85 group-focus-within:border-[#E31E2D]/70 group-focus-within:bg-[#E31E2D]/15 group-focus-within:text-white",
    ledgerIconError: "border-[#FF8A8A]/60 text-[#FF8A8A]",
    ledgerControl:
      "text-white placeholder:text-white/30",
    ledgerFieldLabel: "text-white/55 group-focus-within:text-white/80",
    ledgerOptional: "text-white/35",
    ledgerHint: "text-white/40",
    ledgerStepTitle: "text-white",
    ledgerStepDetail: "text-white/50",
    ledgerStepHead: "text-white/45",
    ledgerRequired: "text-[#FF5A66]",
  },
} as const;

type Tone = (typeof TONES)[keyof typeof TONES];

type LedgerField = {
  id: string;
  label: string;
  icon: ReactNode;
  placeholder: string;
  registration: UseFormRegisterReturn;
  type?: string;
  autoComplete?: string;
  required?: boolean;
  optional?: boolean;
  multiline?: boolean;
  hint?: string;
  error?: string;
};

function FieldShell({
  icon,
  filled = false,
  iconClass,
  children,
}: {
  icon: ReactNode;
  filled?: boolean;
  iconClass: string;
  children: ReactNode;
}) {
  return (
    <div className="relative">
      {!filled ? (
        <span className={cn("pointer-events-none absolute top-1/2 left-3 z-10 -translate-y-1/2", iconClass)}>
          {icon}
        </span>
      ) : null}
      {children}
    </div>
  );
}

function fieldPad(filled: boolean) {
  return filled ? "pl-3.5" : "pl-10";
}

export default function TenantInterestForm({
  spaceId,
  trainRentalSpaceId,
  trainInquiry,
  spaceCode,
  stationName,
  extraMessage,
  onSuccess,
  variant = "default",
  tone = "light",
  layout = "stack",
  aside,
}: Props) {
  const { t: translate } = useTourLanguage();
  const t: Tone = TONES[tone];
  const isLedger = layout === "ledger";
  const labelClass = t.label;
  const inputClass = cn("h-11", t.field);
  const textareaClass = cn("min-h-28 resize-none", t.field);
  const formClass = cn("grid grid-cols-1 gap-4 sm:grid-cols-2", t.text);
  const full = "sm:col-span-2";
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

  const workflow = useInquiryWorkflow();
  const leasingSteps = (workflow?.steps ?? []).filter(step => step.showInSummary && step.stepOrder > 1);
  const [submittedInquiryId, setSubmittedInquiryId] = useState<string | null>(null);
  const isPartner = Boolean(authUser);
  const activeInquiry = useActiveInquiry(authUser?.id, spaceId, trainRentalSpaceId);
  const [duplicateInquiryId, setDuplicateInquiryId] = useState<string | null>(null);
  const existingInquiryId = duplicateInquiryId ?? activeInquiry.id;

  const guestForm = useForm<GuestFormValues>({
    resolver: zodResolver(guestSchema),
  });

  const partnerForm = useForm<PartnerFormValues>({
    resolver: zodResolver(partnerSchema),
    defaultValues: {
      businessType: "",
      phone: "",
      companyName: "",
      message: "",
    },
  });

  const partnerValues = partnerForm.watch();
  const guestValues = guestForm.watch();

  const onGuestSubmit = async (data: GuestFormValues) => {
    setIsLoading(true);
    try {
      const message = [trainRentalSpaceId ? undefined : extraMessage?.trim(), data.message?.trim()].filter(Boolean).join("\n\n");
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          ...(message ? { message } : {}),
          ...(spaceId ? { spaceId } : {}),
          ...(trainRentalSpaceId ? { trainRentalSpaceId, trainInquiry: trainInquiryInputSchema.parse(trainInquiry ?? {}) } : {}),
        }),
      });

      if (res.ok) {
        const receipt = await res.json();
        if (typeof receipt.id === "string") setSubmittedInquiryId(receipt.id);
        setSubmitted(true);
        onSuccess?.();
      } else {
        const error = await res.json().catch(() => null);
        if (res.status === 409 && typeof error?.existingInquiryId === "string") {
          setDuplicateInquiryId(error.existingInquiryId);
        } else {
          alert(translate(error?.error ?? "Gagal mengirim formulir. Coba lagi."));
        }
      }
    } catch (error) {
      alert(translate(error instanceof z.ZodError ? error.issues[0].message : "Gagal mengirim formulir. Coba lagi."));
    } finally {
      setIsLoading(false);
    }
  };

  const onPartnerSubmit = async (data: PartnerFormValues) => {
    setIsLoading(true);
    try {
      const payload: PartnerFormValues & { spaceId?: string; trainRentalSpaceId?: string; trainInquiry?: TrainInquiryInput } = {
        businessType: data.businessType,
      };
      if (trainRentalSpaceId) {
        payload.trainRentalSpaceId = trainRentalSpaceId;
        payload.trainInquiry = trainInquiryInputSchema.parse(trainInquiry ?? {});
      }
      else if (spaceId) payload.spaceId = spaceId;
      const message = [trainRentalSpaceId ? undefined : extraMessage?.trim(), data.message?.trim()].filter(Boolean).join("\n\n");
      if (message) payload.message = message;
      if (data.companyName?.trim()) payload.companyName = data.companyName.trim();
      if (data.phone?.trim()) payload.phone = data.phone.trim();

      const res = await fetch("/api/partner/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const receipt = await res.json();
        if (typeof receipt.id === "string") setSubmittedInquiryId(receipt.id);
        setSubmitted(true);
        onSuccess?.();
        return;
      }

      const error = await res.json().catch(() => null);
      if (res.status === 400 && String(error?.error ?? "").includes("telepon")) {
        setNeedsPhone(true);
      }
      if (res.status === 409 && typeof error?.existingInquiryId === "string") {
        setDuplicateInquiryId(error.existingInquiryId);
      } else {
        alert(translate(error?.error ?? "Gagal mengirim pengajuan. Coba lagi."));
      }
    } catch (error) {
      alert(translate(error instanceof z.ZodError ? error.issues[0].message : "Gagal mengirim pengajuan. Coba lagi."));
    } finally {
      setIsLoading(false);
    }
  };


  const submitButton = (label: string, className?: string) => (
    <button
      type="submit"
      disabled={isLoading}
      className={cn(
        "inline-flex w-full items-center justify-center gap-2.5 rounded-xl bg-[#E31E2D] px-4 font-bold text-white shadow-[0_10px_28px_rgba(227,30,45,0.28)] transition hover:bg-[#c41926] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF6B4A] disabled:opacity-60",
        className
      )}
    >
      {isLoading ? (
        <>
          <Loader2 className="size-4 animate-spin" /> {translate("Mengirim...")}
        </>
      ) : (
        <>
          <Send className="size-4" strokeWidth={2.2} />
          {label}
        </>
      )}
    </button>
  );

  const renderLedger = ({
    fields,
    onSubmit,
    submitLabel,
    note,
  }: {
    fields: LedgerField[];
    onSubmit: (event?: BaseSyntheticEvent) => Promise<void>;
    submitLabel: string;
    note?: ReactNode;
  }) => (
    <form
      onSubmit={onSubmit}
      noValidate
      className={cn(trainRentalSpaceId ? "flex min-h-0 flex-1 flex-col overflow-y-auto lg:grid lg:grid-cols-2 lg:grid-rows-[minmax(0,1fr)_auto] lg:overflow-hidden" : "grid min-h-0 flex-1 grid-cols-1 grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden lg:grid-cols-2 lg:grid-rows-[minmax(0,1fr)]", t.text)}
    >
      <div className={cn("flex shrink-0 flex-col justify-between gap-6 border-b px-5 py-5 sm:px-6 lg:border-r lg:border-b-0 lg:px-10 lg:pt-10 lg:pb-8", trainRentalSpaceId && "lg:overflow-y-auto", t.ledgerHairline)}>
        <div>
          {aside}
          {note ? <div className="mt-4 lg:mt-6">{note}</div> : null}
          <div className={cn("mt-8 hidden border-t pt-6 lg:block", t.ledgerHairline)}>
            <p className={cn("text-[11px] font-semibold tracking-[0.16em] uppercase", t.ledgerStepHead)}>
              {translate("Setelah dikirim")}
            </p>
            <ol className="mt-4 space-y-4">
              {leasingSteps.map((step) => (
                <li key={step.stepOrder} className="flex gap-4">
                  <span className="font-display w-6 shrink-0 pt-0.5 text-xs font-bold text-[#FF5A66]">
                    {step.stepOrder}
                  </span>
                  <span className="min-w-0">
                    <span className={cn("block text-sm font-semibold", t.ledgerStepTitle)}>{translate(step.title)}</span>
                    <span className={cn("mt-0.5 block text-xs leading-snug", t.ledgerStepDetail)}>{step.publicMessage}</span>
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </div>
        {!trainRentalSpaceId && submitButton(submitLabel, "hidden h-14 text-base lg:inline-flex")}
      </div>

      <div className={cn("min-h-0 overscroll-contain px-5 py-1 sm:px-6 lg:px-10 lg:pt-5 lg:pb-6", trainRentalSpaceId ? "shrink-0 lg:shrink lg:overflow-y-auto" : "overflow-y-auto")}>
        <ul className={cn("divide-y", t.ledgerDivide)}>
          {fields.map((field, index) => {
            const describedBy = [
              field.hint ? `${field.id}-hint` : null,
              field.error ? `${field.id}-error` : null,
            ]
              .filter(Boolean)
              .join(" ");
            const control = cn(
              "w-full bg-transparent text-sm font-semibold outline-none placeholder:font-normal lg:text-base",
              t.ledgerControl,
              field.multiline && "min-h-12 resize-none leading-relaxed"
            );
            return (
              <li
                key={field.id}
                className="group tour-spec-row flex items-start gap-3.5 py-3.5 lg:gap-4 lg:py-3"
                style={{ animationDelay: `${index * 35}ms` }}
              >
                <span
                  className={cn(
                    "mt-0.5 inline-flex size-10 shrink-0 items-center justify-center rounded-full border transition-colors lg:size-11",
                    field.error ? t.ledgerIconError : t.ledgerIcon
                  )}
                >
                  {field.icon}
                </span>
                <div className="grid min-w-0 flex-1 gap-1 lg:grid-cols-[minmax(0,0.75fr)_minmax(0,1.25fr)] lg:items-start lg:gap-4">
                  <label
                    htmlFor={field.id}
                    className={cn("text-xs transition-colors lg:pt-2.5 lg:text-sm", t.ledgerFieldLabel)}
                  >
                    {translate(field.label)}
                    {field.required ? <span className={t.ledgerRequired}> *</span> : null}
                    {field.optional ? <span className={t.ledgerOptional}> {translate("(opsional)")}</span> : null}
                  </label>
                  <div className="min-w-0">
                    {field.multiline ? (
                      <textarea
                        id={field.id}
                        rows={2}
                        placeholder={field.placeholder ? translate(field.placeholder) : undefined}
                        aria-invalid={field.error ? true : undefined}
                        aria-describedby={describedBy || undefined}
                        className={cn(control, "py-1 lg:py-2")}
                        {...field.registration}
                      />
                    ) : (
                      <input
                        id={field.id}
                        type={field.type ?? "text"}
                        placeholder={field.placeholder ? translate(field.placeholder) : undefined}
                        autoComplete={field.autoComplete}
                        aria-invalid={field.error ? true : undefined}
                        aria-describedby={describedBy || undefined}
                        className={cn(control, "h-8 lg:h-11")}
                        {...field.registration}
                      />
                    )}
                    {field.hint ? (
                      <p id={`${field.id}-hint`} className={cn("text-[11px] leading-snug lg:text-xs", t.ledgerHint)}>
                        {field.hint}
                      </p>
                    ) : null}
                    {field.error ? (
                      <p id={`${field.id}-error`} className={cn("mt-1", t.error)}>
                        {translate(field.error)}
                      </p>
                    ) : null}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      <div className={cn("shrink-0 border-t px-5 pt-4 pb-5 sm:px-6", trainRentalSpaceId ? "lg:col-span-2" : "lg:hidden", t.ledgerHairline)}>
        {submitButton(submitLabel, "h-12 text-sm")}
      </div>
    </form>
  );

  if (!authChecked || activeInquiry.checking) {
    return (
      <div className={cn("flex items-center justify-center gap-2 py-10 text-sm", t.muted, isLedger && "flex-1")}>
        <Loader2 className="h-4 w-4 animate-spin" />
        {translate("Memuat formulir...")}
      </div>
    );
  }

  if (activeInquiry.error) {
    return <div role="alert" className="space-y-3 p-5"><p className="text-sm">{translate(activeInquiry.error)}</p><Button type="button" onClick={activeInquiry.retry}>{translate("Coba lagi")}</Button></div>;
  }

  if (existingInquiryId) {
    return <div role="status" className={cn("space-y-4 p-5", t.text)}>
      <p className="text-sm">{translate("Pengajuan aktif untuk unit ini sudah tercatat.")}</p>
      <Button asChild className="bg-[#E31E2D] text-white hover:bg-[#c41926]"><Link href={`/partner/inquiries/${encodeURIComponent(existingInquiryId)}`}>{translate("Pantau pengajuan")}</Link></Button>
    </div>;
  }

  if (submitted) {
    return (
      <div className={cn("py-6", t.text, isLedger && "min-h-0 flex-1 overflow-y-auto px-6 sm:px-10")}>
        <div className="flex flex-col items-center gap-3 text-center">
          <CheckCircle className="h-10 w-10 text-emerald-500" />
          <div>
            <p className="font-bold">{translate("Minat Anda Tercatat")}</p>
            <p className={cn("mt-1 text-sm", t.muted)}>
              {translate("Pengajuan untuk")} {spaceCode} {translate("di")} {stationName} {translate("sudah masuk. Tim KAI meninjau sebelum ada penawaran resmi.")}
            </p>
          </div>
        </div>
        <ol className="mt-5 space-y-3 text-left">
          {leasingSteps.map((step) => (
            <li key={step.stepOrder} className="flex gap-3">
              <span className="font-display text-xs font-bold text-[#E31E2D]">{step.stepOrder}</span>
              <span>
                <span className="block text-sm font-semibold">{translate(step.title)}</span>
                <span className={cn("block text-xs", t.muted)}>{step.publicMessage}</span>
              </span>
            </li>
          ))}
        </ol>
        <div className="mt-5 flex justify-center">
          <Button asChild className="bg-[#E31E2D] hover:bg-[#c41926]">
            <Link href={submittedInquiryId ? `/partner/inquiries/${encodeURIComponent(submittedInquiryId)}` : "/partner"}>{translate("Pantau pengajuan")}</Link>
          </Button>
        </div>
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
    const messageFilled = Boolean(partnerValues.message?.trim());

    if (isLedger) {
      return renderLedger({
        onSubmit: handleSubmit(onPartnerSubmit),
        submitLabel: "Kirim Pengajuan Sewa",
        note: (
          <p className={cn("flex items-start gap-2.5 rounded-xl border px-3.5 py-3 text-xs leading-relaxed lg:text-sm", t.partnerNote)}>
            <UserRound className={cn("mt-0.5 size-4 shrink-0", t.partnerIcon)} />
            <span>
              {translate("Login sebagai")} <span className="font-semibold">{authUser.name}</span>{translate(". Pengajuan langsung masuk ke Panel Mitra Anda.")}
            </span>
          </p>
        ),
        fields: [
          {
            id: "businessType",
            label: "Jenis Usaha",
            required: true,
            icon: <Briefcase className="size-[18px]" strokeWidth={1.8} />,
            placeholder: "F&B, Retail, Perbankan, dll.",
            registration: register("businessType"),
            error: errors.businessType?.message,
          },
          {
            id: "companyName",
            label: "Nama Perusahaan",
            optional: true,
            icon: <Building2 className="size-[18px]" strokeWidth={1.8} />,
            placeholder: "Isi jika belum pernah mengajukan",
            autoComplete: "organization",
            registration: register("companyName"),
          },
          {
            id: "phone",
            label: "Telepon",
            required: needsPhone,
            optional: !needsPhone,
            type: "tel",
            icon: <Phone className="size-[18px]" strokeWidth={1.8} />,
            placeholder: "08123456789",
            autoComplete: "tel",
            registration: register("phone"),
            error: errors.phone?.message,
          },
          {
            id: "message",
            label: "Pesan Tambahan",
            optional: true,
            multiline: true,
            icon: <MessageSquareText className="size-[18px]" strokeWidth={1.8} />,
            placeholder: "Kebutuhan khusus, pertanyaan, dll.",
            registration: register("message"),
          },
        ],
      });
    }

    return (
      <form onSubmit={handleSubmit(onPartnerSubmit)} className={formClass}>
        <div
          className={cn(
            "flex items-start gap-3 rounded-xl border px-3.5 py-3 text-sm",
            t.partnerNote,
            full
          )}
        >
          <span
            className={cn(
              "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full",
              t.partnerIcon
            )}
          >
            <UserRound className="size-4" />
          </span>
          <p>
            {translate("Login sebagai")} <span className="font-semibold">{authUser.name}</span> ({authUser.email}
            {translate("). Pengajuan akan langsung masuk ke Panel Mitra Anda.")}
          </p>
        </div>

        <div className={cn("relative py-2", full)}>
          <div className={cn("absolute inset-x-0 top-1/2 h-px -translate-y-1/2", t.divider)} />
          <p
            className={cn(
              "relative mx-auto w-fit px-3 text-[10px] font-bold tracking-[0.16em] uppercase",
              t.dividerLabel
            )}
          >
            {translate("Pengajuan Cepat")}
          </p>
        </div>

        <div className={cn("space-y-2", full)}>
          <Label htmlFor="businessType" className={labelClass}>
            {translate("Jenis Usaha *")}
          </Label>
          <FieldShell icon={<Briefcase className="size-4" />} filled={businessFilled} iconClass={t.faint}>
            <Input
              id="businessType"
              placeholder={translate("F&B, Retail, Perbankan, dll.")}
              className={cn(inputClass, fieldPad(businessFilled))}
              {...register("businessType")}
            />
          </FieldShell>
          {errors.businessType && <p className={t.error}>{errors.businessType.message && translate(errors.businessType.message)}</p>}
        </div>

        <div className={cn("space-y-2", "")}>
          <Label htmlFor="companyName" className={labelClass}>
            {translate("Nama Perusahaan")}
          </Label>
          <FieldShell icon={<Building2 className="size-4" />} filled={companyFilled} iconClass={t.faint}>
            <Input
              id="companyName"
              placeholder={translate("Opsional jika sudah pernah mengajukan")}
              className={cn(inputClass, fieldPad(companyFilled))}
              {...register("companyName")}
            />
          </FieldShell>
        </div>

        <div className={cn("space-y-2", "")}>
          <Label htmlFor="phone" className={labelClass}>
            {translate("Telepon")} {needsPhone ? "*" : translate("(opsional)")}
          </Label>
          <FieldShell icon={<Phone className="size-4" />} filled={phoneFilled} iconClass={t.faint}>
            <Input
              id="phone"
              type="tel"
              placeholder="08123456789"
              className={cn(inputClass, fieldPad(phoneFilled))}
              {...register("phone")}
            />
          </FieldShell>
          {errors.phone && <p className={t.error}>{errors.phone.message && translate(errors.phone.message)}</p>}
        </div>

        <div className={cn("space-y-2", full)}>
          <Label htmlFor="message" className={labelClass}>
            {translate("Pesan Tambahan")}
          </Label>
          <div className="relative">
            {!messageFilled ? (
              <span className={cn("pointer-events-none absolute top-3 left-3", t.faint)}>
                <MessageSquareText className="size-4" />
              </span>
            ) : null}
            <Textarea
              id="message"
              placeholder={translate("Kebutuhan khusus, pertanyaan, dll.")}
              className={cn(textareaClass, fieldPad(messageFilled))}
              {...register("message")}
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className={cn(
            "inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#E31E2D] text-sm font-bold text-white shadow-[0_10px_28px_rgba(227,30,45,0.28)] transition hover:bg-[#c41926] disabled:opacity-60",
            "h-12",
            full
          )}
        >
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> {translate("Mengirim...")}
            </>
          ) : (
            <>
              <Send className="h-4 w-4" />
              {translate("Kirim Pengajuan Sewa")}
            </>
          )}
        </button>
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
  const messageFilled = Boolean(guestValues.message?.trim());

  if (isLedger) {
    return renderLedger({
      onSubmit: handleSubmit(onGuestSubmit),
      submitLabel: "Kirim Minat Sewa",
      fields: [
        {
          id: "companyName",
          label: "Nama Perusahaan",
          required: true,
          icon: <Building2 className="size-[18px]" strokeWidth={1.8} />,
          placeholder: "PT Contoh",
          autoComplete: "organization",
          registration: register("companyName"),
          error: errors.companyName?.message,
        },
        {
          id: "contactName",
          label: "Nama Kontak",
          required: true,
          icon: <UserRound className="size-[18px]" strokeWidth={1.8} />,
          placeholder: "Budi Santoso",
          autoComplete: "name",
          registration: register("contactName"),
          error: errors.contactName?.message,
        },
        {
          id: "phone",
          label: "Telepon",
          required: true,
          type: "tel",
          icon: <Phone className="size-[18px]" strokeWidth={1.8} />,
          placeholder: "08123456789",
          autoComplete: "tel",
          registration: register("phone"),
          error: errors.phone?.message,
        },
        {
          id: "email",
          label: "Email",
          required: true,
          type: "email",
          icon: <Mail className="size-[18px]" strokeWidth={1.8} />,
          placeholder: "budi@perusahaan.com",
          autoComplete: "email",
          registration: register("email"),
          error: errors.email?.message,
        },
        {
          id: "password",
          label: "Password Akun Mitra",
          required: true,
          type: "password",
          icon: <KeyRound className="size-[18px]" strokeWidth={1.8} />,
          placeholder: "Minimal 8 karakter",
          autoComplete: "new-password",
          hint: "Untuk login dan memantau status pengajuan.",
          registration: register("password"),
          error: errors.password?.message,
        },
        {
          id: "businessType",
          label: "Jenis Usaha",
          required: true,
          icon: <Briefcase className="size-[18px]" strokeWidth={1.8} />,
          placeholder: "F&B, Retail, Perbankan, dll.",
          registration: register("businessType"),
          error: errors.businessType?.message,
        },
        {
          id: "message",
          label: "Pesan Tambahan",
          optional: true,
          multiline: true,
          icon: <MessageSquareText className="size-[18px]" strokeWidth={1.8} />,
          placeholder: "Kebutuhan khusus, pertanyaan, dll.",
          registration: register("message"),
        },
      ],
    });
  }

  return (
    <form
      onSubmit={handleSubmit(onGuestSubmit)}
      className={cn(formClass, !isModal && cn("border-t pt-6", t.sectionBorder))}
    >
      {!isModal && (
        <p className={cn("text-xs font-black tracking-[0.18em] uppercase", t.sectionTitle, full)}>
          {translate("Formulir Minat Sewa")}
        </p>
      )}

        <div className={cn("space-y-2", "")}>
          <Label htmlFor="companyName" className={labelClass}>
            {translate("Nama Perusahaan *")}
          </Label>
          <FieldShell icon={<Building2 className="size-4" />} filled={companyFilled} iconClass={t.faint}>
            <Input
              id="companyName"
              placeholder={translate("PT Contoh")}
              className={cn(inputClass, fieldPad(companyFilled))}
              {...register("companyName")}
            />
          </FieldShell>
          {errors.companyName && <p className={t.error}>{errors.companyName.message && translate(errors.companyName.message)}</p>}
        </div>

        <div className={cn("space-y-2", "")}>
          <Label htmlFor="contactName" className={labelClass}>
            {translate("Nama Kontak *")}
          </Label>
          <FieldShell icon={<UserRound className="size-4" />} filled={contactFilled} iconClass={t.faint}>
            <Input
              id="contactName"
              placeholder="Budi Santoso"
              className={cn(inputClass, fieldPad(contactFilled))}
              {...register("contactName")}
            />
          </FieldShell>
          {errors.contactName && <p className={t.error}>{errors.contactName.message && translate(errors.contactName.message)}</p>}
        </div>

        <div className={cn("space-y-2", "")}>
          <Label htmlFor="phone" className={labelClass}>
            {translate("Telepon *")}
          </Label>
          <FieldShell icon={<Phone className="size-4" />} filled={phoneFilled} iconClass={t.faint}>
            <Input
              id="phone"
              type="tel"
              placeholder="08123456789"
              className={cn(inputClass, fieldPad(phoneFilled))}
              {...register("phone")}
            />
          </FieldShell>
          {errors.phone && <p className={t.error}>{errors.phone.message && translate(errors.phone.message)}</p>}
        </div>

        <div className={cn("space-y-2", "")}>
          <Label htmlFor="email" className={labelClass}>
            Email *
          </Label>
          <FieldShell icon={<Mail className="size-4" />} filled={emailFilled} iconClass={t.faint}>
            <Input
              id="email"
              type="email"
              placeholder="budi@perusahaan.com"
              className={cn(inputClass, fieldPad(emailFilled))}
              {...register("email")}
            />
          </FieldShell>
          {errors.email && <p className={t.error}>{errors.email.message && translate(errors.email.message)}</p>}
        </div>

        <div className={cn("space-y-2", full)}>
          <Label htmlFor="password" className={labelClass}>
            {translate("Password Akun Mitra *")}
          </Label>
          <Input
            id="password"
            type="password"
            placeholder={translate("Minimal 8 karakter")}
            aria-describedby="password-hint"
            className={inputClass}
            {...register("password")}
          />
          <p id="password-hint" className={cn("text-xs", t.muted)}>
            {translate("Password ini dipakai untuk login dan memantau status pengajuan Anda.")}
          </p>
          {errors.password && <p className={t.error}>{errors.password.message && translate(errors.password.message)}</p>}
        </div>

        <div className={cn("space-y-2", full)}>
          <Label htmlFor="businessType" className={labelClass}>
            {translate("Jenis Usaha *")}
          </Label>
          <FieldShell icon={<Briefcase className="size-4" />} filled={businessFilled} iconClass={t.faint}>
            <Input
              id="businessType"
              placeholder={translate("F&B, Retail, Perbankan, dll.")}
              className={cn(inputClass, fieldPad(businessFilled))}
              {...register("businessType")}
            />
          </FieldShell>
          {errors.businessType && <p className={t.error}>{errors.businessType.message && translate(errors.businessType.message)}</p>}
        </div>

        <div className={cn("space-y-2", full)}>
          <Label htmlFor="message" className={labelClass}>
            {translate("Pesan Tambahan")}
          </Label>
          <div className="relative">
            {!messageFilled ? (
              <span className={cn("pointer-events-none absolute top-3 left-3", t.faint)}>
                <MessageSquareText className="size-4" />
              </span>
            ) : null}
            <Textarea
              id="message"
              placeholder={translate("Kebutuhan khusus, pertanyaan, dll.")}
              className={cn(textareaClass, fieldPad(messageFilled))}
              {...register("message")}
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className={cn(
            "inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#E31E2D] text-sm font-bold text-white shadow-[0_10px_28px_rgba(227,30,45,0.28)] transition hover:bg-[#c41926] disabled:opacity-60",
            "h-12",
            full
          )}
        >
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> {translate("Mengirim...")}
            </>
          ) : (
            <>
              <Send className="h-4 w-4" />
              {translate("Kirim Minat Sewa")}
            </>
          )}
        </button>
    </form>
  );
}
