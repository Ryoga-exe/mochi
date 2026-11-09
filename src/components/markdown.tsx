import { Alert, Typography } from "@mantine/core";
import { toJsxRuntime } from "hast-util-to-jsx-runtime";
import { toHast } from "mdast-util-to-hast";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
import { parseMarkdown } from "src/lib/markdown";
import { InventoryError } from "src/lib/mutation";

export function Markdown({ source, assetUrls }: { source: string; assetUrls?: Record<string, string> }) {
  try {
    return <Typography>{toJsxRuntime(toHast(parseMarkdown(source, assetUrls)), { Fragment, jsx, jsxs })}</Typography>;
  } catch (error) {
    if (error instanceof InventoryError) return <Alert color="red">{error.message}</Alert>;
    throw error;
  }
}
