import { Anchor, Badge, Table } from "@mantine/core";
import { Link } from "@tanstack/react-router";
import { Fragment } from "react";
import {
  type InventoryIndex,
  type Item,
  itemCode,
  ownershipLabels,
  statusLabels,
  storagePath,
} from "src/lib/inventory";
import classes from "src/styles/layout.module.css";

export function StoragePath({ item, inventory }: { item: Item; inventory: InventoryIndex }) {
  const path = storagePath(item, inventory);
  if (!path.length) return <>未設定</>;
  return (
    <>
      {path[0].kind === "item" && "（場所未設定） › "}
      {path.map((part, index) => (
        <Fragment key={`${part.kind}:${part.id}`}>
          {index > 0 && " › "}
          {part.kind === "item" && part.code ? (
            <Anchor renderRoot={(props) => <Link {...props} to="/items/$code" params={{ code: part.code }} />}>
              {part.name}
            </Anchor>
          ) : (
            <Anchor renderRoot={(props) => <Link {...props} to="/" search={{ location: part.id }} />}>
              {part.name}
            </Anchor>
          )}
        </Fragment>
      ))}
    </>
  );
}

export function ItemTable({ items, inventory }: { items: Item[]; inventory: InventoryIndex }) {
  return (
    <section className={classes.tableScroll} aria-label="物品一覧（横にスクロールできます）">
      <Table className={classes.table} withTableBorder>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>品名</Table.Th>
            <Table.Th>タグ</Table.Th>
            <Table.Th>収納先</Table.Th>
            <Table.Th>状態</Table.Th>
            <Table.Th>所有関係</Table.Th>
            <Table.Th>QR 公開</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {items.map((item) => (
            <Table.Tr key={item.id}>
              <Table.Td className={classes.itemName}>
                <Anchor renderRoot={(props) => <Link {...props} to="/items/$code" params={{ code: itemCode(item) }} />}>
                  {item.name}
                </Anchor>
                <small className={classes.code}>{itemCode(item)}</small>
                {item.isContainer && <Badge variant="light">収納可</Badge>}
                {item.archivedAt !== null && <Badge color="gray">アーカイブ済み</Badge>}
              </Table.Td>
              <Table.Td>
                <ItemTags item={item} />
              </Table.Td>
              <Table.Td>
                <StoragePath item={item} inventory={inventory} />
              </Table.Td>
              <Table.Td>{statusLabels[item.status]}</Table.Td>
              <Table.Td>{ownershipLabels[item.ownership]}</Table.Td>
              <Table.Td>{item.isPublic && item.archivedAt === null ? "公開" : "非公開"}</Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </section>
  );
}

export function ItemTags({ item }: { item: Pick<Item, "tags"> }) {
  return item.tags.length
    ? item.tags.map((tag, index) => (
        <Fragment key={tag}>
          {index > 0 && ", "}
          <Anchor renderRoot={(props) => <Link {...props} to="/" search={{ tag }} />}>{tag}</Anchor>
        </Fragment>
      ))
    : "なし";
}
