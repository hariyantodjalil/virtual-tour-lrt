import { Suspense } from "react";
import CmsLoginForm from "./CmsLoginForm";

export default function CmsLoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950" />}>
      <CmsLoginForm />
    </Suspense>
  );
}
