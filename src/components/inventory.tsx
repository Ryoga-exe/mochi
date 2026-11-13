import { Anchor, Badge, Table } from "@mantine/core";
import { Link } from "@tanstack/react-router";
import { Fragment } from "react";
import { type InventoryIndex, type Item, itemCode, statusLabels, storagePath } from "src/lib/inventory";
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
      <Table className={classes.table} verticalSpacing="sm">
        <Table.Thead>
          <Table.Tr>
            <Table.Th>品名</Table.Th>
            <Table.Th>収納先</Table.Th>
            <Table.Th className={classes.itemStatus}>状態</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {items.map((item) => (
            <Table.Tr key={item.id}>
              <Table.Td className={classes.itemName}>
                <Anchor renderRoot={(props) => <Link {...props} to="/items/$code" params={{ code: itemCode(item) }} />}>
                  {item.name}
                </Anchor>
                <div className={classes.itemMeta}>
                  <small className={classes.code}>{itemCode(item)}</small>
                  {item.isContainer && <Badge variant="light">収納可</Badge>}
                  {item.archivedAt !== null && <Badge color="gray">アーカイブ済み</Badge>}
                </div>
                {item.tags.length > 0 && (
                  <div className={classes.itemTags}>
                    <ItemTags item={item} />
                  </div>
                )}
              </Table.Td>
              <Table.Td>
                <StoragePath item={item} inventory={inventory} />
              </Table.Td>
              <Table.Td className={classes.itemStatus}>{statusLabels[item.status]}</Table.Td>
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
