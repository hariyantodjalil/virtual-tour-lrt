"use client";

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { ArrowLeft, ArrowRight, Briefcase, Building2, CalendarDays, Eye, EyeOff, KeyRound, Loader2, Mail, MessageSquareText, Phone, UserRound } from "lucide-react";
import GoogleSignInButton, { type AuthUser } from "@/components/auth/GoogleSignInButton";
import InquiryConfirmation from "./InquiryConfirmation";
import { LEAD_STATUS_VALUES } from "@/lib/commercial-pipeline";
import { notifyCmsLeadsUpdated, notifyPartnerLeadsUpdated } from "@/lib/inquiry-sync-events";
import { announceAuthLogin } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

const identitySchema = z.object({
  contactName: z.string().trim().min(2, "Nama kontak minimal 2 karakter.").max(160),
  companyName: z.string().trim().min(2, "Nama perusahaan minimal 2 karakter.").max(160),
  phone: z.string().trim().min(10, "Nomor WhatsApp minimal 10 karakter.").max(32)
    .regex(/^[+0-9()\s.-]+$/, "Format nomor WhatsApp tidak valid."),
  email: z.string().trim().email("Format email tidak valid.").max(254),
  businessType: z.string().trim().min(3, "Jenis usaha minimal 3 karakter.").max(120),
  surveyPreference: z.string().trim().max(500),
  message: z.string().trim().max(2000, "Catatan maksimal 2.000 karakter."),
});
const passwordSchema = z.string().min(8, "Password minimal 8 karakter.").max(128);
const authUserSchema = z.object({ id: z.string(), name: z.string(), email: z.string().email(), role: z.string() });
const sessionSchema = z.discriminatedUnion("authenticated", [
  z.object({ authenticated: z.literal(false) }),
  z.object({ authenticated: z.literal(true), user: authUserSchema }),
]);
const receiptSchema = z.object({
  id: z.string().min(1), status: z.enum(LEAD_STATUS_VALUES), inquiryCode: z.string().optional(),
  workflowVersion: z.object({ steps: z.array(z.object({ stepOrder: z.number().int(), leadStatus: z.enum(LEAD_STATUS_VALUES), title: z.string(), publicMessage: z.string() })) }).nullable().optional(),
});
const errorSchema = z.object({ error: z.string() });
const loginErrorSchema = z.union([errorSchema, z.object({ message: z.string() }).transform(({ message }) => ({ error: message }))]);
type Session = z.infer<typeof sessionSchema>;
type Identity = z.infer<typeof identitySchema>;
type AuthState = { kind: "loading" } | { kind: "error" } | { kind: "ready"; session: Session };
type Submission = { kind: "details" } | { kind: "form" } | { kind: "review"; identity: Identity }
  | ({ kind: "success" } & z.infer<typeof receiptSchema>);
export type SpaceInquiryStage = Submission["kind"];

const BUSINESS_OPTIONS = ["Vending Machine", "Grab-and-Go F&B", "Retail Kiosk", "Automated Services", "Lainnya"];
const controlClass = "min-h-10 w-full min-w-0 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900 placeholder:font-normal placeholder:text-slate-400 transition-colors hover:border-slate-400 focus:border-[#E31E2D] focus:outline-none focus:ring-2 focus:ring-[#E31E2D]/15 aria-invalid:border-red-500 aria-invalid:focus:ring-red-500/15";
const primaryClass = "inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#E31E2D] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#C41926] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E31E2D] disabled:cursor-wait disabled:opacity-60";
const backButtonClass = "inline-flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E31E2D] disabled:opacity-50";
const FIELD_ICONS = {
  contactName: UserRound, companyName: Building2, phone: Phone, email: Mail, password: KeyRound,
  businessUse: Briefcase, customBusinessUse: Briefcase, surveyPreference: CalendarDays, message: MessageSquareText,
};
const STAGE_LABELS = { details: "Spesifikasi", form: "Data pengajuan", review: "Review", success: "Selesai" };
const STAGE_NUMBERS = { details: 1, form: 2, review: 3, success: 4 };

function Field({ name, label, error, optional, hint, children }: {
  name: keyof typeof FIELD_ICONS; label: string; error?: string; optional?: boolean; hint?: string; children: ReactNode;
}) {
  const Icon = FIELD_ICONS[name];
  return <div className="flex items-start gap-3">
    <span aria-hidden="true" className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 sm:mt-1">
      <Icon className="size-4" />
    </span>
    <div className="grid min-w-0 flex-1 grid-cols-1 gap-1 sm:grid-cols-[152px_minmax(0,1fr)] sm:items-start sm:gap-3">
      <label htmlFor={`inquiry-${name}`} className="text-xs font-medium text-slate-700 sm:pt-2.5 sm:text-[13px]">
        {label}{optional ? <span className="ml-1 font-normal text-slate-500 sm:mt-0.5 sm:ml-0 sm:block sm:text-[11px]">(opsional)</span> : <span className="ml-0.5 text-[#C41926]">*</span>}
      </label>
      <div className="min-w-0">
        {children}
        {error ? <p id={`inquiry-${name}-error`} className="mt-1 text-xs text-red-700">{error}</p>
          : hint ? <p id={`inquiry-${name}-hint`} className="mt-0.5 text-xs leading-snug text-slate-500">{hint}</p> : null}
      </div>
    </div>
  </div>;
}

export default function SpaceInquiryForm({ spaceId, spaceCode, spaceName, stationName, area, details, canApply, onStageChange, onExplore }: {
  spaceId: string; spaceCode: string; spaceName?: string; stationName: string; area: number; details: ReactNode; canApply: boolean; onStageChange: (stage: SpaceInquiryStage) => void; onExplore: () => void;
}) {
  const router = useRouter();
  const [auth, setAuth] = useState<AuthState>({ kind: "loading" });
  const [authAttempt, setAuthAttempt] = useState(0);
  const [submission, setSubmission] = useState<Submission>({ kind: "details" });
  const [accountMode, setAccountMode] = useState<"register" | "login">("register");
  const [loginError, setLoginError] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);
  const [form, setForm] = useState({ contactName: "", companyName: "", phone: "", email: "", password: "", businessUse: "Vending Machine", customBusinessUse: "", surveyPreference: "", message: "" });
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
    announceAuthLogin(parsed.data, "login");
    router.refresh();
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
      businessType: form.businessUse === "Lainnya" ? form.customBusinessUse : form.businessUse,
    });
    const nextErrors: Record<string, string> = {};
    if (!parsed.success) for (const issue of parsed.error.issues) {
      const name = issue.path[0];
      if (typeof name === "string") nextErrors[name === "businessType" ? "customBusinessUse" : name] = issue.message;
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
    setSubmission({ kind: "review", identity: parsed.data });
  }

  async function submit() {
    if (submission.kind !== "review" || sending.current || auth.kind !== "ready") return;
    sending.current = true;
    setPending(true);
    setSubmitError("");
    const data = submission.identity;
    try {
      const response = await fetch(partner ? "/api/partner/leads" : "/api/leads", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          spaceId, contactName: data.contactName, companyName: data.companyName, phone: data.phone,
          businessType: data.businessType, surveyPreference: data.surveyPreference || undefined,
          message: data.message || undefined,
          ...(!partner ? { email: data.email, password: form.password, spaceRequirement: `${area} m²` } : {}),
        }),
      });
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const error = errorSchema.safeParse(body);
        throw new Error(error.success ? error.data.error : "Pengajuan gagal dikirim. Silakan coba lagi.");
      }
      const receipt = receiptSchema.safeParse(body);
      if (!receipt.success) throw new Error("Respons pengajuan tidak valid. Periksa daftar pengajuan sebelum mencoba lagi.");
      setForm(current => ({ ...current, password: "" }));
      notifyPartnerLeadsUpdated();
      notifyCmsLeadsUpdated();
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
      contactName: "Budi Santoso", companyName: "PT Contoh / Brand", phone: "081234567890", email: "nama@perusahaan.com", customBusinessUse: "Jenis usaha Anda",
    };
    return <input id={`inquiry-${name}`} name={name} type={type} autoComplete={autoComplete}
      required value={form[name]} maxLength={maxLength} placeholder={placeholders[name]}
      onChange={event => update(name, event.target.value)} className={controlClass}
      aria-invalid={Boolean(errors[name])} aria-describedby={errors[name] ? `inquiry-${name}-error` : undefined} />;
  }

  function renderPasswordField(mode: "register" | "login") {
    return <Field name="password" label="Password akun mitra" error={errors.password} hint={mode === "register" ? "Akun dibuat saat pengajuan dikirim." : undefined}>
      <div className="relative">
        <input id="inquiry-password" type={showPassword ? "text" : "password"} required autoComplete={mode === "login" ? "current-password" : "new-password"} minLength={8} maxLength={128}
          value={form.password} placeholder={mode === "login" ? "Password Anda" : "Minimal 8 karakter"} onChange={event => update("password", event.target.value)} className={cn(controlClass, "pr-11")}
          aria-invalid={Boolean(errors.password)} aria-describedby={errors.password ? "inquiry-password-error" : mode === "register" ? "inquiry-password-hint" : undefined} />
        <button type="button" aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"} aria-pressed={showPassword} onClick={() => setShowPassword(value => !value)} className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-lg text-slate-500 hover:text-slate-900">{showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button>
      </div>
    </Field>;
  }

  return <div className="flex min-h-0 flex-1 flex-col bg-white text-slate-900">
    <div className="shrink-0 border-b border-slate-200 px-5 py-3 lg:px-7 lg:py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 ref={headingRef} tabIndex={-1} className="text-sm font-semibold outline-none sm:text-base">Alur Pengajuan Sewa</h2>
        <p aria-live="polite" className="text-xs font-semibold text-slate-600 sm:text-sm">{STAGE_NUMBERS[submission.kind]} / 4 {STAGE_LABELS[submission.kind]}</p>
      </div>
      <div role="progressbar" aria-label="Progres pengajuan sewa" aria-valuemin={1} aria-valuemax={4} aria-valuenow={STAGE_NUMBERS[submission.kind]} aria-valuetext={STAGE_LABELS[submission.kind]} className="mt-2 grid grid-cols-4 gap-2">
        {[1, 2, 3, 4].map(step => <span key={step} className={cn("h-1.5 rounded-full transition-colors", step <= STAGE_NUMBERS[submission.kind] ? "bg-[#E31E2D]" : "bg-slate-200")} />)}
      </div>
    </div>

    {submission.kind === "details" ? <>
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-2 lg:px-7 lg:py-1">{details}</div>
      <div className="grid shrink-0 grid-cols-2 gap-2.5 border-t border-slate-200 bg-white px-5 pt-3 pb-[max(0.875rem,env(safe-area-inset-bottom))] lg:block lg:px-7 lg:py-3.5">
        <button type="button" onClick={onExplore} className={cn(backButtonClass, "w-full px-2.5 text-xs sm:px-3 sm:text-sm lg:hidden")}>Lanjut Jelajahi</button>
        <button type="button" disabled={!canApply} onClick={() => { interacted.current = true; setSubmission({ kind: "form" }); }} className={cn(primaryClass, "gap-1.5 px-2.5 text-xs disabled:cursor-not-allowed sm:gap-2 sm:px-4 sm:text-sm")}>{canApply ? <><span>Ajukan Minat Sewa</span><ArrowRight className="size-4 shrink-0" /></> : "Ruang belum tersedia"}</button>
      </div>
    </> : auth.kind === "loading" ? <div className="flex flex-1 items-center justify-center gap-2 p-6 text-sm text-slate-600" role="status"><Loader2 className="size-4 animate-spin" />Memuat formulir...</div>
    : auth.kind === "error" ? <div className="space-y-3 p-7" role="alert"><p className="text-sm">Sesi belum dapat diperiksa.</p><button type="button" className={primaryClass} onClick={() => { setAuth({ kind: "loading" }); setAuthAttempt(value => value + 1); }}>Coba lagi</button></div>
    : submission.kind === "success" ? <InquiryConfirmation id={submission.id} inquiryCode={submission.inquiryCode} workflowSteps={submission.workflowVersion?.steps} status={submission.status} spaceCode={spaceCode} stationName={stationName} onClose={onExplore} />
    : submission.kind === "review" ? <>
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 lg:px-7">
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs text-slate-600">
          Mengajukan minat untuk unit <strong className="font-semibold text-slate-900">{spaceCode}</strong>{spaceName && spaceName !== spaceCode ? ` (${spaceName})` : ""} · Stasiun {stationName}
        </div>
        <dl className="mt-3 divide-y divide-slate-200/80 rounded-xl border border-slate-200 bg-white">
          {[
            ["Nama penanggung jawab", submission.identity.contactName], ["Perusahaan / brand", submission.identity.companyName],
            ["WhatsApp", submission.identity.phone], ["Email", submission.identity.email], ["Peruntukan usaha", submission.identity.businessType],
            ["Preferensi survei", submission.identity.surveyPreference], ["Catatan kebutuhan", submission.identity.message],
          ].filter(([, value]) => value).map(([label, value]) => <div key={label} className="grid grid-cols-1 gap-1 px-4 py-2.5 sm:grid-cols-[168px_minmax(0,1fr)] sm:gap-3">
            <dt className="text-xs font-medium text-slate-500 sm:pt-0.5 sm:text-[13px]">{label}</dt>
            <dd className="min-w-0 whitespace-pre-wrap break-words text-sm font-medium text-slate-900">{value}</dd>
          </div>)}
        </dl>
        <p className="mt-3.5 rounded-lg border border-slate-200 bg-slate-50/80 px-3.5 py-2.5 text-xs leading-relaxed text-slate-600">Pengajuan minat belum merupakan pemesanan atau perjanjian sewa.</p>
        {submitError && <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{submitError}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-3 border-t border-slate-200 bg-white px-5 pt-3 pb-[max(0.875rem,env(safe-area-inset-bottom))] lg:px-7 lg:py-3.5">
        <button type="button" disabled={pending} onClick={() => setSubmission({ kind: "form" })} className={backButtonClass}><ArrowLeft className="size-4" />Edit Data</button>
        <button type="button" onClick={() => void submit()} disabled={pending} className={cn(primaryClass, "flex-1")}>{pending ? <><Loader2 className="size-4 animate-spin" />Mengirim...</> : <>Kirim Pengajuan<ArrowRight className="size-4" /></>}</button>
      </div>
    </> : <form onSubmit={!partner && accountMode === "login" ? login : review} noValidate className="flex min-h-0 flex-1 flex-col">
      <div ref={scrollRef} className="min-h-0 flex-1 space-y-2.5 overflow-y-auto overscroll-contain px-5 py-3.5 lg:px-7">
        {!partner && <div className="space-y-2">
          <div role="group" aria-label="Akun mitra" className="grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1">
            {(["register", "login"] satisfies ("register" | "login")[]).map(mode => <button key={mode} type="button" aria-pressed={accountMode === mode} disabled={loggingIn} onClick={() => { setAccountMode(mode); setLoginError(""); setErrors({}); }} className={cn("min-h-8 rounded-md px-3 text-sm font-medium transition", accountMode === mode ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900")}>{mode === "register" ? "Daftar Akun" : "Masuk"}</button>)}
          </div>
          <GoogleSignInButton label={accountMode === "login" ? "Masuk dengan Google" : "Daftar dengan Google"} className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 transition hover:bg-slate-50 disabled:opacity-60" disabled={loggingIn} onSuccess={acceptLogin} onError={setLoginError} />
          <div className="flex items-center gap-3 text-xs text-slate-500">
            <span aria-hidden="true" className="h-px flex-1 bg-slate-200" />
            <span>atau dengan email</span>
            <span aria-hidden="true" className="h-px flex-1 bg-slate-200" />
          </div>
        </div>}
        {loginError && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{loginError}</p>}
        {(partner || accountMode === "register") ? <div className="space-y-2">
          <Field name="contactName" label="Nama kontak" error={errors.contactName}>{input("contactName", "text", "name", 160)}</Field>
          <Field name="companyName" label="Perusahaan / brand" error={errors.companyName}>{input("companyName", "text", "organization", 160)}</Field>
          <Field name="phone" label="No. WhatsApp aktif" error={errors.phone}>{input("phone", "tel", "tel", 32)}</Field>
          <Field name="email" label="Email bisnis" error={errors.email} hint={partner ? "Menggunakan email akun mitra aktif" : undefined}>
            {partner ? <input id="inquiry-email" type="email" value={partner.email} readOnly className={cn(controlClass, "cursor-default bg-slate-50 text-slate-600 hover:border-slate-300")} /> : input("email", "email", "email", 254)}
          </Field>
          {!partner && renderPasswordField("register")}
          <Field name="businessUse" label="Peruntukan usaha">
            <select id="inquiry-businessUse" value={form.businessUse} onChange={event => update("businessUse", event.target.value)} className={controlClass}>
              {BUSINESS_OPTIONS.map(option => <option key={option}>{option}</option>)}
            </select>
          </Field>
          {form.businessUse === "Lainnya" && <Field name="customBusinessUse" label="Jenis usaha Anda" error={errors.customBusinessUse}>{input("customBusinessUse", "text", undefined, 120)}</Field>}
          <Field name="surveyPreference" label="Jadwal survei" optional error={errors.surveyPreference}>
            <input id="inquiry-surveyPreference" type="text" value={form.surveyPreference} maxLength={500} placeholder="Hari atau waktu yang diinginkan" className={controlClass} onChange={event => update("surveyPreference", event.target.value)} />
          </Field>
          <Field name="message" label="Catatan kebutuhan" optional error={errors.message}>
            <textarea id="inquiry-message" rows={2} maxLength={2000} value={form.message} placeholder="Kebutuhan ruang, dimensi peralatan, atau pertanyaan survei" onChange={event => update("message", event.target.value)} className={cn(controlClass, "min-h-[52px] resize-y")} aria-invalid={Boolean(errors.message)} aria-describedby={errors.message ? "inquiry-message-error" : undefined} />
          </Field>
        </div> : <div className="space-y-2.5">
          <Field name="email" label="Email bisnis" error={errors.email}>{input("email", "email", "email", 254)}</Field>
          {renderPasswordField("login")}
        </div>}
      </div>
      <div className="flex shrink-0 items-center gap-3 border-t border-slate-200 bg-white px-5 pt-3 pb-[max(0.875rem,env(safe-area-inset-bottom))] lg:px-7 lg:py-3.5">
        <button type="button" onClick={() => setSubmission({ kind: "details" })} className={backButtonClass}><ArrowLeft className="size-4" />Kembali</button>
        <button type="submit" disabled={loggingIn} className={cn(primaryClass, "flex-1")}>{loggingIn ? <><Loader2 className="size-4 animate-spin" />Memproses...</> : <>{!partner && accountMode === "login" ? "Masuk & Lanjutkan" : "Review Pengajuan"}<ArrowRight className="size-4" /></>}</button>
      </div>
    </form>}
  </div>;
}
