export type CommercialProfileData = {
  teamName: string;
  contactPersonName: string | null;
  whatsappNumber: string;
  phoneNumber: string | null;
  email: string | null;
  officeAddress: string | null;
  defaultWhatsappMessage: string;
};

export const COMMERCIAL_PROFILE_UPDATED_EVENT =
  "commercial-profile-updated";

export const DEFAULT_COMMERCIAL_PROFILE: CommercialProfileData = {
  teamName: "Tim Komersial LRT Jabodebek",
  contactPersonName: null,
  whatsappNumber: "628118012012",
  phoneNumber: null,
  email: null,
  officeAddress: null,
  defaultWhatsappMessage:
    "Halo, saya tertarik ruang komersial LRT Jabodebek. Mohon info lebih lanjut.",
};

export function normalizeContactNumber(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.startsWith("0")) return `62${digits.slice(1)}`;
  return digits;
}

export function mergeCommercialProfile(
  value?: Partial<CommercialProfileData> | null
): CommercialProfileData {
  if (!value) return DEFAULT_COMMERCIAL_PROFILE;
  return {
    ...DEFAULT_COMMERCIAL_PROFILE,
    ...value,
    whatsappNumber:
      normalizeContactNumber(value.whatsappNumber ?? "") ||
      DEFAULT_COMMERCIAL_PROFILE.whatsappNumber,
  };
}
