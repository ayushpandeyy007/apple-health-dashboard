/**
 * Minimal ZIP reader for Apple's `export.zip`.
 *
 * It reads the central directory (at the end of the file) to find the main
 * export XML, then streams just that entry through the browser's native
 * DecompressionStream - the archive is never loaded into memory. ZIP64 is
 * supported because long-time Apple Watch owners easily pass 4 GB.
 */

export interface ZipEntry {
  name: string;
  method: number;
  compressedSize: number;
  size: number;
  offset: number;
}

const SIG_LOCAL = 0x04034b50;
const SIG_CENTRAL = 0x02014b50;
const SIG_EOCD = 0x06054b50;
const SIG_ZIP64_LOCATOR = 0x07064b50;
const SIG_ZIP64_EOCD = 0x06064b50;
const MAX_U32 = 0xffffffff;

async function read(blob: Blob, start: number, end: number): Promise<DataView> {
  return new DataView(await blob.slice(start, end).arrayBuffer());
}

export async function isZip(file: Blob): Promise<boolean> {
  const head = await read(file, 0, 4);
  return head.byteLength === 4 && head.getUint32(0, true) === SIG_LOCAL;
}

export async function listZip(file: Blob): Promise<ZipEntry[]> {
  // End-of-central-directory record: 22 bytes + an optional comment of up to 64 KB.
  const tailStart = Math.max(0, file.size - (22 + 65_535 + 20));
  const tail = await read(file, tailStart, file.size);
  let eocd = -1;
  for (let i = tail.byteLength - 22; i >= 0; i--) {
    if (tail.getUint32(i, true) === SIG_EOCD) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("This .zip file looks damaged. Try exporting from the Health app again.");

  let count = tail.getUint16(eocd + 10, true);
  let cdSize = tail.getUint32(eocd + 12, true);
  let cdOffset = tail.getUint32(eocd + 16, true);
  if (count === 0xffff || cdSize === MAX_U32 || cdOffset === MAX_U32) {
    const loc = eocd - 20;
    if (loc < 0 || tail.getUint32(loc, true) !== SIG_ZIP64_LOCATOR) throw new Error("Unsupported ZIP64 archive.");
    const z64At = Number(tail.getBigUint64(loc + 8, true));
    const z64 = await read(file, z64At, z64At + 56);
    if (z64.getUint32(0, true) !== SIG_ZIP64_EOCD) throw new Error("Unsupported ZIP64 archive.");
    count = Number(z64.getBigUint64(32, true));
    cdSize = Number(z64.getBigUint64(40, true));
    cdOffset = Number(z64.getBigUint64(48, true));
  }

  const cd = await read(file, cdOffset, cdOffset + cdSize);
  const decoder = new TextDecoder();
  const entries: ZipEntry[] = [];
  let p = 0;
  for (let i = 0; i < count && p + 46 <= cd.byteLength; i++) {
    if (cd.getUint32(p, true) !== SIG_CENTRAL) break;
    const method = cd.getUint16(p + 10, true);
    let compressedSize = cd.getUint32(p + 20, true);
    let size = cd.getUint32(p + 24, true);
    const nameLen = cd.getUint16(p + 28, true);
    const extraLen = cd.getUint16(p + 30, true);
    const commentLen = cd.getUint16(p + 32, true);
    let offset = cd.getUint32(p + 42, true);
    const name = decoder.decode(new Uint8Array(cd.buffer, cd.byteOffset + p + 46, nameLen));

    // ZIP64 extended information: 64-bit values for whichever fields overflowed.
    let e = p + 46 + nameLen;
    const extraEnd = e + extraLen;
    while (e + 4 <= extraEnd) {
      const id = cd.getUint16(e, true);
      const len = cd.getUint16(e + 2, true);
      if (id === 0x0001) {
        let q = e + 4;
        if (size === MAX_U32) { size = Number(cd.getBigUint64(q, true)); q += 8; }
        if (compressedSize === MAX_U32) { compressedSize = Number(cd.getBigUint64(q, true)); q += 8; }
        if (offset === MAX_U32) offset = Number(cd.getBigUint64(q, true));
      }
      e += 4 + len;
    }
    entries.push({ name, method, compressedSize, size, offset });
    p = extraEnd + commentLen;
  }
  return entries;
}

/**
 * The main file is `apple_health_export/export.xml`, but its name is localised
 * in some languages, so pick the largest XML that isn't the clinical (CDA) file.
 */
export function pickExportXml(entries: ZipEntry[]): ZipEntry | undefined {
  return entries
    .filter((e) => {
      const base = e.name.split("/").pop() ?? "";
      return /\.xml$/i.test(base) && !/cda/i.test(base) && !e.name.startsWith("__MACOSX/");
    })
    .sort((a, b) => b.size - a.size)[0];
}

export function countBytes(
  stream: ReadableStream<Uint8Array>,
  onBytes: (n: number) => void,
): ReadableStream<Uint8Array> {
  return stream.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        onBytes(chunk.byteLength);
        controller.enqueue(chunk);
      },
    }),
  );
}

export async function openEntry(
  file: Blob,
  entry: ZipEntry,
  onBytes: (n: number) => void,
): Promise<ReadableStream<Uint8Array>> {
  const local = await read(file, entry.offset, entry.offset + 30);
  if (local.getUint32(0, true) !== SIG_LOCAL) throw new Error("This .zip file looks damaged.");
  const dataStart = entry.offset + 30 + local.getUint16(26, true) + local.getUint16(28, true);
  const raw = countBytes(file.slice(dataStart, dataStart + entry.compressedSize).stream(), onBytes);
  if (entry.method === 0) return raw;
  if (entry.method !== 8) throw new Error(`Unsupported compression method (${entry.method}).`);
  if (typeof DecompressionStream === "undefined") {
    throw new Error("This browser can't unzip files. Unzip export.zip and choose export.xml instead.");
  }
  return raw.pipeThrough(new DecompressionStream("deflate-raw") as TransformStream<Uint8Array, Uint8Array>);
}
