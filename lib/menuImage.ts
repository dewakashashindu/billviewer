// ============================================================
// Menu item picture conversion (SERVER ONLY)
// Tbl_MenuItems.ItemPicMob is stored by the POS as binary —
// in practice PNG/JPEG in some databases and Windows ICO/DIB
// in others. Browsers cannot render ICO/DIB in <img>, so ICO
// and raw DIB frames are converted to PNG here (same idea as
// the reference backend's extractIcoFrame + dibToPngBase64).
// ============================================================
import zlib from "zlib";

/* ── PNG encoder (CRC32 + zlib) ── */
const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++)
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

export function encodePng(width: number, height: number, rgba: Buffer): Buffer {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const raw = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    const rowStart = y * (1 + width * 4);
    raw[rowStart] = 0; // filter: none
    rgba.copy(raw, rowStart + 1, y * width * 4, (y + 1) * width * 4);
  }
  return Buffer.concat([
    sig,
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", zlib.deflateSync(raw, { level: 6 })),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

/* ── DIB (BITMAPINFOHEADER) -> RGBA pixels ── */
// ICO frames store height as image+mask (2x); a raw DIB
// stores the real height, so the caller says which it is.
function dibToPng(dib: Buffer, fromIco: boolean): Buffer {
  const headerSize = dib.readUInt32LE(0);
  if (headerSize < 40) throw new Error("unsupported DIB header");
  const width = dib.readInt32LE(4);
  const storedHeight = Math.abs(dib.readInt32LE(8));
  const rows = fromIco ? storedHeight / 2 : storedHeight;
  const bitCount = dib.readUInt16LE(14);
  const compression = dib.readUInt32LE(16);
  if (compression !== 0) throw new Error("compressed DIB not supported");
  if (bitCount !== 24 && bitCount !== 32)
    throw new Error(`unsupported DIB bit depth ${bitCount}`);

  const rowSize = Math.floor((width * bitCount + 31) / 32) * 4;
  const rgba = Buffer.alloc(width * rows * 4);
  const topDown = dib.readInt32LE(8) < 0;
  for (let y = 0; y < rows; y++) {
    const srcRow = topDown ? y : rows - 1 - y;
    const srcStart = headerSize + srcRow * rowSize;
    for (let x = 0; x < width; x++) {
      const s = srcStart + x * (bitCount / 8);
      const d = (y * width + x) * 4;
      rgba[d] = dib[s + 2]; // R
      rgba[d + 1] = dib[s + 1]; // G
      rgba[d + 2] = dib[s]; // B
      rgba[d + 3] = bitCount === 32 ? dib[s + 3] : 255;
    }
  }
  return encodePng(width, rows, rgba);
}

/* ── ICO container -> PNG (first frame) ── */
function icoToPng(ico: Buffer): Buffer {
  const count = ico.readUInt16LE(4);
  if (count < 1) throw new Error("empty ICO");
  const bytesInRes = ico.readUInt32LE(14);
  const offset = ico.readUInt32LE(18);
  const frame = ico.subarray(offset, offset + bytesInRes);
  if (frame.length >= 8 && frame[0] === 0x89 && frame[1] === 0x50)
    return Buffer.from(frame); // PNG-compressed frame
  return dibToPng(frame, true);
}

export interface ConvertedImage {
  body: Buffer;
  contentType: string;
}

/** Detect format and return something a browser <img> can show. */
export function convertMenuImage(raw: Buffer): ConvertedImage {
  if (raw.length >= 8 && raw[0] === 0x89 && raw[1] === 0x50)
    return { body: raw, contentType: "image/png" };
  if (raw.length >= 3 && raw[0] === 0xff && raw[1] === 0xd8)
    return { body: raw, contentType: "image/jpeg" };
  if (raw.length >= 6 && raw.subarray(0, 6).toString("ascii").startsWith("GIF"))
    return { body: raw, contentType: "image/gif" };
  if (raw.length >= 2 && raw[0] === 0x42 && raw[1] === 0x4d)
    return { body: raw, contentType: "image/bmp" };
  if (
    raw.length >= 4 &&
    raw.readUInt32LE(0) === 0 &&
    raw.readUInt16LE(2) === 1
  )
    return { body: icoToPng(raw), contentType: "image/png" };
  if (raw.length >= 4 && raw.readUInt32LE(0) === 40)
    return { body: dibToPng(raw, false), contentType: "image/png" };
  // Unknown binary — serve as PNG attempt (browser will fail safe)
  return { body: raw, contentType: "image/png" };
}
