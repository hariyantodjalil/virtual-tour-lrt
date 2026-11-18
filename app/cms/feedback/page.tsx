import { prisma } from "@/lib/prisma";
import FeedbackClient from "./FeedbackClient";

export const dynamic = "force-dynamic";

async function getFeedbacks() {
  try {
    const feedbacks = await prisma.partnerFeedback.findMany({
      orderBy: { createdAt: "desc" },
      take: 200,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });
    return {
      feedbacks: feedbacks.map((item) => ({
        id: item.id,
        topic: item.topic,
        message: item.message,
        createdAt: item.createdAt.toISOString(),
        user: item.user,
      })),
      error: null as string | null,
    };
  } catch {
    return {
      feedbacks: [],
      error: "Data feedback gagal dimuat. Coba muat ulang halaman.",
    };
  }
}

export default async function CmsFeedbackPage() {
  const data = await getFeedbacks();
  return <FeedbackClient initialFeedbacks={data.feedbacks} initialError={data.error} />;
}
