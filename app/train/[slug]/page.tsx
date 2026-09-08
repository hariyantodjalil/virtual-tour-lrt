import { notFound, redirect } from "next/navigation";
import { getTrainBySlug } from "@/lib/trains-data";
import { DEFAULT_TRAIN_SLUG } from "@/lib/train-constants";
import TrainTourClient from "./TrainTourClient";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const train = await getTrainBySlug(slug === "default" ? DEFAULT_TRAIN_SLUG : slug);
  if (!train) return { title: "Kereta Tidak Ditemukan" };
  return {
    title: `Train Virtual Tour ${train.name} - LRT Jabodebek`,
    description: `Jelajahi interior kereta ${train.name} LRT Jabodebek secara virtual 360°.`,
  };
}

export default async function TrainPage({ params }: Props) {
  const { slug } = await params;
  const resolvedSlug = slug === "default" ? DEFAULT_TRAIN_SLUG : slug;
  const trainInfo = await getTrainBySlug(resolvedSlug);

  if (!trainInfo) {
    if (slug !== DEFAULT_TRAIN_SLUG) redirect(`/train/${DEFAULT_TRAIN_SLUG}`);
    notFound();
  }

  if (trainInfo.scenes.length === 0) {
    notFound();
  }

  return <TrainTourClient trainInfo={trainInfo} />;
}
