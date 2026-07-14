/**
 * Convert an uploaded file into `{ title, html }` suitable for creating a new
 * document. Supported types:
 *   - text/plain (.txt)
 *   - text/markdown (.md)
 *   - application/vnd.openxmlformats-officedocument.wordprocessingml.document (.docx)
 *
 * We deliberately keep the markdown -> HTML converter tiny and dependency-free
 * so the app doesn't pull in a full markdown ecosystem for this small feature.
 */

export const IMPORT_ACCEPT = ".txt,.md,.markdown,.docx";
export const IMPORT_ACCEPT_HUMAN = ".txt, .md, .docx";

export type ImportResult = { title: string; html: string };

export async function importFileToDocument(input: {
  filename: string;
  mimeType: string;
  bytes: Uint8Array;
}): Promise<ImportResult> {
  const { filename, bytes } = input;
  const lower = filename.toLowerCase();

  if (lower.endsWith(".docx")) {
    return importDocx(filename, bytes);
  }
  if (lower.endsWith(".md") || lower.endsWith(".markdown")) {
    return { title: stripExt(filename), html: markdownToHtml(bytesToText(bytes)) };
  }
  if (lower.endsWith(".txt") || input.mimeType.startsWith("text/")) {
    return { title: stripExt(filename), html: plainTextToHtml(bytesToText(bytes)) };
  }
  throw new Error(`Unsupported file type: ${filename}`);
}

async function importDocx(filename: string, bytes: Uint8Array): Promise<ImportResult> {
  // Loaded dynamically so it isn't bundled into edge runtime accidentally.
  const mammoth = await import("mammoth");
  const buffer = Buffer.from(bytes);
  const result = await mammoth.convertToHtml({ buffer });
  return { title: stripExt(filename), html: result.value || "<p></p>" };
}

function stripExt(name: string): string {
  return name.replace(/\.[^/.]+$/, "") || "Untitled document";
}

function bytesToText(bytes: Uint8Array): string {
  return new TextDecoder("utf-8").decode(bytes);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function plainTextToHtml(text: string): string {
  const paragraphs = text
    .replace(/\r\n?/g, "\n")
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${escapeHtml(p).replace(/\n/g, "<br />")}</p>`);
  return paragraphs.join("") || "<p></p>";
}

/**
 * A tiny markdown subset: headings (#, ##, ###), unordered/ordered lists,
 * bold (**x**), italic (*x* or _x_), and paragraphs. Enough to make imported
 * markdown look reasonable without depending on a full parser.
 */
export function markdownToHtml(md: string): string {
  const lines = md.replace(/\r\n?/g, "\n").split("\n");
  const out: string[] = [];
  let listType: "ul" | "ol" | null = null;
  let paragraph: string[] = [];

  const closeList = () => {
    if (listType) {
      out.push(`</${listType}>`);
      listType = null;
    }
  };
  const flushParagraph = () => {
    if (paragraph.length > 0) {
      out.push(`<p>${inlineMd(paragraph.join(" "))}</p>`);
      paragraph = [];
    }
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();

    if (line.trim() === "") {
      flushParagraph();
      closeList();
      continue;
    }

    const heading = /^(#{1,3})\s+(.*)$/.exec(line);
    if (heading) {
      flushParagraph();
      closeList();
      const level = heading[1].length;
      out.push(`<h${level}>${inlineMd(heading[2])}</h${level}>`);
      continue;
    }

    const ul = /^\s*[-*]\s+(.*)$/.exec(line);
    if (ul) {
      flushParagraph();
      if (listType !== "ul") {
        closeList();
        out.push("<ul>");
        listType = "ul";
      }
      out.push(`<li>${inlineMd(ul[1])}</li>`);
      continue;
    }

    const ol = /^\s*\d+\.\s+(.*)$/.exec(line);
    if (ol) {
      flushParagraph();
      if (listType !== "ol") {
        closeList();
        out.push("<ol>");
        listType = "ol";
      }
      out.push(`<li>${inlineMd(ol[1])}</li>`);
      continue;
    }

    closeList();
    paragraph.push(line);
  }

  flushParagraph();
  closeList();
  return out.join("") || "<p></p>";
}

function inlineMd(s: string): string {
  const escaped = escapeHtml(s);
  return escaped
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*(?!\s)([^*]+?)\*(?!\*)/g, "$1<em>$2</em>")
    .replace(/(^|[^_])_(?!\s)([^_]+?)_(?!_)/g, "$1<em>$2</em>");
}
