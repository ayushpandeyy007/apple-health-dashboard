import type { HealthSummary, WorkerMessage } from "./types";

export interface ImportProgress {
  loaded: number;
  total: number;
  records: number;
}

/** Parse an export.zip / export.xml in a Web Worker so the page stays responsive. */
export function importHealthFile(
  file: File,
  onProgress: (p: ImportProgress) => void,
): { promise: Promise<HealthSummary>; cancel: () => void } {
  const worker = new Worker(new URL("./parse.worker.ts", import.meta.url), { type: "module" });
  const promise = new Promise<HealthSummary>((resolve, reject) => {
    worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
      const msg = event.data;
      if (msg.type === "progress") onProgress(msg);
      else {
        worker.terminate();
        if (msg.type === "done") resolve(msg.summary);
        else reject(new Error(msg.message));
      }
    };
    worker.onerror = (event) => {
      worker.terminate();
      reject(new Error(event.message || "Something went wrong while reading the file."));
    };
    worker.postMessage({ file });
  });
  return { promise, cancel: () => worker.terminate() };
}

/**
 * macOS unzips export.zip into an `apple_health_export` folder when you
 * double-click it. If that folder is dropped, find the export XML inside it.
 */
export async function fileFromDrop(items: DataTransferItemList): Promise<File | null> {
  const item = items[0];
  const entry = item?.webkitGetAsEntry?.();
  if (!entry) return item?.getAsFile() ?? null;
  if (entry.isFile) return item.getAsFile();

  const files: FileSystemFileEntry[] = [];
  const walk = async (dir: FileSystemDirectoryEntry, depth: number): Promise<void> => {
    const reader = dir.createReader();
    for (;;) {
      const batch = await new Promise<FileSystemEntry[]>((res, rej) => reader.readEntries(res, rej));
      if (!batch.length) break;
      for (const e of batch) {
        if (e.isFile && /\.xml$/i.test(e.name) && !/cda/i.test(e.name)) files.push(e as FileSystemFileEntry);
        else if (e.isDirectory && depth < 2 && !/workout-routes|electrocardiograms/i.test(e.name)) {
          await walk(e as FileSystemDirectoryEntry, depth + 1);
        }
      }
    }
  };
  await walk(entry as FileSystemDirectoryEntry, 0);
  const all = await Promise.all(files.map((f) => new Promise<File>((res, rej) => f.file(res, rej))));
  return all.sort((a, b) => b.size - a.size)[0] ?? null;
}
