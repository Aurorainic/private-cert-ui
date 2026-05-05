const { db, encryptKey, decryptKey } = require("./db");
const { isValidCaName, isValidSerial } = require("./validate");

// ---------------------------------------------------------------------------
// CA operations
// ---------------------------------------------------------------------------

function saveCA(name, { certPem, keyPem, cert, keyType = "rsa" }) {
  if (!isValidCaName(name)) throw new Error("Invalid CA name");
  const enc = encryptKey(keyPem);
  const subject = cert.subject;
  db.prepare(`
    INSERT OR REPLACE INTO cas
      (name, subject, serial, not_before, not_after, cert_pem, key_enc, key_iv, key_tag, key_type)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    name,
    subject,
    cert.serialNumber,
    cert.notBefore.toISOString(),
    cert.notAfter.toISOString(),
    certPem,
    enc.key_enc, enc.key_iv, enc.key_tag,
    keyType
  );
}

function listCAs() {
  return db.prepare("SELECT name, subject, serial, not_before, not_after, key_type FROM cas ORDER BY name").all()
    .map((row) => ({
      name: row.name,
      subject: row.subject,
      serialNumber: row.serial,
      notBefore: row.not_before,
      notAfter: row.not_after,
      keyType: row.key_type,
    }));
}

function loadCA(name) {
  if (!isValidCaName(name)) throw new Error("Invalid CA name");
  const row = db.prepare("SELECT * FROM cas WHERE name = ?").get(name);
  if (!row) return null;
  return {
    certPem: row.cert_pem,
    keyPem: decryptKey(row.key_enc, row.key_iv, row.key_tag),
    keyType: row.key_type,
  };
}

// ---------------------------------------------------------------------------
// Certificate operations
// ---------------------------------------------------------------------------

function saveCert(caName, { certPem, keyPem, cert, keyType = "rsa", subject, dnsNames, ipAddresses, eku }) {
  if (!isValidCaName(caName)) throw new Error("Invalid CA name");
  const serial = cert.serialNumber;
  if (!isValidSerial(serial)) throw new Error("Invalid serial number");
  const enc = encryptKey(keyPem);
  db.prepare(`
    INSERT OR REPLACE INTO certs
      (serial, ca_name, subject, dns_names, ip_addresses, eku, not_before, not_after, created_at,
       cert_pem, key_enc, key_iv, key_tag, key_type)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    serial, caName,
    JSON.stringify(subject),
    JSON.stringify(dnsNames || []),
    JSON.stringify(ipAddresses || []),
    eku || "serverAuth",
    cert.notBefore.toISOString(),
    cert.notAfter.toISOString(),
    new Date().toISOString(),
    certPem,
    enc.key_enc, enc.key_iv, enc.key_tag,
    keyType
  );
}

function listCerts(caName) {
  if (!isValidCaName(caName)) throw new Error("Invalid CA name");
  return db.prepare(
    "SELECT * FROM certs WHERE ca_name = ? ORDER BY created_at DESC"
  ).all(caName).map(rowToMeta);
}

function loadCert(caName, serial) {
  if (!isValidCaName(caName)) throw new Error("Invalid CA name");
  if (!isValidSerial(serial)) throw new Error("Invalid serial number");
  const row = db.prepare("SELECT * FROM certs WHERE ca_name = ? AND serial = ?").get(caName, serial);
  if (!row) return null;
  return {
    certPem: row.cert_pem,
    keyPem: decryptKey(row.key_enc, row.key_iv, row.key_tag),
    meta: rowToMeta(row),
  };
}

function deleteCert(caName, serial) {
  if (!isValidCaName(caName)) throw new Error("Invalid CA name");
  if (!isValidSerial(serial)) throw new Error("Invalid serial number");
  const result = db.prepare("DELETE FROM certs WHERE ca_name = ? AND serial = ?").run(caName, serial);
  return result.changes > 0;
}

function rowToMeta(row) {
  return {
    serial: row.serial,
    caName: row.ca_name,
    subject: JSON.parse(row.subject),
    dnsNames: JSON.parse(row.dns_names),
    ipAddresses: JSON.parse(row.ip_addresses),
    eku: row.eku,
    notBefore: row.not_before,
    notAfter: row.not_after,
    createdAt: row.created_at,
    keyType: row.key_type,
  };
}

module.exports = { saveCA, listCAs, loadCA, saveCert, listCerts, loadCert, deleteCert };
