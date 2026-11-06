import { createFileRoute, Link, notFound, redirect } from "@tanstack/react-router";
import { getViewer } from "src/functions/inventory";
import { getPublicItem } from "src/functions/public-item";
import { statusLabels } from "src/lib/item-attributes";
import { z } from "zod";

export const Route = createFileRoute("/i/$code")({
  validateSearch: z.object({
    preview: z.literal(true).optional().catch(undefined),
  }),
  beforeLoad: async ({ params, search }) => {
    if (!search.preview && (await getViewer())) throw redirect({ to: "/items/$code", params });
  },
  loader: async ({ params }) => {
    const item = await getPublicItem({ data: params.code });
    if (!item) throw notFound();
    return item;
  },
  headers: () => ({ "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" }),
  head: () => ({ meta: [{ name: "robots", content: "noindex, nofollow" }] }),
  component: PublicItemPage,
  notFoundComponent: UnavailableItem,
});

function OwnerLogin() {
  const { code } = Route.useParams();
  return (
    <p>
      <Link to="/login" search={{ item: code }}>
        管理者としてログイン
      </Link>
    </p>
  );
}

function PublicItemPage() {
  const item = Route.useLoaderData();
  return (
    <main>
      <h1>{item.name}</h1>
      <p>{item.ownerName} の物品です。</p>
      <dl>
        <dt>状態</dt>
        <dd>{statusLabels[item.status]}</dd>
        {item.description && (
          <>
            <dt>説明</dt>
            <dd>{item.description}</dd>
          </>
        )}
      </dl>
      <button type="button" disabled>
        紛失・拾得を報告する（準備中）
      </button>
      <p>報告機能はまだ利用できません。</p>
      <OwnerLogin />
    </main>
  );
}

function UnavailableItem() {
  return (
    <main>
      <h1>物品の情報を表示できません。</h1>
      <p>情報が公開されていないか、物品が見つかりません。</p>
      <OwnerLogin />
    </main>
  );
}
