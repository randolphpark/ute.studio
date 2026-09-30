CREATE TABLE pending_subscriptions (
  email TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  requested_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  last_sent_at INTEGER NOT NULL,
  processing_until INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX pending_expiry ON pending_subscriptions(expires_at);

CREATE TABLE subscription_consents (
  email TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  confirmed_at INTEGER NOT NULL,
  consent_version TEXT NOT NULL
);

CREATE TABLE newsletter_rate_limits (
  key TEXT PRIMARY KEY,
  hits INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX rate_limit_expiry ON newsletter_rate_limits(expires_at);
