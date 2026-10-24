// Uploads: PDF, PNG and JPEG only (MIME and extension), 10 MB, random UUID names, never served statically.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import multer from 'multer';
import { badRequest } from './errors.js';

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const ALLOWED: Record<string, string[]> = {
  'application/pdf': ['.pdf'],
  'image/png': ['.png'],
  'image/jpeg': ['.jpg', '.jpeg'],
};

export function storageDir(): string {
  const dir = process.env.STORAGE_DIR ?? path.resolve(process.cwd(), 'storage');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 20 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const okExt = ALLOWED[file.mimetype]?.includes(ext);
    if (!okExt) return cb(badRequest(`${file.originalname} is not a PDF, PNG or JPEG file.`));
    cb(null, true);
  },
});

export interface StoredFile {
  storedName: string;
  fileName: string;
  mimeType: string;
  size: number;
}

export function saveBuffer(buf: Buffer, originalName: string, mimeType: string): StoredFile {
  const ext = path.extname(originalName).toLowerCase();
  const storedName = `${crypto.randomUUID()}${ext}`;
  fs.writeFileSync(path.join(storageDir(), storedName), buf);
  return { storedName, fileName: path.basename(originalName).slice(0, 200), mimeType, size: buf.length };
}

export function removeStored(names: string[]): void {
  for (const n of names) fs.rmSync(path.join(storageDir(), n), { force: true });
}

export function storedPath(storedName: string): string {
  if (!/^[0-9a-f-]{36}\.(pdf|png|jpe?g)$/.test(storedName)) throw badRequest('Invalid file reference.');
  return path.join(storageDir(), storedName);
}

/** Minimal valid one-page PDF with a few lines of text (seed placeholders). */
export function placeholderPdf(lines: string[]): Buffer {
  const esc = (s: string) => s.replace(/[\\()]/g, (m) => `\\${m}`);
  const text = lines.map((l, i) => `BT /F1 ${i === 0 ? 16 : 11} Tf 56 ${760 - i * 22} Td (${esc(l)}) Tj ET`).join('\n');
  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${Buffer.byteLength(text)} >>\nstream\n${text}\nendstream`,
  ];
  let out = '%PDF-1.4\n';
  const offsets: number[] = [];
  objs.forEach((o, i) => {
    offsets.push(Buffer.byteLength(out));
    out += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = Buffer.byteLength(out);
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`;
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, 'binary');
}
