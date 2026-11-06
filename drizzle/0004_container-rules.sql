-- Preserve existing storage relationships when enabling explicit containers.
UPDATE items SET is_container = 1
WHERE EXISTS (SELECT 1 FROM items AS child WHERE child.container_item_id = items.id);
--> statement-breakpoint
CREATE TRIGGER items_require_container_insert
BEFORE INSERT ON items
BEGIN
  SELECT RAISE(ABORT, 'not_a_container')
  WHERE EXISTS (SELECT 1 FROM items WHERE id = NEW.container_item_id AND is_container <> 1);
END;
--> statement-breakpoint
CREATE TRIGGER items_require_container_update
BEFORE UPDATE OF container_item_id ON items
BEGIN
  SELECT RAISE(ABORT, 'not_a_container')
  WHERE EXISTS (SELECT 1 FROM items WHERE id = NEW.container_item_id AND is_container <> 1);
END;
--> statement-breakpoint
CREATE TRIGGER items_container_flag_update
BEFORE UPDATE OF is_container ON items
WHEN NEW.is_container <> 1
BEGIN
  SELECT RAISE(ABORT, 'container_flag_in_use')
  WHERE EXISTS (SELECT 1 FROM items WHERE container_item_id = NEW.id);
END;
--> statement-breakpoint
CREATE TRIGGER items_number_immutable
BEFORE UPDATE OF number, registration_year ON items
WHEN NEW.number <> OLD.number OR NEW.registration_year IS NOT OLD.registration_year
BEGIN
  SELECT RAISE(ABORT, 'item_number_immutable');
END;
