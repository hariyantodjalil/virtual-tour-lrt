import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ShieldAlert } from "lucide-react";
import { getAllWorkflowVersions, getWorkflowVersionById } from "@/lib/cms-workflow";
import { getCmsSessionUser } from "@/lib/cms-session";
import WorkflowBuilderClient from "../WorkflowBuilderClient";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ id: string }> };

export default async function CmsWorkflowDetailPage({ params }: PageProps) {
  const user = await getCmsSessionUser();
  if (!user) {
    redirect("/login?redirect=/cms/workflow&reason=expired");
  }

  if (user.role !== "ADMIN") {
    return (
      <div className="mx-auto max-w-xl py-12">
        <div className="rounded-xl border border-rose-200 bg-white p-6 text-center shadow-sm">
          <div className="mx-auto flex size-11 items-center justify-center rounded-full bg-rose-50 text-[#D81435]">
            <ShieldAlert className="size-5" />
          </div>
          <h1 className="mt-3 text-base font-bold text-slate-900">
            Akses Khusus Administrator
          </h1>
          <p className="mt-1.5 text-xs leading-relaxed text-slate-600">
            Pengelolaan versi alur pengajuan hanya dapat dibuka oleh akun Admin.
          </p>
          <Link
            href="/cms/dashboard"
            className="mt-4 inline-flex h-9 items-center justify-center rounded-lg bg-[#D81435] px-4 text-xs font-semibold text-white hover:bg-[#B8112D]"
          >
            Kembali ke Dashboard CMS
          </Link>
        </div>
      </div>
    );
  }

  const { id } = await params;
  const target = await getWorkflowVersionById(id);
  if (!target) {
    notFound();
  }

  const initialVersions = await getAllWorkflowVersions();

  return (
    <WorkflowBuilderClient
      initialVersions={initialVersions}
      focusedVersionId={id}
    />
  );
}