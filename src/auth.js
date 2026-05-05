const bcrypt = require("bcrypt");
const { db } = require("./db");

const SALT_ROUNDS = 12;

function isSetupDone() {
  const result = db.prepare("SELECT COUNT(*) as n FROM users").get();
  return result.n > 0;
}

async function setupUser(username, password) {
  if (!username || username.length < 2 || username.length > 32) {
    throw new Error("Username must be 2–32 characters");
  }
  if (!password || password.length < 8) {
    throw new Error("Password must be at least 8 characters");
  }

  const existing = db.prepare("SELECT id FROM users WHERE username = ?").get(username);
  if (existing) {
    throw new Error("User already exists");
  }

  const hash = await bcrypt.hash(password, SALT_ROUNDS);
  try {
    db.prepare("INSERT INTO users (username, password_hash) VALUES (?, ?)").run(username, hash);
  } catch (err) {
    if (err.message.includes("UNIQUE constraint failed")) {
      throw new Error("User already exists");
    }
    throw err;
  }
}

async function verifyUser(username, password) {
  if (!username || !password) {
    throw new Error("Username and password required");
  }

  const row = db.prepare("SELECT password_hash FROM users WHERE username = ?").get(username);
  if (!row) {
    throw new Error("Invalid credentials");
  }

  const isValid = await bcrypt.compare(password, row.password_hash);
  if (!isValid) {
    throw new Error("Invalid credentials");
  }

  return true;
}

function requireAuth(req, res, next) {
  if (req.session && req.session.user) {
    return next();
  }
  res.status(401).json({ error: "Unauthorized" });
}

module.exports = { isSetupDone, setupUser, verifyUser, requireAuth };
