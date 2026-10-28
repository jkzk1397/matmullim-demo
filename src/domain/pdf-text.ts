// PDF 공시 문서: 표 구조 없이 글자만 읽는다(표 대조는 하지 않고 성취기준 코드·문구 점검만).
import type { DocKind, ParsedDocument } from './types';

/**
 * pdf.js는 글자 조각 사이에 공백을 하나 끼워 넣어 '[9 정 01-01]'처럼 나온다.
 * 공백 하나는 조각 경계로 보고 지우고, 두 칸 이상(원래 띄어쓰기 + 경계)은 한 칸으로 줄인다.
 */
export function cleanPdfText(p: string): string {
  return p
    .split('\n')
    .map((l) => l.replace(/(?<! ) (?! )/g, '').replace(/ {2,}/g, ' ').trim())
    .join('\n')
    .replace(/\n(?!\s*\[)/g, ' ')
    .replace(/\[\s*(\d{1,2})\s*([가-힣]{1,2})\s*(\d{2})\s*-\s*(\d{2})\s*\]/g, '[$1$2$3-$4]')
    .replace(/[ \t]+/g, ' ')
    // 굵게 보이려고 같은 글자를 여러 번 겹쳐 찍은 PDF: '배려와배려와배려와' → '배려와'
    .replace(/(\S{2,20}?)\1{2,}/g, '$1')
    .trim();
}

/** 페이지별 글자 → 점검용 문서. 줄바꿈은 다음 줄이 성취기준 코드로 시작할 때만 남긴다. */
export function pdfPagesToDoc(pages: string[], fileName: string, doc: DocKind): ParsedDocument {
  const tables = pages.map((p, i) => ({
    title: `${i + 1}쪽`,
    rows: [[cleanPdfText(p)]],
    spans: [],
  }));
  return { doc, fileName, title: fileName, tables };
}

export async function parsePdf(data: ArrayBuffer, fileName: string, doc: DocKind): Promise<ParsedDocument> {
  const pdfjs = await import('pdfjs-dist');
  const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(data) }).promise;
  const pages: string[] = [];
  for (let n = 1; n <= pdf.numPages; n++) {
    const tc = await (await pdf.getPage(n)).getTextContent();
    pages.push(tc.items.map((it) => ('str' in it ? it.str + (it.hasEOL ? '\n' : ' ') : '')).join(''));
  }
  return pdfPagesToDoc(pages, fileName, doc);
}

export const isPdf = (u: Uint8Array) => u[0] === 0x25 && u[1] === 0x50 && u[2] === 0x44 && u[3] === 0x46;
