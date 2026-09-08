import { redirect } from "next/navigation";

/** Kereta hanya satu — arahkan ke editor utama. */
export default function LegacyTrainEditorRedirect() {
  redirect("/cms/virtual-train");
}
