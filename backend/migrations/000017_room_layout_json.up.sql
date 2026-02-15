-- Store full layout (cells, walls, pillars, screens, etc.) per room for the canvas builder and room view
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS layout_json JSONB DEFAULT NULL;
