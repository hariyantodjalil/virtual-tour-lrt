import Link from "next/link";
import { redirect } from "next/navigation";
import { ShieldAlert } from "lucide-react";
import { getAllWorkflowVersions } from "@/lib/cms-workflow";
import { getServerSessionUser } from "@/lib/session-server";
import WorkflowBuilderClient from "./WorkflowBuilderClient";

export const dynamic = "force-dynamic";

export default async function CmsWorkflowPage() {
  const user = await getServerSessionUser();
  if (!user) {
    redirect("/login?redirect=/cms/workflow&reason=expired");
  }

  if (user.role !== "ADMIN") {
    return (
      <div className="mx-auto max-w-xl py-12">
        <div className="rounded-xl border border-rose-200 bg-white p-6 text-center shadow-sm">
          <div className="mx-auto flex size-11 items-center justify-center rounded-full bg-rose-50 text-[#c41230]">
            <ShieldAlert className="size-5" />
          </div>
          <h1 className="mt-3 text-base font-bold text-[#101828]">
            Akses Khusus Administrator
          </h1>
          <p className="mt-1.5 text-xs leading-relaxed text-slate-600">
            Pengelolaan versi alur pengajuan (Workflow Builder) hanya dapat dibuka oleh akun Admin.
          </p>
          <Link
            href="/cms/dashboard"
            className="mt-4 inline-flex h-9 items-center justify-center rounded-lg bg-[#c41230] px-4 text-xs font-semibold text-white hover:bg-[#a60f28]"
          >
            Kembali ke Dashboard CMS
          </Link>
        </div>
      </div>
    );
  }

  const initialVersions = await getAllWorkflowVersions();
  return <WorkflowBuilderClient initialVersions={initialVersions} />;
}
