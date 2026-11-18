import { fal } from "@fal-ai/client";

/** Endpoint resmi FLUX.1 Kontext [pro] — image edit berbasis teks + gambar. */
export const FAL_FLUX_KONTEXT_ENDPOINT = "fal-ai/flux-pro/kontext" as const;

let configured = false;

/**
 * Konfigurasi kredensial Fal di sisi server saja.
 * Jangan panggil dari client component / browser.
 */
export function getFalClient() {
  const key = process.env.FAL_KEY?.trim();
  if (!key) {
    throw new FalConfigError(
      "FAL_KEY belum diatur. Tambahkan ke file .env server, lalu restart app."
    );
  }
  if (!configured) {
    fal.config({ credentials: key });
    configured = true;
  }
  return fal;
}

export function isFalConfigured(): boolean {
  return Boolean(process.env.FAL_KEY?.trim());
}

export class FalConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FalConfigError";
  }
}

export type FluxKontextResult = {
  images: Array<{ url: string; width?: number; height?: number }>;
  seed?: number;
  prompt?: string;
  has_nsfw_concepts?: boolean[];
};

/**
 * Edit gambar lewat FLUX.1 Kontext [pro].
 * `imageUrl` harus URL publik yang bisa di-fetch Fal (biasanya hasil fal.storage.upload).
 */
export async function runFluxKontextEdit(input: {
  prompt: string;
  imageUrl: string;
  seed?: number;
  guidanceScale?: number;
  enhancePrompt?: boolean;
  outputFormat?: "jpeg" | "png";
}): Promise<{ data: FluxKontextResult; requestId: string }> {
  const client = getFalClient();
  const result = await client.subscribe(FAL_FLUX_KONTEXT_ENDPOINT, {
    input: {
      prompt: input.prompt,
      image_url: input.imageUrl,
      ...(input.seed !== undefined ? { seed: input.seed } : {}),
      ...(input.guidanceScale !== undefined
        ? { guidance_scale: input.guidanceScale }
        : {}),
      enhance_prompt: input.enhancePrompt ?? false,
      output_format: input.outputFormat ?? "jpeg",
      num_images: 1,
    },
    logs: false,
  });

  const data = result.data as FluxKontextResult;
  if (!data?.images?.[0]?.url) {
    throw new Error("Respons Fal tidak berisi URL gambar hasil");
  }

  return { data, requestId: result.requestId };
}

/** Upload buffer gambar ke storage Fal agar dapat `image_url` publik. */
export async function uploadBufferToFalStorage(
  buffer: Buffer,
  filename: string,
  contentType: string
): Promise<string> {
  const client = getFalClient();
  const bytes = new Uint8Array(buffer);
  const file = new File([bytes], filename, { type: contentType });
  return client.storage.upload(file);
}
