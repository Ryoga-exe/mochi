import { toHtml } from "hast-util-to-html";
import { toHast } from "mdast-util-to-hast";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkStringify from "remark-stringify";
import { unified } from "unified";
import { visit } from "unist-util-visit";
import { referencedAsset } from "./media";
import { InventoryError } from "./mutation";

const parser = unified().use(remarkParse).use(remarkGfm);

function safeLink(url: string) {
  return url.startsWith("#") || /^(https?:|mailto:)/i.test(url);
}

export function parseMarkdown(source: string, assetUrls: Record<string, string> = {}) {
  const tree = parser.parse(source);
  const definitions = new Map<string, string>();
  visit(tree, "definition", (node) => {
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
    if (node.type === "image" || node.type === "imageReference") node.data = { hProperties: { loading: "lazy" } };
    if (node.type === "image") node.url = imageUrl(node.url);
    if (node.type === "imageReference") imageUrl(definitions.get(node.identifier) ?? "");
    if (node.type === "link" && !safeLink(node.url))
      throw new InventoryError("リンクは http・https・mailto またはページ内リンクにしてください。");
    if (node.type === "definition") {
      if (referencedAsset(node.url)) node.url = imageUrl(node.url);
      else if (!safeLink(node.url)) throw new InventoryError("リンクの URL が不正です。");
    }
  });
  return tree;
}

export function renderMarkdown(source: string, assetUrls: Record<string, string> = {}) {
  const tree = parseMarkdown(source, assetUrls);
  return {
    markdown: unified().use(remarkGfm).use(remarkStringify).stringify(tree),
    html: toHtml(toHast(tree), { closeSelfClosing: true, tightSelfClosing: true }),
  };
}
