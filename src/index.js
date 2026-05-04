const express = require("express");
const path = require("path");
const fs = require("fs");
const { initCA, loadCA } = require("./ca");
const { signCert } = require("./cert");
const storage = require("./storage");
const { isValidCaName, isValidSerial } = require("./validate");

const app = express();
const PORT = process.env.PORT || 3000;

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------
app.use(express.json({ limit: "10kb" }));

// Serve static files from public/
app.use(express.static(path.join(__dirname, "..", "public")));

// Ensure data/ca/ exists on startup
const dataDir = path.join(__dirname, "..", "data", "ca");
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// ---------------------------------------------------------------------------
// Param validation middleware
// ---------------------------------------------------------------------------

/**
 * Validate CA name param — reject anything that isn't alphanumeric, underscore, or hyphen.
 */
app.param("name", (req, _res, next, name) => {
  if (!isValidCaName(name)) {
    return _res.status(400).json({ error: "Invalid CA name" });
  }
  req.validName = name;
  next();
});

/**
 * Validate serial param — reject anything that isn't hex.
 */
app.param("serial", (req, _res, next, serial) => {
  if (!isValidSerial(serial)) {
    return _res.status(400).json({ error: "Invalid serial number" });
  }
  req.validSerial = serial;
  next();
});

// ---------------------------------------------------------------------------
// CA routes
// ---------------------------------------------------------------------------

/**
 * GET /api/ca
 * List all CAs.
 */
app.get("/api/ca", (_req, res) => {
  try {
    const cas = storage.listCAs();
    res.json(cas);
  } catch (err) {
    console.error("[ERROR] GET /api/ca:", err.message);
    res.status(500).json({ error: "Failed to list CAs" });
  }
});

/**
 * POST /api/ca
 * Create a new Root CA.
 * Body: { name: string, subject: { commonName, organizationName, countryName, ... } }
 */
app.post("/api/ca", (req, res) => {
  try {
    const { name, subject } = req.body;
    if (!name || !subject) {
      return res.status(400).json({ error: "name and subject are required" });
    }

    // Check for name collisions
    const existing = storage.listCAs().find((c) => c.name === name);
    if (existing) {
      return res.status(409).json({ error: "CA with this name already exists" });
    }

    console.log("[API] Creating CA:", name);
    const ca = initCA(subject);
    storage.saveCA(name, ca);

    res.status(201).json({
      message: "CA created",
      name,
      serialNumber: ca.cert.serialNumber,
      notBefore: ca.cert.validity.notBefore,
      notAfter: ca.cert.validity.notAfter,
    });
  } catch (err) {
    console.error("[ERROR] POST /api/ca:", err.message);
    res.status(500).json({ error: "Failed to create CA: " + err.message });
  }
});

/**
 * GET /api/ca/:name
 * Get CA metadata by name.
 */
app.get("/api/ca/:name", (req, res) => {
  try {
    const cas = storage.listCAs();
    const ca = cas.find((c) => c.name === req.params.name);
    if (!ca) {
      return res.status(404).json({ error: "CA not found" });
    }
    res.json(ca);
  } catch (err) {
    console.error("[ERROR] GET /api/ca/:name:", err.message);
    res.status(500).json({ error: "Failed to get CA" });
  }
});

/**
 * GET /api/ca/:name/cert.pem
 * Download the CA certificate in PEM format.
 */
app.get("/api/ca/:name/cert.pem", (req, res) => {
  try {
    const caData = storage.loadCA(req.params.name);
    if (!caData) {
      return res.status(404).json({ error: "CA not found" });
    }
    res.setHeader("Content-Type", "application/x-pem-file");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${req.params.name}-ca.pem"`
    );
    res.send(caData.certPem);
  } catch (err) {
    console.error("[ERROR] GET /api/ca/:name/cert.pem:", err.message);
    res.status(500).json({ error: "Failed to download CA certificate" });
  }
});

// ---------------------------------------------------------------------------
// Certificate routes
// ---------------------------------------------------------------------------

/**
 * GET /api/ca/:name/certs
 * List all certificates under a CA.
 */
app.get("/api/ca/:name/certs", (req, res) => {
  try {
    const certs = storage.listCerts(req.params.name);
    res.json(certs);
  } catch (err) {
    console.error("[ERROR] GET /api/ca/:name/certs:", err.message);
    res.status(500).json({ error: "Failed to list certificates" });
  }
});

/**
 * POST /api/ca/:name/certs
 * Sign a new certificate under the given CA.
 * Body: { subject: {...}, dnsNames: [], ipAddresses: [], eku: "serverAuth", days: 364 }
 */
app.post("/api/ca/:name/certs", (req, res) => {
  try {
    const caName = req.params.name;
    const caData = storage.loadCA(caName);
    if (!caData) {
      return res.status(404).json({ error: "CA not found" });
    }

    const { subject, dnsNames, ipAddresses, eku, days } = req.body;
    if (!subject || !subject.commonName) {
      return res.status(400).json({ error: "subject with commonName is required" });
    }

    console.log("[API] Signing certificate for:", subject.commonName);
    const result = signCert(caData.keyPem, caData.certPem, subject, {
      dnsNames: dnsNames || [],
      ipAddresses: ipAddresses || [],
      eku: eku || "serverAuth",
      days: days || 364,
    });

    storage.saveCert(caName, {
      serial: result.cert.serialNumber,
      subject,
      dnsNames: dnsNames || [],
      ipAddresses: ipAddresses || [],
      eku: eku || "serverAuth",
      certPem: result.certPem,
      keyPem: result.keyPem,
      notBefore: result.cert.validity.notBefore.toISOString(),
      notAfter: result.cert.validity.notAfter.toISOString(),
    });

    res.status(201).json({
      message: "Certificate signed",
      serial: result.cert.serialNumber,
      subject,
      notBefore: result.cert.validity.notBefore,
      notAfter: result.cert.validity.notAfter,
    });
  } catch (err) {
    console.error("[ERROR] POST /api/ca/:name/certs:", err.message);
    res.status(500).json({ error: "Failed to sign certificate: " + err.message });
  }
});

/**
 * GET /api/cert/:ca/:serial
 * Get metadata for a specific certificate.
 */
app.get("/api/cert/:ca/:serial", (req, res) => {
  try {
    const certData = storage.loadCert(req.params.ca, req.params.serial);
    if (!certData) {
      return res.status(404).json({ error: "Certificate not found" });
    }
    res.json(certData.meta);
  } catch (err) {
    console.error("[ERROR] GET /api/cert/:ca/:serial:", err.message);
    res.status(500).json({ error: "Failed to get certificate" });
  }
});

/**
 * DELETE /api/cert/:ca/:serial
 * Delete a certificate.
 */
app.delete("/api/cert/:ca/:serial", (req, res) => {
  try {
    const deleted = storage.deleteCert(req.params.ca, req.params.serial);
    if (!deleted) {
      return res.status(404).json({ error: "Certificate not found" });
    }
    res.json({ message: "Certificate deleted" });
  } catch (err) {
    console.error("[ERROR] DELETE /api/cert/:ca/:serial:", err.message);
    res.status(500).json({ error: "Failed to delete certificate" });
  }
});

/**
 * GET /api/cert/:ca/:serial/cert.pem
 * Download certificate PEM.
 */
app.get("/api/cert/:ca/:serial/cert.pem", (req, res) => {
  try {
    const certData = storage.loadCert(req.params.ca, req.params.serial);
    if (!certData) {
      return res.status(404).json({ error: "Certificate not found" });
    }
    res.setHeader("Content-Type", "application/x-pem-file");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${req.params.ca}-${req.params.serial}-cert.pem"`
    );
    res.send(certData.certPem);
  } catch (err) {
    console.error("[ERROR] GET /api/cert/:ca/:serial/cert.pem:", err.message);
    res.status(500).json({ error: "Failed to download certificate" });
  }
});

/**
 * GET /api/cert/:ca/:serial/key.pem
 * Download certificate private key PEM.
 */
app.get("/api/cert/:ca/:serial/key.pem", (req, res) => {
  try {
    const certData = storage.loadCert(req.params.ca, req.params.serial);
    if (!certData) {
      return res.status(404).json({ error: "Certificate not found" });
    }
    res.setHeader("Content-Type", "application/x-pem-file");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${req.params.ca}-${req.params.serial}-key.pem"`
    );
    res.send(certData.keyPem);
  } catch (err) {
    console.error("[ERROR] GET /api/cert/:ca/:serial/key.pem:", err.message);
    res.status(500).json({ error: "Failed to download private key" });
  }
});

// ---------------------------------------------------------------------------
// Fallback – serve index.html for SPA-like routing
// ---------------------------------------------------------------------------
app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "index.html"));
});

// ---------------------------------------------------------------------------
// Error handling middleware
// ---------------------------------------------------------------------------

// JSON parse error
app.use((err, _req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && "body" in err) {
    return res.status(400).json({ error: "Invalid JSON in request body" });
  }
  next(err);
});

// General handler
app.use((err, _req, res, _next) => {
  console.error("[ERROR] Unhandled:", err.message);
  res.status(500).json({ error: "Internal server error" });
});

// ---------------------------------------------------------------------------
// Start server
// ---------------------------------------------------------------------------
app.listen(PORT, () => {
  console.log(`[Server] Private CA Manager running on http://localhost:${PORT}`);
});
