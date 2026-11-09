import { Anchor, Button, Text, Title } from "@mantine/core";
import { createFileRoute, Link, notFound, redirect } from "@tanstack/react-router";
import { getViewer } from "src/functions/inventory";
import { getPublicItem } from "src/functions/public-item";
import { statusLabels } from "src/lib/item-attributes";
import classes from "src/styles/layout.module.css";
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
    <Text>
      <Anchor renderRoot={(props) => <Link {...props} to="/login" search={{ item: code }} />}>
        管理者としてログイン
      </Anchor>
    </Text>
  );
}

function PublicItemPage() {
  const item = Route.useLoaderData();
  return (
    <main className={classes.standalone}>
      <Title order={1}>{item.name}</Title>
      <Text>{item.ownerName} の物品です。</Text>
      <dl className={classes.metadata}>
        <dt>状態</dt>
        <dd>{statusLabels[item.status]}</dd>
        {item.description && (
          <>
            <dt>説明</dt>
            <dd>{item.description}</dd>
          </>
        )}
      </dl>
      <Button type="button" disabled>
        紛失・拾得を報告する（準備中）
      </Button>
      <Text>報告機能はまだ利用できません。</Text>
      <OwnerLogin />
    </main>
  );
}

function UnavailableItem() {
  return (
    <main className={classes.standalone}>
      <Title order={1}>物品の情報を表示できません。</Title>
      <Text>情報が公開されていないか、物品が見つかりません。</Text>
      <OwnerLogin />
    </main>
  );
}
