import type { PageText } from '../types'

/** 极简 PDF 生成器：把示例论文的文本页画成真实 PDF，让示例也能用原版渲染器 */
function esc(s: string): string {
  return s
    .replace(/[\u2014\u2013]/g, '-')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[^\x20-\x7E]/g, '?')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
}

function wrapLine(text: string, size: number, maxWidth: number): string[] {
  const perChar = size * 0.5
  const maxChars = Math.max(20, Math.floor(maxWidth / perChar))
  const words = text.split(/\s+/)
  const out: string[] = []
  let cur = ''
  for (const w of words) {
    if (!cur) {
      cur = w
    } else if ((cur + ' ' + w).length <= maxChars) {
      cur += ' ' + w
    } else {
      out.push(cur)
      cur = w
    }
  }
  if (cur) out.push(cur)
  return out
}

const W = 612
const H = 792
const MARGIN = 62

export function buildDemoPdf(pages: PageText[]): Uint8Array {
  const pageStreams: string[] = []

  for (const page of pages) {
    let y = H - MARGIN
    let stream = ''
    for (const block of page.blocks) {
      const size = block.kind === 'title' ? 17 : block.kind === 'heading' ? 13 : block.kind === 'meta' ? 9.5 : 10.5
      const font = block.kind === 'body' || block.kind === 'caption' ? '/F1' : '/F2'
      const lead = size * 1.45
      const lines = wrapLine(block.text, size, W - MARGIN * 2)
      if (y - lead * lines.length < MARGIN) break
      for (const line of lines) {
        stream += 'BT ' + font + ' ' + size.toFixed(1) + ' Tf 1 0 0 1 ' + MARGIN + ' ' + y.toFixed(1) + ' Tm (' + esc(line) + ') Tj ET\n'
        y -= lead
      }
      y -= block.kind === 'body' ? 6 : 12
    }
    pageStreams.push(stream)
  }

  const objects: string[] = []
  const pageCount = pageStreams.length
  const kids = pageStreams.map((_, i) => 3 + i * 2 + ' 0 R').join(' ')
  objects.push('<< /Type /Catalog /Pages 2 0 R >>')
  objects.push('<< /Type /Pages /Kids [' + kids + '] /Count ' + pageCount + ' >>')
  pageStreams.forEach((stream, i) => {
    const contentObj = 4 + i * 2
    objects.push(
      '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' +
        W +
        ' ' +
        H +
        '] /Resources << /Font << /F1 ' +
        (3 + pageCount * 2) +
        ' 0 R /F2 ' +
        (4 + pageCount * 2) +
        ' 0 R >> >> /Contents ' +
        contentObj +
        ' 0 R >>',
    )
    objects.push('<< /Length ' + stream.length + ' >>\nstream\n' + stream + 'endstream')
  })
  objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>')
  objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>')

  let pdf = '%PDF-1.4\n'
  const offsets: number[] = []
  objects.forEach((body, i) => {
    offsets.push(pdf.length)
    pdf += i + 1 + ' 0 obj\n' + body + '\nendobj\n'
  })
  const xrefStart = pdf.length
  pdf += 'xref\n0 ' + (objects.length + 1) + '\n0000000000 65535 f \n'
  for (const off of offsets) pdf += String(off).padStart(10, '0') + ' 00000 n \n'
  pdf += 'trailer\n<< /Size ' + (objects.length + 1) + ' /Root 1 0 R >>\nstartxref\n' + xrefStart + '\n%%EOF\n'

  const bytes = new Uint8Array(pdf.length)
  for (let i = 0; i < pdf.length; i++) bytes[i] = pdf.charCodeAt(i) & 0xff
  return bytes
}
