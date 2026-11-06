CREATE TRIGGER item_assets_insert_guard
BEFORE INSERT ON item_assets
BEGIN
  SELECT RAISE(ABORT, 'archived_item') WHERE EXISTS (SELECT 1 FROM items WHERE id = NEW.item_id AND archived_at IS NOT NULL);
  SELECT RAISE(ABORT, 'too_many_images') WHERE (SELECT count(*) FROM item_assets WHERE item_id = NEW.item_id) >= 20;
END;
--> statement-breakpoint
CREATE TRIGGER item_assets_ready_guard
BEFORE UPDATE OF state ON item_assets WHEN NEW.state = 'ready'
BEGIN
  SELECT RAISE(ABORT, 'archived_item') WHERE EXISTS (SELECT 1 FROM items WHERE id = NEW.item_id AND archived_at IS NOT NULL);
END;
--> statement-breakpoint
CREATE TRIGGER item_assets_delete_guard
BEFORE DELETE ON item_assets
BEGIN
  SELECT RAISE(ABORT, 'asset_in_use') WHERE EXISTS (
    SELECT 1 FROM uses_entries u, json_each(u.images) image WHERE json_extract(image.value, '$.assetId') = OLD.id
  );
END;
--> statement-breakpoint
CREATE TRIGGER item_assets_deleting_guard
BEFORE UPDATE OF state ON item_assets WHEN NEW.state = 'deleting'
BEGIN
  SELECT RAISE(ABORT, 'asset_in_use') WHERE EXISTS (
    SELECT 1 FROM uses_entries u, json_each(u.images) image WHERE json_extract(image.value, '$.assetId') = NEW.id
  );
END;
--> statement-breakpoint
CREATE TRIGGER uses_entries_insert_guard
BEFORE INSERT ON uses_entries
BEGIN
  SELECT RAISE(ABORT, 'archived_item') WHERE NEW.is_published = 1 AND EXISTS (SELECT 1 FROM items WHERE id = NEW.item_id AND archived_at IS NOT NULL);
  SELECT RAISE(ABORT, 'invalid_public_image') WHERE EXISTS (
    SELECT 1 FROM json_each(NEW.images) image LEFT JOIN item_assets a ON a.id = json_extract(image.value, '$.assetId')
    WHERE a.id IS NULL OR a.item_id <> NEW.item_id OR a.state <> 'ready'
  );
END;
--> statement-breakpoint
CREATE TRIGGER uses_entries_update_guard
BEFORE UPDATE OF images, item_id, is_published ON uses_entries
BEGIN
  SELECT RAISE(ABORT, 'archived_item') WHERE NEW.is_published = 1 AND EXISTS (SELECT 1 FROM items WHERE id = NEW.item_id AND archived_at IS NOT NULL);
  SELECT RAISE(ABORT, 'invalid_public_image') WHERE EXISTS (
    SELECT 1 FROM json_each(NEW.images) image LEFT JOIN item_assets a ON a.id = json_extract(image.value, '$.assetId')
    WHERE a.id IS NULL OR a.item_id <> NEW.item_id OR a.state <> 'ready'
  );
END;
--> statement-breakpoint
CREATE TRIGGER items_archive_unpublish
AFTER UPDATE OF archived_at ON items WHEN NEW.archived_at IS NOT NULL AND OLD.archived_at IS NULL
BEGIN
  UPDATE uses_entries SET is_published = 0, public_content = NULL, version = version + 1, updated_at = NEW.updated_at WHERE item_id = NEW.id;
END;
