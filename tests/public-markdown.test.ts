import { assetReference } from "src/lib/media";
import { publicMarkdown } from "src/server/public-markdown";
import { expect, test } from "vitest";

const id = "12345678-1234-1234-1234-123456789abc";
const url = `https://mochi.example/api/v1/uses/example/images/${id}`;

test("preserves prose around inline images and renders safe GFM", () => {
  const result = publicMarkdown(
    `## 道具\n\n最初の段落。\n\n![使っている様子](${assetReference(id)})\n\n次の段落。\n\n| A | B |\n| - | - |\n| 1 | 2 |\n\n\`\`\`js\nconsole.log('<script>')\n\`\`\``,
    { [id]: url },
  );
  expect(result.markdown).toContain(`](${url})`);
  expect(result.markdown).not.toContain("mochi-asset:");
  expect(result.html).toMatch(new RegExp(`最初の段落。[\\s\\S]*<img src="${url}"[\\s\\S]*次の段落。`));
  expect(result.html).toContain("<table>");
  expect(result.html).toContain("&lt;script&gt;");
});

test("supports reference images, escaped alt text and ordinary links", () => {
  const result = publicMarkdown(`!["<text>"][photo]\n\n[photo]: ${assetReference(id)}\n\n[link](https://example.com)`, {
    [id]: url,
  });
  expect(result.html).toContain(`src="${url}"`);
  expect(result.html).toContain("&lt;text&gt;");
  expect(result.html).toContain('href="https://example.com"');
});

test("validates the first reference definition, matching CommonMark image resolution", () => {
  expect(() =>
    publicMarkdown(`![x][photo]\n\n[photo]: https://external.example/image.png\n[photo]: ${assetReference(id)}`, {
      [id]: url,
    }),
  ).toThrow("アップロード済み");
});

test.each([
  '<img src="x" onerror="alert(1)">',
  "<script>alert(1)</script>",
  "[x](javascript:alert%281%29)",
  "![x](https://example.com/private.jpg)",
  "![x](/api/images/private)",
  "![x](data:image/png;base64,abc)",
  `![x](${assetReference(id)})`,
  "[x][bad]\n\n[bad]: javascript:alert%281%29",
])("rejects HTML, unsafe links and unselected images: %s", (source) => {
  expect(() => publicMarkdown(source, {})).toThrow();
});
