-- Device links ---------------------------------------------------------------
--
-- Identity here is a client-generated id kept in localStorage, so "be the same
-- person on my phone" means copying that id to the other device. The id is a
-- bearer token that never rotates, so we don't put it in the QR code itself —
-- a photographed screen would hand someone your identity forever. Instead the
-- QR carries a short code that expires in minutes and can be claimed once.

CREATE TABLE device_links (
  code TEXT PRIMARY KEY,        -- short, from the same alphabet as night codes
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  expires_at TEXT NOT NULL,
  claimed_at TEXT               -- NULL until a device redeems it; then spent
);
CREATE INDEX device_links_user ON device_links(user_id);
