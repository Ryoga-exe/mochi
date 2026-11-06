import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ItemForm } from "src/components/item-form";
import { getInventory } from "src/functions/inventory";
import { itemCode } from "src/lib/inventory";

export const Route = createFileRoute("/_app/items/new")({
  loader: () => getInventory(),
  component: NewItem,
});

function NewItem() {
  const inventory = Route.useLoaderData();
  const navigate = useNavigate();
  return (
    <>
      <h2>物品を登録</h2>
      <p>品名だけで登録できます。管理番号は登録年（日本時間）を含めて自動で発行されます。</p>
      <ItemForm
        inventory={inventory}
        onSaved={async (item) => {
          await navigate({ to: "/i/$code", params: { code: itemCode(item) } });
        }}
      />
    </>
  );
}
