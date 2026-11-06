import { Link } from "@tanstack/react-router";
import { Fragment } from "react";
import { type Inventory, type Item, itemCode, ownershipLabels, statusLabels, storagePath } from "src/lib/inventory";

export function StoragePath({ item, inventory }: { item: Item; inventory: Inventory }) {
  const path = storagePath(item, inventory);
  if (!path.length) return <>未設定</>;
  return (
    <>
      {path[0].kind === "item" && "（場所未設定） › "}
      {path.map((part, index) => (
        <Fragment key={`${part.kind}:${part.id}`}>
          {index > 0 && " › "}
          {part.kind === "item" && part.code ? (
            <Link to="/i/$code" params={{ code: part.code }}>
              {part.name}
            </Link>
          ) : (
            <Link to="/" search={{ location: part.id }}>
              {part.name}
            </Link>
          )}
        </Fragment>
      ))}
    </>
  );
}

export function ItemTable({ items, inventory }: { items: Item[]; inventory: Inventory }) {
  return (
    <table>
      <thead>
        <tr>
          <th>管理番号</th>
          <th>品名</th>
          <th>タグ</th>
          <th>収納先</th>
          <th>状態</th>
          <th>所有関係</th>
        </tr>
      </thead>
      <tbody>
        {items.map((item) => (
          <tr key={item.id}>
            <td>
              <Link to="/i/$code" params={{ code: itemCode(item) }}>
                {itemCode(item)}
              </Link>
            </td>
            <td>
              <Link to="/i/$code" params={{ code: itemCode(item) }}>
                {item.name}
              </Link>
              {item.isContainer && "（収納可）"}
              {item.archivedAt !== null && "（アーカイブ済み）"}
            </td>
            <td>
              <ItemTags item={item} />
            </td>
            <td>
              <StoragePath item={item} inventory={inventory} />
            </td>
            <td>{statusLabels[item.status]}</td>
            <td>{ownershipLabels[item.ownership]}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function ItemTags({ item }: { item: Pick<Item, "tags"> }) {
  return item.tags.length
    ? item.tags.map((tag, index) => (
        <Fragment key={tag}>
          {index > 0 && ", "}
          <Link to="/" search={{ tag }}>
            {tag}
          </Link>
        </Fragment>
      ))
    : "なし";
}
