import Link from "next/link";
import { redirect } from "next/navigation";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { getCmsSessionUser } from "@/lib/cms-session";
import { prisma } from "@/lib/prisma";
import { tourTranslationSource } from "@/lib/tour-language";

const route = "/cms/tour-translations";
const translationSchema = z.object({ source: z.string().trim().min(1).max(5000), english: z.string().trim().min(1).max(5000) });

async function saveTranslation(formData: FormData) {
  "use server";
  const user = await getCmsSessionUser();
  if (user?.role !== "ADMIN") redirect("/cms");
  const result = translationSchema.safeParse({ source: formData.get("source"), english: formData.get("english") });
  if (!result.success) redirect(`${route}?result=invalid`);
  const source = tourTranslationSource(result.data.source);
  await prisma.tourContentTranslation.upsert({
    where: { source },
    create: { source, english: result.data.english },
    update: { english: result.data.english },
  });
  redirect(`${route}?${new URLSearchParams({ source, result: "saved" })}`);
}

export default async function TourTranslationsPage({ searchParams }: {
  searchParams: Promise<{ q?: string; source?: string; result?: string }>;
}) {
  const user = await getCmsSessionUser();
  if (user?.role !== "ADMIN") redirect("/cms");
  const { q, source, result } = await searchParams;
  const query = typeof q === "string" ? q.trim().slice(0, 200) : "";
  const selectedSource = typeof source === "string" ? tourTranslationSource(source).slice(0, 5000) : "";
  const [items, selected] = await Promise.all([
    prisma.tourContentTranslation.findMany({
      where: query ? { OR: [
        { source: { contains: query, mode: "insensitive" } },
        { english: { contains: query, mode: "insensitive" } },
      ] } : undefined,
      orderBy: { source: "asc" }, take: 40,
    }),
    selectedSource ? prisma.tourContentTranslation.findUnique({ where: { source: selectedSource } }) : null,
  ]);

  return (
    <div className="mx-auto grid max-w-5xl gap-5 p-4 sm:p-6">
      <h1 className="text-2xl font-semibold">Terjemahan Tur</h1>
      <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <section className="min-w-0 space-y-3">
          <form className="flex items-end gap-2">
            <label className="grid min-w-0 flex-1 gap-1.5 text-sm">
              Cari Indonesia atau Inggris
              <Input type="search" name="q" defaultValue={query} />
            </label>
            <Button type="submit" variant="outline">Cari</Button>
          </form>
          <ul className="max-h-[65dvh] divide-y divide-[var(--work-line)] overflow-y-auto rounded-lg border border-[var(--work-line)]">
            {items.map(item => (
              <li key={item.source}>
                <Link className="block break-words px-3 py-2 text-sm hover:bg-[var(--work-subtle)]"
                  aria-current={item.source === selectedSource ? "true" : undefined}
                  href={`${route}?${new URLSearchParams({ source: item.source, ...(query ? { q: query } : {}) })}`}>
                  <span className="block line-clamp-2 font-medium">{item.source}</span>
                  <span className="block line-clamp-2 text-[var(--work-muted)]">{item.english}</span>
                </Link>
              </li>
            ))}
            {!items.length && <li className="p-3 text-sm">Terjemahan tidak ditemukan.</li>}
          </ul>
        </section>
        <form action={saveTranslation} className="grid min-w-0 content-start gap-3 rounded-lg border border-[var(--work-line)] p-4">
          <h2 className="font-semibold">{selected ? "Edit terjemahan" : "Tambah terjemahan"}</h2>
          {result === "saved" && <p role="status" className="text-sm text-emerald-700">Terjemahan tersimpan.</p>}
          {result === "invalid" && <p role="alert" className="text-sm text-red-700">Isi teks sumber dan terjemahan.</p>}
          <label className="grid gap-1.5 text-sm">
            Teks asli
            <Textarea name="source" defaultValue={selected?.source ?? ""} key={selectedSource} readOnly={Boolean(selected)} required maxLength={5000} rows={3} />
          </label>
          <label className="grid gap-1.5 text-sm">
            Terjemahan Inggris
            <Textarea name="english" defaultValue={selected?.english ?? ""} key={selectedSource} required maxLength={5000} rows={4} />
          </label>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {selected && <Button asChild variant="ghost"><Link href={route}>Tambah baru</Link></Button>}
            <Button type="submit">Simpan</Button>
          </div>
        </form>
      </div>
    </div>
  );
}
