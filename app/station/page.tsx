import { redirect } from "next/navigation";
import { getDefaultStationTourSlug } from "@/lib/station-tour-entry";
import { VIRTUAL_TOUR_LANDING } from "@/lib/tour-nav";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ pilih?: string }>;
};

export default async function StationTourEntryPage({ searchParams }: Props) {
  const slug = await getDefaultStationTourSlug();
  if (!slug) redirect(VIRTUAL_TOUR_LANDING);

  const { pilih } = await searchParams;
  const withPicker = pilih === "1" || pilih === "true" ? "?pilih=1" : "";
  redirect(`/station/${slug}${withPicker}`);
}
