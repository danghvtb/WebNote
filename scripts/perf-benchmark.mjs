import { gzipSync } from 'node:zlib';
import { performance } from 'node:perf_hooks';
import { Worker } from 'node:worker_threads';

const pageCount = Number(process.env.WEBNOTE_BENCH_PAGES || 5000);
const pages = Array.from({ length: pageCount }, (_, index) => ({
  id: `page_bench_${index}`,
  notebookId: `notebook_${index % 20}`,
  title: `Trang ghi chú ${index}`,
  content: `<p>Nội dung benchmark ${index} với các từ khóa dự án, báo cáo và công việc.</p>`,
  tagIds: index % 3 === 0 ? ['tag_work'] : [],
}));
const snapshot = JSON.stringify({ schemaVersion: 7, days: [], notebooks: [], pages, tags: [], projects: [], workReports: [] });

const parseStart = performance.now();
const parsed = JSON.parse(snapshot);
const parseMs = performance.now() - parseStart;
const normalizeStart = performance.now();
const pageMap = new Map(parsed.pages.map((page) => [page.id, page]));
const normalized = parsed.pages.map((page) => ({ ...page, searchText: `${page.title} ${page.content}`.toLocaleLowerCase('vi-VN') }));
const normalizeMs = performance.now() - normalizeStart;
const compressedBytes = gzipSync(snapshot, { level: 6 }).byteLength;
const workerStart = performance.now();
const workerPages = await new Promise((resolve, reject) => {
  const worker = new Worker(`const { parentPort, workerData } = require('node:worker_threads'); parentPort.postMessage(JSON.parse(workerData).pages.length);`, { eval: true, workerData: snapshot });
  worker.once('message', resolve);
  worker.once('error', reject);
});
const workerMs = performance.now() - workerStart;

console.log(JSON.stringify({
  pages: pageMap.size,
  snapshotBytes: Buffer.byteLength(snapshot),
  gzipBytes: compressedBytes,
  parseMs: Number(parseMs.toFixed(1)),
  normalizeMs: Number(normalizeMs.toFixed(1)),
  totalMs: Number((parseMs + normalizeMs).toFixed(1)),
  workerParseMs: Number(workerMs.toFixed(1)),
  workerPages,
  normalizedEntries: normalized.length,
}, null, 2));

if (pageMap.size !== pageCount || normalized.length !== pageCount) process.exit(1);
