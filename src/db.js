const crypto = require("crypto");
const path = require("path");
const Database = require("better-sqlite3");

// ---------------------------------------------------------------------------
// Master key — AES-256-GCM encryption for all stored private keys
// ---------------------------------------------------------------------------
let masterKey;
if (process.env.CA_MASTER_KEY) {
  const buf = Buffer.from(process.env.CA_MASTER_KEY, "hex");
  if (buf.length !== 32) throw new Error("CA_MASTER_KEY must be 64 hex chars (32 bytes)");
  masterKey = buf;
} else {
  masterKey = crypto.randomBytes(32);
  console.warn("[WARN] CA_MASTER_KEY not set. Generated ephemeral key (data lost on restart):");
  console.warn("  CA_MASTER_KEY=" + masterKey.toString("hex"));
  console.warn("  Set this env var to persist private key decryption across restarts.");
}

function encryptKey(pem) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", masterKey, iv);
  const enc = Buffer.concat([cipher.update(pem, "utf8"), cipher.final()]);
  return {
    key_enc: enc.toString("base64"),
    key_iv: iv.toString("base64"),
    key_tag: cipher.getAuthTag().toString("base64"),
  };
}

function decryptKey(enc, iv, tag) {
  const decipher = crypto.createDecipheriv("aes-256-gcm", masterKey, Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return decipher.update(Buffer.from(enc, "base64")) + decipher.final("utf8");
}

// ---------------------------------------------------------------------------
// Random serial number (8 bytes, uppercase hex)
// ---------------------------------------------------------------------------
function randomSerial() {
  const bytes = crypto.randomBytes(8);
  // RFC 5280: serial must be a positive integer. Clear the MSB to prevent
  // DER interpreting the value as negative (two's complement).
  bytes[0] &= 0x7f;
  // Ensure non-zero (astronomically unlikely but guard anyway)
  bytes[0] |= 0x01;
  return bytes.toString("hex").toUpperCase();
}

// ---------------------------------------------------------------------------
// SQLite setup
// ---------------------------------------------------------------------------
const DB_PATH = path.join(__dirname, "..", "data", "ca.db");

// Ensure data dir exists
const fs = require("fs");
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id          INTEGER PRIMARY KEY,
    username    TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS cas (
    name      TEXT PRIMARY KEY,
    subject   TEXT NOT NULL,
    serial    TEXT NOT NULL,
    not_before TEXT NOT NULL,
    not_after  TEXT NOT NULL,
    cert_pem  TEXT NOT NULL,
    key_enc   TEXT NOT NULL,
    key_iv    TEXT NOT NULL,
    key_tag   TEXT NOT NULL,
    key_type  TEXT NOT NULL DEFAULT 'rsa'
  );

  CREATE TABLE IF NOT EXISTS certs (
    serial       TEXT NOT NULL,
    ca_name      TEXT NOT NULL REFERENCES cas(name) ON DELETE CASCADE,
    subject      TEXT NOT NULL,
    dns_names    TEXT NOT NULL DEFAULT '[]',
    ip_addresses TEXT NOT NULL DEFAULT '[]',
    eku          TEXT NOT NULL DEFAULT 'serverAuth',
    not_before   TEXT NOT NULL,
    not_after    TEXT NOT NULL,
    created_at   TEXT NOT NULL,
    cert_pem     TEXT NOT NULL,
    key_enc      TEXT NOT NULL,
    key_iv       TEXT NOT NULL,
    key_tag      TEXT NOT NULL,
    key_type     TEXT NOT NULL DEFAULT 'rsa',
    PRIMARY KEY (serial, ca_name)
  );
`);

module.exports = { db, encryptKey, decryptKey, randomSerial };
