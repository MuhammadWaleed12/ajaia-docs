import { describe, expect, it } from "vitest";
import { importFileToDocument, markdownToHtml } from "../src/lib/import";

function bytes(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

describe("markdownToHtml", () => {
  it("converts headings", () => {
    expect(markdownToHtml("# Title\n\n## Subtitle")).toBe(
      "<h1>Title</h1><h2>Subtitle</h2>"
    );
  });

  it("groups list items into a single list", () => {
    const html = markdownToHtml("- a\n- b\n- c");
    expect(html).toBe("<ul><li>a</li><li>b</li><li>c</li></ul>");
  });

  it("supports numbered lists separately", () => {
    const html = markdownToHtml("1. one\n2. two");
    expect(html).toBe("<ol><li>one</li><li>two</li></ol>");
  });

  it("supports inline bold and italic", () => {
    expect(markdownToHtml("**bold** and _ital_ and *ital2*")).toContain("<strong>bold</strong>");
    expect(markdownToHtml("**bold** and _ital_ and *ital2*")).toContain("<em>ital</em>");
    expect(markdownToHtml("**bold** and _ital_ and *ital2*")).toContain("<em>ital2</em>");
  });

  it("escapes raw HTML in the source", () => {
    const html = markdownToHtml("hello <script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>");
  });
});

describe("importFileToDocument", () => {
  it("imports .txt with paragraph breaks", async () => {
    const res = await importFileToDocument({
      filename: "notes.txt",
      mimeType: "text/plain",
      bytes: bytes("First para.\n\nSecond para."),
    });
    expect(res.title).toBe("notes");
    expect(res.html).toBe("<p>First para.</p><p>Second para.</p>");
  });

  it("imports .md with formatting preserved", async () => {
    const res = await importFileToDocument({
      filename: "spec.md",
      mimeType: "text/markdown",
      bytes: bytes("# Spec\n\n- one\n- two"),
    });
    expect(res.title).toBe("spec");
    expect(res.html).toContain("<h1>Spec</h1>");
    expect(res.html).toContain("<ul><li>one</li><li>two</li></ul>");
  });

  it("rejects unsupported extensions", async () => {
    await expect(
      importFileToDocument({
        filename: "image.png",
        mimeType: "image/png",
        bytes: new Uint8Array([1, 2, 3]),
      })
    ).rejects.toThrow(/Unsupported/);
  });
});
