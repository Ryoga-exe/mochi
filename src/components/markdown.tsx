import ReactMarkdown, { defaultUrlTransform } from "react-markdown";
import remarkGfm from "remark-gfm";
import { referencedAsset } from "src/lib/media";

export function Markdown({ source, assetUrls }: { source: string; assetUrls?: Record<string, string> }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      skipHtml
      urlTransform={(url, key) => {
        const assetId = referencedAsset(url);
        return key === "src" ? (assetId ? (assetUrls?.[assetId] ?? "") : "") : defaultUrlTransform(url);
      }}
      components={{
        img: ({ src, alt }) =>
          typeof src === "string" && src ? <img src={src} alt={alt ?? ""} loading="lazy" /> : null,
      }}
    >
      {source}
    </ReactMarkdown>
  );
}
