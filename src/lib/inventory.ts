export const statusLabels = {
  available: "通常",
  lent: "貸出中",
  lost: "紛失",
  retired: "管理終了",
} as const;

export const ownershipLabels = { owned: "自分の物", borrowed: "借りている物" } as const;

export type ItemStatus = keyof typeof statusLabels;
export type Ownership = keyof typeof ownershipLabels;

export type Location = {
  id: string;
  name: string;
  parentId: string | null;
  version: number;
  createdAt: number;
  updatedAt: number;
};

export type Item = {
  id: string;
  number: number;
  registrationYear: number | null;
  name: string;
  description: string;
  isContainer: boolean;
  tags: string[];
  status: ItemStatus;
  ownership: Ownership;
  locationId: string | null;
  containerItemId: string | null;
  archivedAt: number | null;
  version: number;
  createdAt: number;
  updatedAt: number;
};

export type StoragePart = { id: string; name: string; kind: "location" | "item"; code?: string };
export type Inventory = { items: Item[]; locations: Location[] };

export function itemCode(item: Pick<Item, "number" | "registrationYear">) {
  return `M-${item.registrationYear === null ? "" : `${item.registrationYear}-`}${String(item.number).padStart(6, "0")}`;
}

export function registrationYearAt(timestamp: number) {
  return Number(new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Tokyo", year: "numeric" }).format(timestamp));
}

export function storagePath(item: Item, inventory: Inventory): StoragePart[] {
  const itemMap = new Map(inventory.items.map((entry) => [entry.id, entry]));
  const locationMap = new Map(inventory.locations.map((entry) => [entry.id, entry]));
  const parts: StoragePart[] = [];
  const visited = new Set<string>([item.id]);
  let containerId = item.containerItemId;
  let locationId = item.locationId;

  while (containerId) {
    const container = itemMap.get(containerId);
    if (!container || visited.has(container.id)) break;
    visited.add(container.id);
    parts.unshift({ id: container.id, name: container.name, kind: "item", code: itemCode(container) });
    containerId = container.containerItemId;
    locationId = container.locationId;
  }
  while (locationId) {
    const location = locationMap.get(locationId);
    if (!location || visited.has(location.id)) break;
    visited.add(location.id);
    parts.unshift({ id: location.id, name: location.name, kind: "location" });
    locationId = location.parentId;
  }
  return parts;
}

export function locationPath(location: Location, locations: Location[]): Location[] {
  const byId = new Map(locations.map((entry) => [entry.id, entry]));
  const path: Location[] = [];
  const visited = new Set<string>();
  let current: Location | undefined = location;
  while (current && !visited.has(current.id)) {
    visited.add(current.id);
    path.unshift(current);
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }
  return path;
}

export function storageLabel(item: Item, inventory: Inventory) {
  const path = storagePath(item, inventory);
  if (!path.length) return "未設定";
  const root = inventory.items.find((entry) => entry.id === path[0].id);
  return `${root ? "（場所未設定） › " : ""}${path.map((part) => part.name).join(" › ")}`;
}

export function containerChoices(inventory: Inventory, itemId?: string) {
  return inventory.items.filter(
    (item) =>
      item.archivedAt === null &&
      item.isContainer &&
      item.id !== itemId &&
      !storagePath(item, inventory).some((part) => part.kind === "item" && part.id === itemId),
  );
}

export function availableTags(inventory: Inventory) {
  return [...new Set(inventory.items.flatMap((item) => item.tags))].sort((a, b) => a.localeCompare(b, "ja"));
}

export function filterItems(
  inventory: Inventory,
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
      `${itemCode(item)} ${item.name} ${item.description} ${item.tags.join(" ")} ${storageLabel(item, inventory)}`
        .toLocaleLowerCase()
        .includes(q)
    );
  });
}
