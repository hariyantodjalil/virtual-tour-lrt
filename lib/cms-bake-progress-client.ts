import type { BakeDoneEvent, BakeStreamEvent } from "./cms-bake-progress";

export type BakeStreamHandlers = {
  onProgress?: (percent: number, label: string) => void;
};

/**
 * Baca respons NDJSON bake blur. Throw Error bila event error / stream rusak.
 */
export async function consumeBakePrivacyBlurStream(
  response: Response,
  handlers: BakeStreamHandlers = {}
): Promise<BakeDoneEvent> {
  if (!response.body) {
    throw new Error("Respons bake kosong");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let doneEvent: BakeDoneEvent | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      let event: BakeStreamEvent;
      try {
        event = JSON.parse(trimmed) as BakeStreamEvent;
      } catch {
        throw new Error("Respons bake tidak valid");
      }
      if (event.type === "progress") {
        handlers.onProgress?.(event.percent, event.label);
      } else if (event.type === "error") {
        throw new Error(event.error || "Gagal bake blur");
      } else if (event.type === "done") {
        doneEvent = event;
      }
    }
  }

  if (buffer.trim()) {
    try {
      const event = JSON.parse(buffer.trim()) as BakeStreamEvent;
      if (event.type === "progress") handlers.onProgress?.(event.percent, event.label);
      else if (event.type === "error") throw new Error(event.error || "Gagal bake blur");
      else if (event.type === "done") doneEvent = event;
    } catch (err) {
      if (err instanceof Error && err.message !== "Respons bake tidak valid") throw err;
      throw new Error("Respons bake tidak valid");
    }
  }

  if (!doneEvent) {
    throw new Error(response.ok ? "Bake selesai tanpa hasil" : "Gagal bake blur");
  }
  return doneEvent;
}
