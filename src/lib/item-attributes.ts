export const itemStatuses = ["available", "lent", "lost", "retired"] as const;
export const ownerships = ["owned", "borrowed"] as const;

export type ItemStatus = (typeof itemStatuses)[number];
export type Ownership = (typeof ownerships)[number];

export const statusLabels = {
  available: "通常",
  lent: "貸出中",
  lost: "紛失",
  retired: "管理終了",
} satisfies Record<ItemStatus, string>;

export const ownershipLabels = {
  owned: "自分の物",
  borrowed: "借りている物",
} satisfies Record<Ownership, string>;
