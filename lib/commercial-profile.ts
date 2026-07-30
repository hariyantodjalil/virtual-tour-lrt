import { prisma } from "@/lib/prisma";
import {
  DEFAULT_COMMERCIAL_PROFILE,
  mergeCommercialProfile,
  type CommercialProfileData,
} from "@/lib/commercial-profile-shared";

export async function getCommercialProfile(): Promise<CommercialProfileData> {
  try {
    const profile = await prisma.commercialProfile.findUnique({
      where: { id: "default" },
      select: {
        teamName: true,
        contactPersonName: true,
        whatsappNumber: true,
        phoneNumber: true,
        email: true,
        officeAddress: true,
        defaultWhatsappMessage: true,
      },
    });
    return mergeCommercialProfile(profile);
  } catch {
    return DEFAULT_COMMERCIAL_PROFILE;
  }
}
