-- Keep hierarchy validation in the same atomic statement as each write.
CREATE TRIGGER locations_storage_insert
BEFORE INSERT ON locations
BEGIN
  SELECT RAISE(ABORT, 'location_cycle')
  WHERE NEW.parent_id = NEW.id OR EXISTS (
    WITH RECURSIVE ancestors(id, parent_id) AS (
      SELECT id, parent_id FROM locations WHERE id = NEW.parent_id
      UNION
      SELECT l.id, l.parent_id FROM locations l JOIN ancestors a ON l.id = a.parent_id
    )
    SELECT 1 FROM ancestors WHERE id = NEW.id
  );
END;
--> statement-breakpoint
CREATE TRIGGER locations_storage_update
BEFORE UPDATE OF parent_id ON locations
BEGIN
  SELECT RAISE(ABORT, 'location_cycle')
  WHERE NEW.parent_id = NEW.id OR EXISTS (
    WITH RECURSIVE ancestors(id, parent_id) AS (
      SELECT id, parent_id FROM locations WHERE id = NEW.parent_id
      UNION
      SELECT l.id, l.parent_id FROM locations l JOIN ancestors a ON l.id = a.parent_id
    )
    SELECT 1 FROM ancestors WHERE id = NEW.id
  );
END;
--> statement-breakpoint
CREATE TRIGGER items_storage_insert
BEFORE INSERT ON items
BEGIN
  SELECT RAISE(ABORT, 'archived_container')
  WHERE EXISTS (SELECT 1 FROM items WHERE id = NEW.container_item_id AND archived_at IS NOT NULL);
  SELECT RAISE(ABORT, 'item_cycle')
  WHERE NEW.container_item_id = NEW.id OR EXISTS (
    WITH RECURSIVE ancestors(id, container_item_id) AS (
      SELECT id, container_item_id FROM items WHERE id = NEW.container_item_id
      UNION
      SELECT i.id, i.container_item_id FROM items i JOIN ancestors a ON i.id = a.container_item_id
    )
    SELECT 1 FROM ancestors WHERE id = NEW.id
  );
END;
--> statement-breakpoint
CREATE TRIGGER items_storage_update
BEFORE UPDATE OF container_item_id ON items
BEGIN
  SELECT RAISE(ABORT, 'archived_container')
  WHERE EXISTS (SELECT 1 FROM items WHERE id = NEW.container_item_id AND archived_at IS NOT NULL);
  SELECT RAISE(ABORT, 'item_cycle')
  WHERE NEW.container_item_id = NEW.id OR EXISTS (
    WITH RECURSIVE ancestors(id, container_item_id) AS (
      SELECT id, container_item_id FROM items WHERE id = NEW.container_item_id
      UNION
      SELECT i.id, i.container_item_id FROM items i JOIN ancestors a ON i.id = a.container_item_id
    )
    SELECT 1 FROM ancestors WHERE id = NEW.id
  );
END;
--> statement-breakpoint
CREATE TRIGGER items_archive_nonempty
BEFORE UPDATE OF archived_at ON items
WHEN NEW.archived_at IS NOT NULL AND OLD.archived_at IS NULL
BEGIN
  SELECT RAISE(ABORT, 'container_not_empty')
  WHERE EXISTS (SELECT 1 FROM items WHERE container_item_id = NEW.id);
END;
