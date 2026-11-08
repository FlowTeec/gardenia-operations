function pdfSafe(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[^\x20-\x7E]/g, " ")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

/** A small text PDF so issue tickets can be downloaded without a third-party library. */
export function renderPlainPdf(lines: string[]): Uint8Array {
  const pageSize = 48;
  const pages: string[][] = [];
  let bucket: string[] = [];
  for (const line of lines) {
    const chunks = line.length > 95 ? line.match(/.{1,95}/g) ?? [line] : [line];
    for (const chunk of chunks) {
      bucket.push(chunk);
      if (bucket.length >= pageSize) {
        pages.push(bucket);
        bucket = [];
      }
    }
  }
  if (bucket.length || pages.length === 0) pages.push(bucket);

  const objects: string[] = [];
  const pageObjectIds: number[] = [];
  // 1 catalog, 2 pages, then each page + content
  let nextId = 3;

  const contentIds: number[] = [];
  for (const page of pages) {
    const pageId = nextId++;
    const contentId = nextId++;
    pageObjectIds.push(pageId);
    contentIds.push(contentId);
    const commands = [
      "BT",
      "/F1 11 Tf",
      "50 790 Td",
      "14 TL",
      ...page.map((line) => `(${pdfSafe(line)}) Tj T*`),
      "ET",
    ].join("\n");
    objects[contentId] = `<< /Length ${commands.length} >>\nstream\n${commands}\nendstream`;
    objects[pageId] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents ${contentId} 0 R /Resources << /Font << /F1 5 0 R >> >> >>`;
  }

  const fontId = nextId++;
  objects[1] = `<< /Type /Catalog /Pages 2 0 R >>`;
  objects[2] = `<< /Type /Pages /Count ${pageObjectIds.length} /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(" ")}] >>`;
  objects[fontId] = `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>`;

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [0];
  const maxId = fontId;
  for (let id = 1; id <= maxId; id++) {
    offsets[id] = pdf.length;
    pdf += `${id} 0 obj\n${objects[id]}\nendobj\n`;
  }
  const xref = pdf.length;
  pdf += `xref\n0 ${maxId + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (let id = 1; id <= maxId; id++) {
    pdf += `${String(offsets[id]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${maxId + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new TextEncoder().encode(pdf);
}
