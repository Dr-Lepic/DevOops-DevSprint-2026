CREATE TABLE IF NOT EXISTS items (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  quantity INT NOT NULL CHECK (quantity >= 0),
  version INT NOT NULL DEFAULT 0
);

INSERT INTO items (id, name, quantity, version)
VALUES
  ('iftar-box-01', 'Iftar Box 01', 50, 0),
  ('iftar-box-02', 'Iftar Box 02', 50, 0)
ON CONFLICT (id) DO NOTHING;
