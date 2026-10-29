"use client";

import { useState } from "react";
import {
  Building2,
  CheckCircle2,
  ExternalLink,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  Save,
  UserRound,
} from "lucide-react";
import { cmsFetch } from "@/lib/cms-fetch";
import {
  COMMERCIAL_PROFILE_UPDATED_EVENT,
  mergeCommercialProfile,
  type CommercialProfileData,
} from "@/lib/commercial-profile-shared";
import { getWhatsAppUrl } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export default function CommercialProfileClient({
  initialProfile,
}: {
  initialProfile: CommercialProfileData;
}) {
  const [profile, setProfile] = useState(() =>
    mergeCommercialProfile(initialProfile)
  );
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  function update<K extends keyof CommercialProfileData>(
    key: K,
    value: CommercialProfileData[K]
  ) {
    setProfile((current) => ({ ...current, [key]: value }));
    setMessage("");
    setError("");
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");

    const response = await cmsFetch("/api/cms/commercial-profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(profile),
    }).catch(() => null);

    if (!response?.ok) {
      const data = await response?.json().catch(() => null);
      setError(data?.error ?? "Gagal menyimpan profil tim komersial.");
      setSaving(false);
      return;
    }

    const updated = mergeCommercialProfile(await response.json());
    setProfile(updated);
    window.dispatchEvent(
      new CustomEvent(COMMERCIAL_PROFILE_UPDATED_EVENT, { detail: updated })
    );
    setMessage(
      "Profil tersimpan. Seluruh kontak publik sekarang menggunakan data terbaru."
    );
    setSaving(false);
  }

  const previewWhatsAppUrl = getWhatsAppUrl(
    profile.whatsappNumber,
    profile.defaultWhatsappMessage
  );

  return (
    <div className="mx-auto max-w-5xl">
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <Card className="border-[rgba(255,214,218,0.14)] bg-[#3A161C] text-[#F8ECEE]">
          <CardContent className="p-5">
            <form onSubmit={save} className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="Nama Tim"
                  icon={<Building2 className="h-4 w-4" />}
                >
                  <Input
                    required
                    value={profile.teamName}
                    onChange={(event) => update("teamName", event.target.value)}
                    className="border-[rgba(255,214,218,0.14)] bg-[#1C0A0E]"
                    placeholder="Tim Komersial LRT Jabodebek"
                  />
                </Field>

                <Field
                  label="Nama Contact Person"
                  icon={<UserRound className="h-4 w-4" />}
                >
                  <Input
                    value={profile.contactPersonName ?? ""}
                    onChange={(event) =>
                      update("contactPersonName", event.target.value || null)
                    }
                    className="border-[rgba(255,214,218,0.14)] bg-[#1C0A0E]"
                    placeholder="Opsional"
                  />
                </Field>

                <Field
                  label="Nomor WhatsApp Utama"
                  icon={<MessageCircle className="h-4 w-4" />}
                  hint="Gunakan 62 sebagai pengganti angka 0 di depan."
                >
                  <Input
                    required
                    inputMode="tel"
                    value={profile.whatsappNumber}
                    onChange={(event) =>
                      update("whatsappNumber", event.target.value)
                    }
                    className="border-[rgba(255,214,218,0.14)] bg-[#1C0A0E]"
                    placeholder="628118012012"
                  />
                </Field>

                <Field
                  label="Nomor Telepon"
                  icon={<Phone className="h-4 w-4" />}
                  hint="Opsional, untuk kontak telepon non-WhatsApp."
                >
                  <Input
                    inputMode="tel"
                    value={profile.phoneNumber ?? ""}
                    onChange={(event) =>
                      update("phoneNumber", event.target.value || null)
                    }
                    className="border-[rgba(255,214,218,0.14)] bg-[#1C0A0E]"
                    placeholder="021..."
                  />
                </Field>

                <Field label="Email" icon={<Mail className="h-4 w-4" />}>
                  <Input
                    type="email"
                    value={profile.email ?? ""}
                    onChange={(event) =>
                      update("email", event.target.value || null)
                    }
                    className="border-[rgba(255,214,218,0.14)] bg-[#1C0A0E]"
                    placeholder="komersial@lrtjabodebek.co.id"
                  />
                </Field>

                <Field
                  label="Alamat Kantor"
                  icon={<MapPin className="h-4 w-4" />}
                >
                  <Input
                    value={profile.officeAddress ?? ""}
                    onChange={(event) =>
                      update("officeAddress", event.target.value || null)
                    }
                    className="border-[rgba(255,214,218,0.14)] bg-[#1C0A0E]"
                    placeholder="Opsional"
                  />
                </Field>
              </div>

              <Field
                label="Pesan WhatsApp Default"
                icon={<MessageCircle className="h-4 w-4" />}
                hint="Dipakai ketika pengunjung menekan tombol Reno dari halaman umum."
              >
                <Textarea
                  required
                  rows={4}
                  value={profile.defaultWhatsappMessage}
                  onChange={(event) =>
                    update("defaultWhatsappMessage", event.target.value)
                  }
                  className="border-[rgba(255,214,218,0.14)] bg-[#1C0A0E]"
                />
              </Field>

              {error && (
                <p role="alert" className="text-sm text-red-300">
                  {error}
                </p>
              )}
              {message && (
                <p
                  role="status"
                  className="flex items-center gap-2 text-sm text-emerald-300"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  {message}
                </p>
              )}

              <Button type="submit" disabled={saving} className="min-w-40">
                <Save className="h-4 w-4" />
                {saving ? "Menyimpan..." : "Simpan Profil"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <aside className="space-y-4">
          <Card className="border-[rgba(255,214,218,0.14)] bg-[#3A161C] text-[#F8ECEE]">
            <CardContent className="p-5">
              <p className="text-xs font-semibold text-[#A88990]">Preview kontak</p>
              <h2 className="mt-2 font-semibold text-white">{profile.teamName}</h2>
              {profile.contactPersonName && (
                <p className="mt-1 text-sm text-[#C4A8AD]">
                  {profile.contactPersonName}
                </p>
              )}
              <dl className="mt-4 space-y-3 text-sm">
                <ContactRow
                  icon={<MessageCircle className="h-4 w-4" />}
                  value={profile.whatsappNumber}
                />
                {profile.phoneNumber && (
                  <ContactRow
                    icon={<Phone className="h-4 w-4" />}
                    value={profile.phoneNumber}
                  />
                )}
                {profile.email && (
                  <ContactRow
                    icon={<Mail className="h-4 w-4" />}
                    value={profile.email}
                  />
                )}
                {profile.officeAddress && (
                  <ContactRow
                    icon={<MapPin className="h-4 w-4" />}
                    value={profile.officeAddress}
                  />
                )}
              </dl>
              <a
                href={previewWhatsAppUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#25D366] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1DA851]"
              >
                <ExternalLink className="h-4 w-4" />
                Tes WhatsApp
              </a>
            </CardContent>
          </Card>

          <p className="rounded-xl border border-[rgba(255,214,218,0.14)] bg-[#3A161C]/70 p-4 text-xs leading-relaxed text-[#C4A8AD]">
            Nomor WhatsApp pada profil stasiun hanya digunakan sebagai override.
            Kosongkan nomor stasiun agar otomatis mengikuti profil global ini.
          </p>
        </aside>
      </div>
    </div>
  );
}

function Field({
  label,
  icon,
  hint,
  children,
}: {
  label: string;
  icon: React.ReactNode;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <Label className="mb-1.5 flex items-center gap-2 text-xs text-[#F0DDE1]">
        <span className="text-emerald-300">{icon}</span>
        {label}
      </Label>
      {children}
      {hint && <p className="mt-1 text-xs text-[#A88990]">{hint}</p>}
    </div>
  );
}

function ContactRow({
  icon,
  value,
}: {
  icon: React.ReactNode;
  value: string;
}) {
  return (
    <div className="flex items-start gap-2.5 text-[#F0DDE1]">
      <span className="mt-0.5 text-emerald-300">{icon}</span>
      <span className="break-words">{value}</span>
    </div>
  );
}
