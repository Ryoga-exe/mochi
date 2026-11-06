import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkStringify from "remark-stringify";
import { Markdown } from "src/components/markdown";
import { referencedAsset } from "src/lib/media";
import { unified } from "unified";
import { visit } from "unist-util-visit";
import { InventoryError } from "./validation";

const processor = unified().use(remarkParse).use(remarkGfm).use(remarkStringify);

function safeLink(url: string) {
  return url.startsWith("#") || /^(https?:|mailto:)/i.test(url);
}

export function publicMarkdown(source: string, assetUrls: Record<string, string>) {
  const tree = processor.parse(source);
  const definitions = new Map<string, string>();
  visit(tree, "definition", (node) => {
    // CommonMark resolves repeated definitions using the first occurrence.
    if (!definitions.has(node.identifier)) definitions.set(node.identifier, node.url);
  });
  function imageUrl(url: string) {
    const id = referencedAsset(url);
    if (!id || !assetUrls[id])
      throw new InventoryError("本文の画像はアップロード済み画像から選び、公開対象に追加してください。");
    return assetUrls[id];
  }
  visit(tree, (node) => {
    if (node.type === "html") throw new InventoryError("HTML・MDX は使えません。Markdown で入力してください。");
    if (node.type === "image") node.url = imageUrl(node.url);
    if (node.type === "imageReference") imageUrl(definitions.get(node.identifier) ?? "");
    if (node.type === "link" && !safeLink(node.url))
      throw new InventoryError("リンクは http・https・mailto またはページ内リンクにしてください。");
    if (node.type === "definition") {
      if (referencedAsset(node.url)) node.url = imageUrl(node.url);
      else if (!safeLink(node.url)) throw new InventoryError("リンクの URL が不正です。");
    }
  });
  const markdown = processor.stringify(tree);
  return { markdown, html: renderToStaticMarkup(createElement(Markdown, { source, assetUrls })) };
}
