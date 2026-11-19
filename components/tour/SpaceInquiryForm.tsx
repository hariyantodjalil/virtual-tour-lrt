"use client";

import { useTourLanguage } from "@/components/tour/TourLanguageProvider";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useActiveInquiry } from "@/lib/use-active-inquiry";
import { z } from "zod";
import { ArrowLeft, ArrowRight, Briefcase, Building2, Eye, EyeOff, KeyRound, Loader2, Mail, MessageSquareText, Phone, UserRound } from "lucide-react";
import GoogleSignInButton, { type AuthUser } from "@/components/auth/GoogleSignInButton";
import InquiryConfirmation from "./InquiryConfirmation";
import { LEAD_STATUS_VALUES } from "@/lib/commercial-pipeline";
import { cn } from "@/lib/utils";
import { inquiryPhoneSchema } from "@/lib/inquiry-validation";
import { advertisingOptionsSchema, validateAdvertisingApplicant, type AdvertisingFormOption } from "@/lib/advertising-form-shared";
import { trainInquiryInputSchema, trainCampaignPeriod, type TrainInquiryInput } from "@/lib/train-advertising-shared";

const identitySchema = z.object({
  contactName: z.string().trim().min(2, "Nama kontak minimal 2 karakter.").max(160),
  companyName: z.string().trim().min(2, "Nama perusahaan minimal 2 karakter.").max(160),
  phone: inquiryPhoneSchema,
  email: z.string().trim().email("Format email tidak valid.").max(254),
  businessType: z.string().trim().min(1, "Pilih kategori bisnis Anda.").max(120, "Jenis usaha maksimal 120 karakter."),
  message: z.string().trim().max(2000, "Catatan maksimal 2.000 karakter."),
});
const passwordSchema = z.string().min(8, "Password minimal 8 karakter.").max(128, "Password maksimal 128 karakter.");
const authUserSchema = z.object({ id: z.string(), name: z.string(), email: z.string().email(), role: z.string() });
const sessionSchema = z.discriminatedUnion("authenticated", [
  z.object({ authenticated: z.literal(false) }),
  z.object({ authenticated: z.literal(true), user: authUserSchema }),
]);
const receiptSchema = z.object({
  id: z.string().min(1), status: z.enum(LEAD_STATUS_VALUES), inquiryCode: z.string().optional(),
  workflowVersion: z.object({ steps: z.array(z.object({ stepOrder: z.number().int(), leadStatus: z.enum(LEAD_STATUS_VALUES), title: z.string(), publicMessage: z.string() })) }).nullable().optional(),
});
const errorSchema = z.object({ error: z.string(), existingInquiryId: z.string().optional(), code: z.string().optional() });
const loginErrorSchema = z.union([errorSchema, z.object({ message: z.string() }).transform(({ message }) => ({ error: message }))]);
type Session = z.infer<typeof sessionSchema>;
type Identity = z.infer<typeof identitySchema>;
type AuthState = { kind: "loading" } | { kind: "error" } | { kind: "ready"; session: Session };
type Submission = { kind: "details" } | { kind: "form" } | { kind: "review"; identity: Identity; trainInquiry?: TrainInquiryInput }
  | ({ kind: "success" } & z.infer<typeof receiptSchema>);
export type SpaceInquiryStage = Submission["kind"];

const BUSINESS_OPTIONS = ["Vending Machine", "Grab-and-Go F&B", "Retail Kiosk", "Automated Services", "Lainnya"];
const controlClass = "min-h-11 w-full min-w-0 rounded-md border-0 bg-transparent px-1 py-2 text-sm font-semibold text-slate-900 placeholder:font-normal placeholder:text-slate-500 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#E31E2D]/50 aria-invalid:text-red-700";
const primaryClass = "inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#E31E2D] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#C41926] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E31E2D] disabled:cursor-wait disabled:opacity-60";
const FIELD_ICONS = { contactName: UserRound, companyName: Building2, phone: Phone, email: Mail, password: KeyRound, businessUse: Briefcase, customBusinessUse: Briefcase, applicantStatusId: UserRound, representedBrand: Building2, businessCategoryId: Briefcase, businessCategoryOther: Briefcase, message: MessageSquareText };
const STAGE_LABELS = { details: "Spesifikasi", form: "Data pengajuan", review: "Review", success: "Selesai" };
const STAGE_NUMBERS = { details: 1, form: 2, review: 3, success: 4 };

function Field({ name, label, error, optional, children }: {
  name: keyof typeof FIELD_ICONS; label: string; error?: string; optional?: boolean; children: ReactNode;
}) {
  const { t } = useTourLanguage();
  const Icon = FIELD_ICONS[name];
  return <div className="group flex items-start gap-3 border-b border-slate-200 py-3.5">
    <span aria-hidden="true" className={cn("mt-0.5 inline-flex size-10 shrink-0 items-center justify-center rounded-full border border-slate-200 text-slate-600 transition-colors group-focus-within:border-[#E31E2D]/50 group-focus-within:text-[#C41926]", error && "border-red-500 text-red-700")}><Icon className="size-[18px]" strokeWidth={1.8} /></span>
    <div className="grid min-w-0 flex-1 gap-1 sm:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] sm:gap-3">
    <label htmlFor={`inquiry-${name}`} className="pt-1 text-xs leading-relaxed text-slate-600 sm:pt-2.5 sm:text-sm">
      {label}{optional ? <span className="ml-1 font-normal text-slate-500">{t("(opsional)")}</span> : <span className="ml-1 text-[#C41926]">*</span>}
    </label>
    <div className="min-w-0">{children}
    {error && <p id={`inquiry-${name}-error`} className="text-xs text-red-700">{t(error)}</p>}
    </div></div>
  </div>;
}

type InquiryFormProps = {
  spaceCode: string;
  stationName: string;
  details: ReactNode;
  canApply: boolean;
  onStageChange: (stage: SpaceInquiryStage) => void;
  onExplore: () => void;
  initialStage?: "details" | "form";
  onBackToDetails?: () => void;
  additionalFields?: ReactNode;
  trainCarOptions?: { slug: string; label: string }[];
} & (
  | { spaceId: string; area: number; trainRentalSpaceId?: never; trainInquiry?: never }
  | { trainRentalSpaceId: string; trainInquiry: TrainInquiryInput; spaceId?: never; area?: never }
);

export default function SpaceInquiryForm({ spaceId, trainRentalSpaceId, trainInquiry, spaceCode, stationName, area, details, canApply, onStageChange, onExplore, initialStage = "details", onBackToDetails, additionalFields, trainCarOptions = [] }: InquiryFormProps) {
  const { t, content, locale } = useTourLanguage();
  const router = useRouter();
  const [auth, setAuth] = useState<AuthState>({ kind: "loading" });
  const [authAttempt, setAuthAttempt] = useState(0);
  const [submission, setSubmission] = useState<Submission>({ kind: initialStage });
  const [accountMode, setAccountMode] = useState<"register" | "login">("register");
  const [loginError, setLoginError] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);
  const [form, setForm] = useState({ contactName: "", companyName: "", phone: "", email: "", password: "", businessUse: trainRentalSpaceId ? "Lainnya" : "Vending Machine", customBusinessUse: "", applicantStatusId: "", representedBrand: "", businessCategoryId: "", businessCategoryOther: "", message: "" });
  const [advertisingOptions, setAdvertisingOptions] = useState<AdvertisingFormOption[]>([]);
  const [optionsState, setOptionsState] = useState<"loading" | "ready" | "error">("loading");
  const [optionsAttempt, setOptionsAttempt] = useState(0);
  const applicantStatus = advertisingOptions.find(option => option.id === form.applicantStatusId);
  const businessCategory = advertisingOptions.find(option => option.id === form.businessCategoryId);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState("");
  const [pending, setPending] = useState(false);
  const sending = useRef(false);
  const [showPassword, setShowPassword] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const interacted = useRef(false);
  const partner = auth.kind === "ready" && auth.session.authenticated && auth.session.user.role === "MITRA"
    ? auth.session.user : null;
  const activeInquiry = useActiveInquiry(partner?.id, spaceId, trainRentalSpaceId);
  const [duplicateInquiryId, setDuplicateInquiryId] = useState<string | null>(null);
  const existingInquiryId = duplicateInquiryId ?? activeInquiry.id;

  useEffect(() => {
    if (!trainRentalSpaceId) return;
    const controller = new AbortController();
    async function loadOptions() {
      try {
        const response = await fetch("/api/advertising-form-options", { signal: controller.signal, cache: "no-store" });
        if (!response.ok) throw new Error("Pilihan formulir gagal dimuat.");
        const options = advertisingOptionsSchema.parse(await response.json());
        if (controller.signal.aborted) return;
        setAdvertisingOptions(options);
        setOptionsState("ready");
      } catch { if (!controller.signal.aborted) setOptionsState("error"); }
    }
    void loadOptions();
    return () => controller.abort();
  }, [trainRentalSpaceId, optionsAttempt]);

  useEffect(() => {
    const controller = new AbortController();
    async function loadSession() {
      try {
        const response = await fetch("/api/auth/verify", { signal: controller.signal, cache: "no-store" });
        if (!response.ok) throw new Error("Session unavailable");
        const session = sessionSchema.parse(await response.json());
        if (controller.signal.aborted) return;
        setAuth({ kind: "ready", session });
        if (session.authenticated && session.user.role === "MITRA") {
          const user = session.user;
          setForm(current => ({ ...current, contactName: current.contactName || user.name, email: user.email, password: "" }));
        }
      } catch {
        if (!controller.signal.aborted) setAuth({ kind: "error" });
      }
    }
    void loadSession();
    return () => controller.abort();
  }, [authAttempt]);

  useEffect(() => {
    if (!interacted.current) return;
    scrollRef.current?.scrollTo({ top: 0 });
    headingRef.current?.focus({ preventScroll: true });
    onStageChange(submission.kind);
  }, [submission.kind, onStageChange]);

  useEffect(() => {
    if (!interacted.current) return;
    scrollRef.current?.scrollTo({ top: 0 });
  }, [accountMode]);

  function update(name: keyof typeof form, value: string) {
    setForm(current => ({ ...current, [name]: value }));
    setErrors(current => ({ ...current, [name]: "" }));
  }

  function acceptLogin(user: AuthUser) {
    const parsed = authUserSchema.safeParse(user);
    if (!parsed.success) {
      setLoginError("Sesi login tidak valid. Silakan coba lagi.");
      return;
    }
    if (parsed.data.role !== "MITRA") {
      router.push("/cms/dashboard");
      return;
    }
    setAuth({ kind: "ready", session: { authenticated: true, user: parsed.data } });
    setForm(current => ({ ...current, contactName: current.contactName || parsed.data.name, email: parsed.data.email, password: "" }));
    setAccountMode("register");
    setLoginError("");
    setErrors({});
  }

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loggingIn) return;
    const credentials = z.object({ email: z.string().trim().email(), password: z.string().min(1).max(128) }).safeParse(form);
    if (!credentials.success) {
      setLoginError("Isi email dan password akun Anda.");
      return;
    }
    setLoggingIn(true);
    setLoginError("");
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(credentials.data),
      });
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const error = loginErrorSchema.safeParse(body);
        throw new Error(error.success ? error.data.error : "Email atau password tidak sesuai.");
      }
      const result = z.object({ user: authUserSchema }).safeParse(body);
      if (!result.success) throw new Error("Respons login tidak valid. Silakan coba lagi.");
      acceptLogin(result.data.user);
    } catch (error: unknown) {
      setLoginError(error instanceof Error ? error.message : "Login gagal. Silakan coba lagi.");
    } finally {
      setLoggingIn(false);
    }
  }

  function review(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (auth.kind !== "ready") return;
    const parsed = identitySchema.safeParse({
      ...form, email: partner?.email ?? form.email,
      businessType: trainRentalSpaceId ? (businessCategory?.requiresDetail ? form.businessCategoryOther : businessCategory?.label ?? "") : form.businessUse === "Lainnya" ? form.customBusinessUse : form.businessUse,
    });
    const nextErrors: Record<string, string> = {};
    const advertisingInput = {
      ...trainInquiry, applicantStatusId: form.applicantStatusId, businessCategoryId: form.businessCategoryId,
      ...(applicantStatus?.allowsRepresentedBrand && form.representedBrand.trim() ? { representedBrand: form.representedBrand.trim() } : {}),
      ...(businessCategory?.requiresDetail ? { businessCategoryOther: form.businessCategoryOther.trim() } : {}),
    };
    if (trainRentalSpaceId) {
      Object.assign(nextErrors, validateAdvertisingApplicant(advertisingInput, advertisingOptions).errors);
      if (optionsState !== "ready") nextErrors.applicantStatusId = "Pilihan formulir belum dimuat. Silakan coba lagi.";
    }
    const campaign = trainRentalSpaceId ? trainInquiryInputSchema.safeParse(advertisingInput) : null;
    if (campaign && !campaign.success) nextErrors.trainInquiry = campaign.error.issues[0].message;
    if (!parsed.success) for (const issue of parsed.error.issues) {
      const name = issue.path[0];
      if (typeof name === "string") nextErrors[name === "businessType" ? (trainRentalSpaceId ? (businessCategory?.requiresDetail ? "businessCategoryOther" : "businessCategoryId") : "customBusinessUse") : name] = issue.message;
    }
    if (!partner) {
      const password = passwordSchema.safeParse(form.password);
      if (!password.success) nextErrors.password = password.error.issues[0].message;
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length || !parsed.success) {
      const first = Object.keys(nextErrors)[0];
      document.getElementById(`inquiry-${first}`)?.focus();
      return;
    }
    interacted.current = true;
    setSubmitError("");
    setSubmission({ kind: "review", identity: parsed.data, ...(campaign?.success ? { trainInquiry: campaign.data } : {}) });
  }

  async function submit() {
    if (submission.kind !== "review" || sending.current || auth.kind !== "ready" || activeInquiry.checking || activeInquiry.error || existingInquiryId) return;
    sending.current = true;
    setPending(true);
    setSubmitError("");
    const data = submission.identity;
    try {
      const response = await fetch(partner ? "/api/partner/leads" : "/api/leads", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(trainRentalSpaceId ? { trainRentalSpaceId, trainInquiry: submission.trainInquiry } : { spaceId }), contactName: data.contactName, companyName: data.companyName, phone: data.phone,
          businessType: data.businessType,
          message: data.message || undefined,
          ...(!partner ? { email: data.email, password: form.password, ...(spaceId ? { spaceRequirement: `${area} m²` } : {}) } : {}),
        }),
      });
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const error = errorSchema.safeParse(body);
        if (response.status === 409 && error.success && error.data.code === "ACCOUNT_EXISTS") {
          setSubmission({ kind: "form" });
          setAccountMode("login");
          setForm(current => ({ ...current, password: "" }));
          setLoginError(error.data.error);
          return;
        }
        if (response.status === 409 && error.success && error.data.existingInquiryId) {
          setDuplicateInquiryId(error.data.existingInquiryId);
          return;
        }
        throw new Error(error.success ? error.data.error : "Pengajuan gagal dikirim. Silakan coba lagi.");
      }
      const receipt = receiptSchema.safeParse(body);
      if (!receipt.success) throw new Error("Respons pengajuan tidak valid. Periksa daftar pengajuan sebelum mencoba lagi.");
      setForm(current => ({ ...current, password: "" }));
      setSubmission({ kind: "success", ...receipt.data });
    } catch (error: unknown) {
      setSubmitError(error instanceof Error ? error.message : "Tidak dapat terhubung. Silakan coba lagi.");
    } finally {
      sending.current = false;
      setPending(false);
    }
  }

  function input(name: keyof typeof form, type = "text", autoComplete?: string, maxLength?: number) {
    const placeholders: Partial<Record<keyof typeof form, string>> = {
      contactName: "Masukkan nama lengkap Anda", companyName: "Contoh: PT Contoh Indonesia", phone: "Contoh: 081234567890", email: "nama@perusahaan.com", customBusinessUse: "Jenis usaha Anda", representedBrand: "Nama brand yang diwakili", businessCategoryOther: "Masukkan kategori bisnis Anda",
    };
    return <input id={`inquiry-${name}`} name={name} type={type} autoComplete={autoComplete}
      required={name !== "representedBrand"} value={form[name]} maxLength={maxLength} placeholder={placeholders[name] ? t(placeholders[name]) : undefined}
      onChange={event => update(name, event.target.value)} className={controlClass}
      aria-invalid={Boolean(errors[name])} aria-describedby={errors[name] ? `inquiry-${name}-error` : undefined} />;
  }

  return <div className="flex min-h-0 flex-1 flex-col bg-white text-slate-900">
    <div className="shrink-0 border-b border-slate-200 px-5 py-3 sm:px-7 lg:py-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 ref={headingRef} tabIndex={-1} className="text-sm font-semibold outline-none sm:text-base">{t("Alur Pengajuan Sewa")}</h2>
        <p aria-live="polite" className="text-sm font-semibold text-slate-600">{STAGE_NUMBERS[submission.kind]} / 4 {t(STAGE_LABELS[submission.kind])}</p>
      </div>
      <div role="progressbar" aria-label={t("Progres pengajuan sewa")} aria-valuemin={1} aria-valuemax={4} aria-valuenow={STAGE_NUMBERS[submission.kind]} aria-valuetext={t(STAGE_LABELS[submission.kind])} className="mt-3 grid grid-cols-4 gap-2">
        {[1, 2, 3, 4].map(step => <span key={step} className={cn("h-1.5 rounded-full", step <= STAGE_NUMBERS[submission.kind] ? "bg-[#E31E2D]" : "bg-slate-200")} />)}
      </div>
    </div>

    {submission.kind === "details" ? <>
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-2 sm:px-7">{details}</div>
      <div className="grid shrink-0 grid-cols-2 gap-2 border-t border-slate-200 px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-7 lg:block lg:py-4">
        {existingInquiryId ? <Link href={`/partner/inquiries/${encodeURIComponent(existingInquiryId)}`} className={primaryClass}>{t("Pantau pengajuan")}<ArrowRight className="size-4" /></Link>
          : <button type="button" disabled={!canApply || auth.kind === "loading" || activeInquiry.checking} onClick={() => {
            interacted.current = true;
            setSubmission({ kind: "form" });
          }} className={cn(primaryClass, "px-2 text-xs disabled:cursor-not-allowed sm:text-sm")}>{auth.kind === "loading" || activeInquiry.checking ? t("Memeriksa pengajuan...") : canApply ? <>{t("Ajukan Minat Sewa")}<ArrowRight className="hidden size-4 lg:block" /></> : t("Ruang belum tersedia")}</button>}
        <button type="button" onClick={onExplore} className="min-h-12 rounded-xl border border-slate-200 px-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-[#E31E2D] sm:text-sm lg:hidden">{t("Lanjut Jelajahi")}</button>
      </div>
    </> : auth.kind === "loading" || activeInquiry.checking ? <div className="flex flex-1 items-center justify-center gap-2 p-6 text-sm text-slate-600" role="status"><Loader2 className="size-4 animate-spin" />{t("Memuat formulir...")}</div>
    : auth.kind === "error" || activeInquiry.error ? <div className="space-y-3 p-7" role="alert"><p className="text-sm">{t(activeInquiry.error || "Sesi belum dapat diperiksa.")}</p><button type="button" className={primaryClass} onClick={() => { setAuth({ kind: "loading" }); setAuthAttempt(value => value + 1); activeInquiry.retry(); }}>{t("Coba lagi")}</button></div>
    : existingInquiryId ? <div role="status" className="space-y-4 p-5 sm:p-7">
      <p className="text-sm text-slate-700">{t("Pengajuan aktif untuk unit ini sudah tercatat.")}</p>
      <Link href={`/partner/inquiries/${encodeURIComponent(existingInquiryId)}`} className={primaryClass}>{t("Pantau pengajuan")}<ArrowRight className="size-4" /></Link>
    </div>
    : submission.kind === "success" ? <InquiryConfirmation id={submission.id} inquiryCode={submission.inquiryCode} workflowSteps={submission.workflowVersion?.steps} status={submission.status} spaceCode={spaceCode} stationName={stationName} isTrain={Boolean(trainRentalSpaceId)} onClose={onExplore} />
    : submission.kind === "review" ? <>
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 sm:px-7">
        <button type="button" disabled={pending} onClick={() => setSubmission({ kind: "form" })} className="mb-5 inline-flex min-h-11 items-center gap-2 text-sm font-medium hover:text-[#C41926]"><ArrowLeft className="size-4" />{t("Edit data pengajuan")}</button>
        <dl className="divide-y divide-slate-200 text-sm">
          {[
            [t("Nama penanggung jawab"), submission.identity.contactName], [t("Perusahaan / brand"), submission.identity.companyName],
            ["WhatsApp", submission.identity.phone], ["Email", submission.identity.email], [trainRentalSpaceId ? t("Kategori bisnis") : t("Peruntukan usaha"), submission.trainInquiry?.businessCategoryOther || (!trainRentalSpaceId && form.businessUse === "Lainnya") ? submission.identity.businessType : content(submission.identity.businessType)],
            [t("Status pengaju"), content(advertisingOptions.find(option => option.id === submission.trainInquiry?.applicantStatusId)?.label ?? "")],
            [t("Brand yang diwakili"), submission.trainInquiry?.representedBrand],
            [t("Catatan kebutuhan"), submission.identity.message],
            [t("Gerbong"), trainRentalSpaceId ? trainCarOptions.filter(car => !submission.trainInquiry?.carSlugs || submission.trainInquiry.carSlugs.includes(car.slug)).map(car => content(car.label)).join(", ") : null],
            [t("Jumlah trainset"), submission.trainInquiry?.requestedTrainsetCount?.toString()],
            [t("Periode kampanye"), submission.trainInquiry?.campaignStart ? trainCampaignPeriod({ campaignStart: submission.trainInquiry.campaignStart, campaignEnd: submission.trainInquiry.campaignEnd ?? null }, locale) : null],
            [t("Kebutuhan kampanye"), submission.trainInquiry?.campaignNeeds],
          ].filter(([, value]) => value).map(([label, value]) => <div key={label} className="py-3"><dt className="text-slate-600">{label}</dt><dd className="mt-1 whitespace-pre-wrap break-words font-medium">{value}</dd></div>)}
        </dl>
        <p className="mt-5 text-xs leading-relaxed text-slate-600">{t("Pengajuan minat belum merupakan pemesanan atau perjanjian sewa.")}</p>
        {submitError && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{t(submitError)}</p>}
      </div>
      <div className="shrink-0 border-t border-slate-200 px-5 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-7 lg:pb-4"><button type="button" onClick={() => void submit()} disabled={pending} className={primaryClass}>{pending ? <><Loader2 className="size-4 animate-spin" />{t("Mengirim...")}</> : <>{t("Kirim pengajuan")}<ArrowRight className="size-4" /></>}</button></div>
    </> : <form onSubmit={!partner && accountMode === "login" ? login : review} noValidate className="flex min-h-0 flex-1 flex-col">
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-3 sm:px-7">
        <button type="button" onClick={() => { if (onBackToDetails) onBackToDetails(); else setSubmission({ kind: "details" }); }} className="mb-3 inline-flex min-h-11 items-center gap-2 text-sm font-medium hover:text-[#C41926]"><ArrowLeft className="size-4" />{t("Kembali ke spesifikasi")}</button>
        {trainRentalSpaceId && <section aria-label={t("Media advertising terpilih")} className="mb-4 border-b border-slate-200 pb-4">{details}</section>}
        {!partner && <div className="mb-3 space-y-3">
          <div role="group" aria-label={t("Akun mitra")} className="grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1">
            {(["register", "login"] satisfies ("register" | "login")[]).map(mode => <button key={mode} type="button" aria-pressed={accountMode === mode} disabled={loggingIn} onClick={() => { setAccountMode(mode); setLoginError(""); setErrors({}); }} className={cn("min-h-11 rounded-md px-3 text-sm font-medium transition", accountMode === mode ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900")}>{mode === "register" ? t("Daftar akun") : t("Sudah punya akun? Masuk")}</button>)}
          </div>
          <GoogleSignInButton label={accountMode === "login" ? t("Masuk dengan Google") : t("Daftar dengan Google")} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-60" disabled={loggingIn} onSuccess={acceptLogin} onError={setLoginError} />
          <p className="text-center text-xs text-slate-500">{t("atau dengan email")}</p>
        </div>}
        {loginError && <p role="alert" className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{t(loginError)}</p>}
        {(partner || accountMode === "register") && <>
        <Field name="contactName" label={t("Nama kontak")} error={errors.contactName}>{input("contactName", "text", "name", 160)}</Field>
        <Field name="companyName" label={t("Nama perusahaan / brand")} error={errors.companyName}>{input("companyName", "text", "organization", 160)}</Field>
        <Field name="phone" label={t("Nomor WhatsApp aktif")} error={errors.phone}>{input("phone", "tel", "tel", 32)}</Field>
        </>}
        <div>
          <Field name="email" label={t("Email bisnis")} error={errors.email}>
            {partner ? <input id="inquiry-email" type="email" value={partner.email} readOnly className={cn(controlClass, "bg-slate-50 text-slate-600")} /> : input("email", "email", "email", 254)}
          </Field>
          {!partner && <Field name="password" label={t("Password akun mitra")} error={errors.password}>
            <div className="relative">
              <input id="inquiry-password" type={showPassword ? "text" : "password"} required autoComplete={accountMode === "login" ? "current-password" : "new-password"} minLength={8} maxLength={128}
                value={form.password} placeholder={accountMode === "login" ? t("Password Anda") : t("Minimal 8 karakter")} onChange={event => update("password", event.target.value)} className={cn(controlClass, "pr-12")}
                aria-invalid={Boolean(errors.password)} aria-describedby={errors.password ? "inquiry-password-error" : accountMode === "register" ? "inquiry-password-hint" : undefined} />
              <button type="button" aria-label={showPassword ? t("Sembunyikan password") : t("Tampilkan password")} aria-pressed={showPassword} onClick={() => setShowPassword(value => !value)} className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-lg text-slate-600 hover:text-slate-900">{showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button>
            </div>
            {!errors.password && accountMode === "register" && <p id="inquiry-password-hint" className="text-xs leading-relaxed text-slate-600">{t("Akun dibuat saat pengajuan dikirim.")}</p>}
          </Field>}
        </div>
        {(partner || accountMode === "register") && <>
        {!trainRentalSpaceId && <Field name="businessUse" label={t("Peruntukan usaha")}>
          <select id="inquiry-businessUse" value={form.businessUse} onChange={event => update("businessUse", event.target.value)} className={controlClass}>
            {BUSINESS_OPTIONS.map(option => <option key={option} value={option}>{t(option)}</option>)}
          </select>
        </Field>}
        {!trainRentalSpaceId && form.businessUse === "Lainnya" && <Field name="customBusinessUse" label={trainRentalSpaceId ? t("Jenis usaha") : t("Jenis usaha Anda")} error={errors.customBusinessUse}>{input("customBusinessUse", "text", undefined, 120)}</Field>}
        {trainRentalSpaceId && <>
          {optionsState === "error" && <div role="alert" className="my-3 text-sm text-red-700">{t("Pilihan formulir gagal dimuat.")}<button type="button" className="ml-2 min-h-11 underline" onClick={() => { setOptionsState("loading"); setOptionsAttempt(value => value + 1); }}>{t("Coba lagi")}</button></div>}
          <Field name="applicantStatusId" label={t("Status pengaju")} error={errors.applicantStatusId}>
            <select id="inquiry-applicantStatusId" required disabled={optionsState !== "ready"} value={form.applicantStatusId} onChange={event => update("applicantStatusId", event.target.value)} className={controlClass} aria-invalid={Boolean(errors.applicantStatusId)} aria-describedby={errors.applicantStatusId ? "inquiry-applicantStatusId-error" : undefined}>
              <option value="">{optionsState === "loading" ? t("Memuat pilihan…") : t("Pilih status pengaju")}</option>
              {advertisingOptions.filter(option => option.kind === "APPLICANT_STATUS").map(option => <option key={option.id} value={option.id}>{content(option.label)}</option>)}
            </select>
          </Field>
          {applicantStatus?.allowsRepresentedBrand && <Field name="representedBrand" label={t("Nama brand yang diwakili")} optional error={errors.representedBrand}>{input("representedBrand", "text", undefined, 160)}</Field>}
          <Field name="businessCategoryId" label={t("Kategori bisnis")} error={errors.businessCategoryId}>
            <select id="inquiry-businessCategoryId" required disabled={optionsState !== "ready"} value={form.businessCategoryId} onChange={event => update("businessCategoryId", event.target.value)} className={controlClass} aria-invalid={Boolean(errors.businessCategoryId)} aria-describedby="inquiry-category-hint inquiry-businessCategoryId-error">
              <option value="">{optionsState === "loading" ? t("Memuat pilihan…") : t("Pilih kategori bisnis Anda")}</option>
              {advertisingOptions.filter(option => option.kind === "BUSINESS_CATEGORY").map(option => <option key={option.id} value={option.id}>{content(option.label)}</option>)}
            </select>
            {applicantStatus?.allowsRepresentedBrand && <p id="inquiry-category-hint" className="text-xs leading-relaxed text-slate-600">{t("Pilih industri brand yang akan beriklan.")}</p>}
          </Field>
          {businessCategory?.requiresDetail && <Field name="businessCategoryOther" label={t("Kategori bisnis Anda")} error={errors.businessCategoryOther}>{input("businessCategoryOther", "text", undefined, 120)}</Field>}
        </>}
        {additionalFields}
        {errors.trainInquiry && <p role="alert" className="mt-3 text-sm text-red-700">{t(errors.trainInquiry)}</p>}
        <Field name="message" label={t("Catatan kebutuhan")} optional error={errors.message}>
          <textarea id="inquiry-message" placeholder={trainRentalSpaceId ? t("Jelaskan kebutuhan atau rencana kampanye") : undefined} rows={3} maxLength={2000} value={form.message} onChange={event => update("message", event.target.value)} className={cn(controlClass, "resize-y")} aria-invalid={Boolean(errors.message)} aria-describedby={errors.message ? "inquiry-message-error" : undefined} />
        </Field>
        </>}
      </div>
      <div className="shrink-0 border-t border-slate-200 px-5 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-7 lg:pb-4"><button type="submit" disabled={loggingIn || Boolean(trainRentalSpaceId && accountMode === "register" && optionsState !== "ready")} className={primaryClass}>{loggingIn ? <><Loader2 className="size-4 animate-spin" />{t("Memproses...")}</> : <>{!partner && accountMode === "login" ? t("Masuk dan lanjutkan") : t("Review pengajuan")}<ArrowRight className="size-4" /></>}</button></div>
    </form>}
  </div>;
}
