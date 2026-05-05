const express = require("express");
const path = require("path");
const { initCA } = require("./ca");
const { signCert } = require("./cert");
const storage = require("./storage");
const { isValidCaName, isValidSerial } = require("./validate");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: "10kb" }));
app.use(express.static(path.join(__dirname, "..", "public")));

app.param("name", (req, res, next, name) => {
  if (!isValidCaName(name)) return res.status(400).json({ error: "Invalid CA name" });
  next();
});

app.param("serial", (req, res, next, serial) => {
  if (!isValidSerial(serial)) return res.status(400).json({ error: "Invalid serial number" });
  next();
});

// ---------------------------------------------------------------------------
// CA routes
// ---------------------------------------------------------------------------

app.get("/api/ca", (_req, res) => {
  try {
    res.json(storage.listCAs());
  } catch (err) {
    res.status(500).json({ error: "Failed to list CAs" });
  }
});

app.post("/api/ca", async (req, res) => {
  try {
    const { name, subject, keyType = "rsa" } = req.body;
    if (!name || !subject) return res.status(400).json({ error: "name and subject are required" });
    if (!["rsa", "ed25519"].includes(keyType)) return res.status(400).json({ error: "keyType must be rsa or ed25519" });
    if (storage.listCAs().find((c) => c.name === name)) {
      return res.status(409).json({ error: "CA with this name already exists" });
    }

    console.log(`[API] Creating CA: ${name} (${keyType})`);
    const ca = await initCA(subject, keyType);
    storage.saveCA(name, ca);

    res.status(201).json({
      message: "CA created",
      name,
      serialNumber: ca.cert.serialNumber,
      notBefore: ca.cert.notBefore,
      notAfter: ca.cert.notAfter,
      keyType,
    });
  } catch (err) {
    console.error("[ERROR] POST /api/ca:", err.message);
    res.status(500).json({ error: "Failed to create CA: " + err.message });
  }
});

app.get("/api/ca/:name", (req, res) => {
  try {
    const ca = storage.listCAs().find((c) => c.name === req.params.name);
    if (!ca) return res.status(404).json({ error: "CA not found" });
    res.json(ca);
  } catch (err) {
    res.status(500).json({ error: "Failed to get CA" });
  }
});

app.get("/api/ca/:name/cert.pem", (req, res) => {
  try {
    const caData = storage.loadCA(req.params.name);
    if (!caData) return res.status(404).json({ error: "CA not found" });
    res.setHeader("Content-Type", "application/x-pem-file");
    res.setHeader("Content-Disposition", `attachment; filename="${req.params.name}-ca.pem"`);
    res.send(caData.certPem);
  } catch (err) {
    res.status(500).json({ error: "Failed to download CA certificate" });
  }
});

// ---------------------------------------------------------------------------
// Certificate routes
// ---------------------------------------------------------------------------

app.get("/api/ca/:name/certs", (req, res) => {
  try {
    res.json(storage.listCerts(req.params.name));
  } catch (err) {
    res.status(500).json({ error: "Failed to list certificates" });
  }
});

app.post("/api/ca/:name/certs", async (req, res) => {
  try {
    const caName = req.params.name;
    const caData = storage.loadCA(caName);
    if (!caData) return res.status(404).json({ error: "CA not found" });

    const { subject, dnsNames, ipAddresses, eku, days, keyType = "rsa" } = req.body;
    if (!subject?.commonName) return res.status(400).json({ error: "subject.commonName is required" });
    if (!["rsa", "ed25519"].includes(keyType)) return res.status(400).json({ error: "keyType must be rsa or ed25519" });

    console.log(`[API] Signing cert for: ${subject.commonName} (${keyType})`);
    const result = await signCert(caData.keyPem, caData.certPem, caData.keyType, subject, {
      dnsNames: dnsNames || [],
      ipAddresses: ipAddresses || [],
      eku: eku || "serverAuth",
      days: days || 364,
      keyType,
    });

    storage.saveCert(caName, { ...result, subject, dnsNames, ipAddresses, eku });

    res.status(201).json({
      message: "Certificate signed",
      serial: result.cert.serialNumber,
      subject,
      notBefore: result.cert.notBefore,
      notAfter: result.cert.notAfter,
      keyType,
    });
  } catch (err) {
    console.error("[ERROR] POST /api/ca/:name/certs:", err.message);
    res.status(500).json({ error: "Failed to sign certificate: " + err.message });
  }
});

app.get("/api/cert/:ca/:serial", (req, res) => {
  try {
    const certData = storage.loadCert(req.params.ca, req.params.serial);
    if (!certData) return res.status(404).json({ error: "Certificate not found" });
    res.json(certData.meta);
  } catch (err) {
    res.status(500).json({ error: "Failed to get certificate" });
  }
});

app.delete("/api/cert/:ca/:serial", (req, res) => {
  try {
    if (!storage.deleteCert(req.params.ca, req.params.serial)) {
      return res.status(404).json({ error: "Certificate not found" });
    }
    res.json({ message: "Certificate deleted" });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete certificate" });
  }
});

app.get("/api/cert/:ca/:serial/cert.pem", (req, res) => {
  try {
    const certData = storage.loadCert(req.params.ca, req.params.serial);
    if (!certData) return res.status(404).json({ error: "Certificate not found" });
    res.setHeader("Content-Type", "application/x-pem-file");
    res.setHeader("Content-Disposition", `attachment; filename="${req.params.ca}-${req.params.serial}-cert.pem"`);
    res.send(certData.certPem);
  } catch (err) {
    res.status(500).json({ error: "Failed to download certificate" });
  }
});

app.get("/api/cert/:ca/:serial/key.pem", (req, res) => {
  try {
    const certData = storage.loadCert(req.params.ca, req.params.serial);
    if (!certData) return res.status(404).json({ error: "Certificate not found" });
    res.setHeader("Content-Type", "application/x-pem-file");
    res.setHeader("Content-Disposition", `attachment; filename="${req.params.ca}-${req.params.serial}-key.pem"`);
    res.send(certData.keyPem);
  } catch (err) {
    res.status(500).json({ error: "Failed to download private key" });
  }
});

// SPA fallback
app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "index.html"));
});

// Error handlers
app.use((err, _req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && "body" in err) {
    return res.status(400).json({ error: "Invalid JSON in request body" });
  }
  next(err);
});

app.use((err, _req, res, _next) => {
  console.error("[ERROR]", err.message);
  res.status(500).json({ error: "Internal server error" });
});

app.listen(PORT, () => {
  console.log(`[Server] Private CA Manager running on http://localhost:${PORT}`);
});
