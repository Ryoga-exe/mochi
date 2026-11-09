// @vitest-environment happy-dom

import { MantineProvider } from "@mantine/core";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Markdown } from "src/components/markdown";
import { renderMarkdown } from "src/lib/markdown";
import { assetReference } from "src/lib/media";
import { expect, test } from "vitest";

const id = "12345678-1234-1234-1234-123456789abc";
const url = `https://mochi.example/api/v1/uses/example/images/${id}`;

function fragment(html: string) {
  const template = document.createElement("template");
  template.innerHTML = html;
  return template.content;
}

function renderPreview(source: string, assetUrls?: Record<string, string>) {
  return renderToStaticMarkup(
    createElement(MantineProvider, { env: "test" }, createElement(Markdown, { source, assetUrls })),
  );
}

function documents(source: string) {
  const assetUrls = { [id]: url };
  return [renderMarkdown(source, assetUrls).html, renderPreview(source, assetUrls)].map(fragment);
}

test("preserves prose around inline images and renders safe GFM", () => {
  const source = `## 道具\n\n最初の段落。\n\n![使っている様子](${assetReference(id)})\n\n次の段落。\n\n| A | B |\n| - | - |\n| 1 | 2 |\n\n\`\`\`js\nconsole.log('<script>')\n\`\`\`\n\n- [x] 使う`;
  const result = renderMarkdown(source, { [id]: url });
  expect(result.markdown).toContain(`](${url})`);
  expect(result.markdown).not.toContain("mochi-asset:");
  for (const document of documents(source)) {
    expect(document.textContent).toMatch(/最初の段落。[\s\S]*次の段落。/);
    expect(document.querySelector("img")?.getAttribute("src")).toBe(url);
    expect(document.querySelector("table")).not.toBeNull();
    expect(document.querySelector("pre code")?.textContent).toContain("<script>");
    expect(document.querySelector("script")).toBeNull();
    expect(document.querySelector<HTMLInputElement>("input")?.checked).toBe(true);
    expect(document.querySelector<HTMLInputElement>("input")?.disabled).toBe(true);
  }
});

test("supports reference images, escaped alt text and ordinary links", () => {
  for (const document of documents(
    `!["<text>"][photo]\n\n[photo]: ${assetReference(id)}\n\n[link](https://example.com)`,
  )) {
    expect(document.querySelector("img")?.getAttribute("src")).toBe(url);
    expect(document.querySelector("img")?.getAttribute("alt")).toBe('"<text>"');
    expect(document.querySelector("a")?.getAttribute("href")).toBe("https://example.com");
  }
});

test("validates the first reference definition, matching CommonMark image resolution", () => {
  expect(() =>
    renderMarkdown(`![x][photo]\n\n[photo]: https://external.example/image.png\n[photo]: ${assetReference(id)}`, {
      [id]: url,
    }),
  ).toThrow("アップロード済み");
});

test.each([
  '<img src="x" onerror="alert(1)">',
  "<script>alert(1)</script>",
  "[x](javascript:alert%281%29)",
  "[x](/relative/path)",
  "![x](https://example.com/private.jpg)",
  "![x](/api/images/private)",
  "![x](data:image/png;base64,abc)",
  `![x](${assetReference(id)})`,
  "[x][bad]\n\n[bad]: javascript:alert%281%29",
])("rejects HTML, unsafe links and unselected images: %s", (source) => {
  expect(() => renderMarkdown(source, {})).toThrow();
  const preview = fragment(renderPreview(source));
  expect(preview.querySelector('[role="alert"]')).not.toBeNull();
  expect(preview.querySelector("script, img, a")).toBeNull();
});
