import { getCommercialProfile } from "@/lib/commercial-profile";
import CommercialProfileClient from "./CommercialProfileClient";

export const dynamic = "force-dynamic";

export default async function CommercialProfilePage() {
  const profile = await getCommercialProfile();
  return <CommercialProfileClient initialProfile={profile} />;
}
