-- 038: Public tracking tokens for shareable tracking links
-- Allows anyone with a token to view load tracking without authentication

CREATE TABLE IF NOT EXISTS tracking_tokens (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  load_number text NOT NULL,
  token       text NOT NULL UNIQUE,
  created_by  uuid NOT NULL REFERENCES profiles(id),
  expires_at  timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  revoked     boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_tracking_tokens_token ON tracking_tokens(token);
CREATE INDEX idx_tracking_tokens_load ON tracking_tokens(load_number);

ALTER TABLE tracking_tokens ENABLE ROW LEVEL SECURITY;

-- Authenticated users can create tokens
CREATE POLICY "Authenticated users can create tracking tokens"
  ON tracking_tokens FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid());

-- Anyone (including anon) can read tokens to validate them
CREATE POLICY "Anyone can read tracking tokens"
  ON tracking_tokens FOR SELECT
  USING (true);

-- Token creator can revoke
CREATE POLICY "Token creator can update (revoke)"
  ON tracking_tokens FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid());
