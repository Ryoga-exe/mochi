import type { items, locations } from "src/server/db/schema";

export type { ItemStatus, Ownership } from "./item-attributes";
export { ownershipLabels, statusLabels } from "./item-attributes";

export type Location = typeof locations.$inferSelect;
export type Item = typeof items.$inferSelect;

export type StoragePart = { id: string; name: string; kind: "location" | "item"; code?: string };
export type Inventory = { items: Item[]; locations: Location[] };
export type InventoryIndex = Inventory & {
  itemsById: ReadonlyMap<string, Item>;
  locationsById: ReadonlyMap<string, Location>;
};

export function createInventoryIndex(inventory: Inventory): InventoryIndex {
  return {
    ...inventory,
    itemsById: new Map(inventory.items.map((item) => [item.id, item])),
    locationsById: new Map(inventory.locations.map((location) => [location.id, location])),
  };
}

export function itemCode(item: Pick<Item, "number" | "registrationYear">) {
  return `M-${item.registrationYear === null ? "" : `${item.registrationYear}-`}${String(item.number).padStart(6, "0")}`;
}

export function registrationYearAt(timestamp: number) {
  return Number(new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Tokyo", year: "numeric" }).format(timestamp));
}

export function storagePath(item: Item, inventory: InventoryIndex): StoragePart[] {
  const parts: StoragePart[] = [];
  const visited = new Set<string>([item.id]);
  let containerId = item.containerItemId;
  let locationId = item.locationId;

  while (containerId) {
    const container = inventory.itemsById.get(containerId);
    if (!container || visited.has(container.id)) break;
    visited.add(container.id);
    parts.unshift({ id: container.id, name: container.name, kind: "item", code: itemCode(container) });
    containerId = container.containerItemId;
    locationId = container.locationId;
  }
  while (locationId) {
    const location = inventory.locationsById.get(locationId);
    if (!location || visited.has(location.id)) break;
    visited.add(location.id);
    parts.unshift({ id: location.id, name: location.name, kind: "location" });
    locationId = location.parentId;
  }
  return parts;
}

export function locationPath(location: Location, inventory: InventoryIndex): Location[] {
  const path: Location[] = [];
  const visited = new Set<string>();
  let current: Location | undefined = location;
  while (current && !visited.has(current.id)) {
    visited.add(current.id);
    path.unshift(current);
    current = current.parentId ? inventory.locationsById.get(current.parentId) : undefined;
  }
  return path;
}

function formatStoragePath(path: StoragePart[]) {
  if (!path.length) return "未設定";
  return `${path[0].kind === "item" ? "（場所未設定） › " : ""}${path.map((part) => part.name).join(" › ")}`;
}

export function storageLabel(item: Item, inventory: InventoryIndex) {
  return formatStoragePath(storagePath(item, inventory));
}

export function containerChoices(inventory: InventoryIndex, itemId?: string) {
  return inventory.items.filter(
    (item) =>
      item.archivedAt === null &&
      item.isContainer &&
      item.id !== itemId &&
      (!itemId || !storagePath(item, inventory).some((part) => part.kind === "item" && part.id === itemId)),
  );
}

export function availableTags(inventory: Inventory) {
  return [...new Set(inventory.items.flatMap((item) => item.tags))].sort((a, b) => a.localeCompare(b, "ja"));
}

export function filterItems(
  inventory: InventoryIndex,
  search: {
    q?: string;
    location?: string;
    status?: string;
    archived?: string;
    tag?: string;
  },
) {
  const q = (search.q ?? "").toLocaleLowerCase();
  return inventory.items.filter((item) => {
    if ((search.archived ?? "active") === "active" && item.archivedAt !== null) return false;
    if (search.archived === "archived" && item.archivedAt === null) return false;
    if (search.status && item.status !== search.status) return false;
    if (search.tag && !item.tags.includes(search.tag)) return false;
    const path = storagePath(item, inventory);
    if (search.location === "unset" && path.some((part) => part.kind === "location")) return false;
    if (
      search.location &&
      search.location !== "unset" &&
      !path.some((part) => part.kind === "location" && part.id === search.location)
    )
      return false;
    return (
      !q ||
      `${itemCode(item)} ${item.name} ${item.description} ${item.tags.join(" ")} ${formatStoragePath(path)}`
        .toLocaleLowerCase()
        .includes(q)
    );
  });
}
