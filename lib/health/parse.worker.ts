import { HealthAggregator } from "./parser";
import type { HealthSummary, WorkerMessage } from "./types";
import { countBytes, isZip, listZip, openEntry, pickExportXml } from "./zip";

// Typed view of the dedicated worker scope (the project compiles against the DOM lib).
const scope = self as unknown as {
  postMessage(message: WorkerMessage): void;
  onmessage: ((event: MessageEvent<{ file: File }>) => void) | null;
};

const BATCH_CHARS = 2 * 1024 * 1024;

scope.onmessage = async (event) => {
  try {
    scope.postMessage({ type: "done", summary: await parse(event.data.file) });
  } catch (err) {
    scope.postMessage({ type: "error", message: err instanceof Error ? err.message : String(err) });
  }
};

async function parse(file: File): Promise<HealthSummary> {
  const agg = new HealthAggregator();
  let total = file.size;
  let loaded = 0;
  let lastPost = 0;
  const onBytes = (n: number) => {
    loaded += n;
    const now = Date.now();
    if (now - lastPost > 100) {
      lastPost = now;
      scope.postMessage({ type: "progress", loaded, total, records: agg.records });
    }
  };

  let bytes: ReadableStream<Uint8Array>;
  if (await isZip(file)) {
    const entry = pickExportXml(await listZip(file));
    if (!entry) {
      throw new Error("Couldn't find export.xml inside this zip. Use the file from Health → Export All Health Data.");
    }
    total = entry.compressedSize;
    bytes = await openEntry(file, entry, onBytes);
  } else {
    bytes = countBytes(file.stream(), onBytes);
  }

  const reader = bytes.pipeThrough(new TextDecoderStream() as unknown as TransformStream<Uint8Array, string>).getReader();
  let head = "";
  let verified = false;
  let batch: string[] = [];
  let batchChars = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!verified) {
      head += value;
      if (head.includes("<HealthData")) verified = true;
      else if (head.length > 4 * 1024 * 1024) {
        throw new Error("This doesn't look like an Apple Health export. Choose export.zip or export.xml.");
      }
    }
    batch.push(value);
    batchChars += value.length;
    if (batchChars >= BATCH_CHARS) {
      agg.push(batch.join(""));
      batch = [];
      batchChars = 0;
    }
  }
  if (!verified) throw new Error("This doesn't look like an Apple Health export. Choose export.zip or export.xml.");
  if (batch.length) agg.push(batch.join(""));

  scope.postMessage({ type: "progress", loaded: total, total, records: agg.records });
  const summary = agg.finish({ fileName: file.name });
  if (!summary.totalRecords && !summary.workouts.length && !summary.activity.length) {
    throw new Error("No health records were found in this export.");
  }
  return summary;
}
