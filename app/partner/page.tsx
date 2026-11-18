import { redirect } from "next/navigation";

/** Entry point `/partner` diarahkan ke sub-rute default `/partner/dashboard`. */
export default function PartnerPage() {
  redirect("/partner/dashboard");
}
