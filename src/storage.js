const fs = require("fs");
const path = require("path");
const { isValidCaName, isValidSerial } = require("./validate");

const DATA_DIR = path.join(__dirname, "..", "data", "ca");

/**
 * Ensure the data directory exists.
 */
function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// ---------------------------------------------------------------------------
// CA operations
// ---------------------------------------------------------------------------

/**
 * Save a CA (private key + certificate + metadata).
 *
 * @param {string} name - CA name (directory name)
 * @param {object} ca   - { key: forge.pki.PrivateKey, cert: forge.pki.Certificate }
 * @param {object} meta - additional metadata to persist
 */
function saveCA(name, ca, meta = {}) {
  if (!isValidCaName(name)) throw new Error("Invalid CA name");
  const caDir = path.join(DATA_DIR, name);
  ensureDir(caDir);

  const { pki } = require("node-forge");
  const keyPem = pki.privateKeyToPem(ca.key);
  const certPem = pki.certificateToPem(ca.cert);

  fs.writeFileSync(path.join(caDir, "ca-key.pem"), keyPem, "utf8");
  fs.writeFileSync(path.join(caDir, "ca.pem"), certPem, "utf8");

  const metaData = {
    name,
    subject: ca.cert.subject.attributes.map((a) => ({
      name: a.name,
      value: a.value,
    })),
    serialNumber: ca.cert.serialNumber,
    notBefore: ca.cert.validity.notBefore,
    notAfter: ca.cert.validity.notAfter,
    ...meta,
  };
  fs.writeFileSync(path.join(caDir, "meta.json"), JSON.stringify(metaData, null, 2), "utf8");
}

/**
 * List all CAs stored on disk.
 *
 * @returns {Array<{ name: string, subject: string, notAfter: string }>}
 */
function listCAs() {
  ensureDir(DATA_DIR);
  const entries = fs.readdirSync(DATA_DIR, { withFileTypes: true });
  const cas = [];
  for (const entry of entries) {
    if (entry.isDirectory()) {
      const metaPath = path.join(DATA_DIR, entry.name, "meta.json");
      if (fs.existsSync(metaPath)) {
        try {
          const meta = JSON.parse(fs.readFileSync(metaPath, "utf8"));
          cas.push({
            name: entry.name,
            subject: meta.subject,
            serialNumber: meta.serialNumber,
            notBefore: meta.notBefore,
            notAfter: meta.notAfter,
          });
        } catch {
          cas.push({ name: entry.name });
        }
      } else {
        cas.push({ name: entry.name });
      }
    }
  }
  return cas;
}

/**
 * Load raw PEM strings for a CA from disk.
 *
 * @param {string} name
 * @returns {{ keyPem: string, certPem: string } | null}
 */
function loadCA(name) {
  if (!isValidCaName(name)) throw new Error("Invalid CA name");
  const caDir = path.join(DATA_DIR, name);
  const keyPath = path.join(caDir, "ca-key.pem");
  const certPath = path.join(caDir, "ca.pem");
  if (!fs.existsSync(keyPath) || !fs.existsSync(certPath)) {
    return null;
  }
  return {
    keyPem: fs.readFileSync(keyPath, "utf8"),
    certPem: fs.readFileSync(certPath, "utf8"),
  };
}

// ---------------------------------------------------------------------------
// Certificate operations
// ---------------------------------------------------------------------------

/**
 * Save a signed certificate under a CA.
 *
 * @param {string} caName
 * @param {object} certData - { keyPem, certPem, serial, subject, dnsNames, ipAddresses, eku, notAfter, notBefore }
 */
function saveCert(caName, certData) {
  if (!isValidCaName(caName)) throw new Error("Invalid CA name");
  if (!isValidSerial(certData.serial)) throw new Error("Invalid serial number");
  const certDir = path.join(DATA_DIR, caName, "certs", certData.serial);
  ensureDir(certDir);

  fs.writeFileSync(path.join(certDir, "cert.pem"), certData.certPem, "utf8");
  fs.writeFileSync(path.join(certDir, "key.pem"), certData.keyPem, "utf8");

  const meta = {
    serial: certData.serial,
    subject: certData.subject,
    dnsNames: certData.dnsNames || [],
    ipAddresses: certData.ipAddresses || [],
    eku: certData.eku || "serverAuth",
    notBefore: certData.notBefore,
    notAfter: certData.notAfter,
    createdAt: new Date().toISOString(),
  };
  fs.writeFileSync(path.join(certDir, "meta.json"), JSON.stringify(meta, null, 2), "utf8");
}

/**
 * List all certificates under a CA.
 *
 * @param {string} caName
 * @returns {Array<object>}
 */
function listCerts(caName) {
  if (!isValidCaName(caName)) throw new Error("Invalid CA name");
  const certsDir = path.join(DATA_DIR, caName, "certs");
  if (!fs.existsSync(certsDir)) {
    return [];
  }
  const entries = fs.readdirSync(certsDir, { withFileTypes: true });
  const certs = [];
  for (const entry of entries) {
    if (entry.isDirectory()) {
      const metaPath = path.join(certsDir, entry.name, "meta.json");
      if (fs.existsSync(metaPath)) {
        try {
          const meta = JSON.parse(fs.readFileSync(metaPath, "utf8"));
          certs.push(meta);
        } catch {
          certs.push({ serial: entry.name });
        }
      }
    }
  }
  // Sort by creation date descending
  certs.sort((a, b) => {
    const da = a.createdAt ? new Date(a.createdAt) : new Date(0);
    const db = b.createdAt ? new Date(b.createdAt) : new Date(0);
    return db - da;
  });
  return certs;
}

/**
 * Load certificate PEM and key PEM for a specific certificate.
 *
 * @param {string} caName
 * @param {string} serial
 * @returns {{ certPem: string, keyPem: string, meta: object } | null}
 */
function loadCert(caName, serial) {
  if (!isValidCaName(caName)) throw new Error("Invalid CA name");
  if (!isValidSerial(serial)) throw new Error("Invalid serial number");
  const certDir = path.join(DATA_DIR, caName, "certs", serial);
  const certPath = path.join(certDir, "cert.pem");
  const keyPath = path.join(certDir, "key.pem");
  const metaPath = path.join(certDir, "meta.json");
  if (!fs.existsSync(certPath) || !fs.existsSync(keyPath)) {
    return null;
  }
  return {
    certPem: fs.readFileSync(certPath, "utf8"),
    keyPem: fs.readFileSync(keyPath, "utf8"),
    meta: fs.existsSync(metaPath)
      ? JSON.parse(fs.readFileSync(metaPath, "utf8"))
      : {},
  };
}

/**
 * Delete a certificate (files + directory).
 *
 * @param {string} caName
 * @param {string} serial
 * @returns {boolean} true if deleted, false if not found
 */
function deleteCert(caName, serial) {
  if (!isValidCaName(caName)) throw new Error("Invalid CA name");
  if (!isValidSerial(serial)) throw new Error("Invalid serial number");
  const certDir = path.join(DATA_DIR, caName, "certs", serial);
  if (!fs.existsSync(certDir)) {
    return false;
  }
  fs.rmSync(certDir, { recursive: true, force: true });
  return true;
}

module.exports = {
  saveCA,
  listCAs,
  loadCA,
  saveCert,
  listCerts,
  loadCert,
  deleteCert,
};
