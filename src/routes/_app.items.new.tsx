import { Title } from "@mantine/core";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";
import { ItemForm } from "src/components/item-form";
import { getInventory } from "src/functions/inventory";
import { createInventoryIndex, itemCode } from "src/lib/inventory";

export const Route = createFileRoute("/_app/items/new")({
  loader: () => getInventory(),
  component: NewItem,
});

function NewItem() {
  const data = Route.useLoaderData();
  const inventory = useMemo(() => createInventoryIndex(data), [data]);
  const navigate = useNavigate();
  return (
    <>
      <Title order={2}>物品を登録</Title>
      <ItemForm
        inventory={inventory}
        onSaved={async (item) => {
          await navigate({ to: "/items/$code", params: { code: itemCode(item) } });
        }}
      />
    </>
  );
}
