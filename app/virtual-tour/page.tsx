import { redirect } from "next/navigation";
import { VIRTUAL_TOUR_LANDING } from "@/lib/tour-nav";

export default function VirtualTourAliasPage() {
  redirect(VIRTUAL_TOUR_LANDING);
}
