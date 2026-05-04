const forge = require("node-forge");

/**
 * Initialize a new Root CA: generates a 4096-bit RSA key pair and a
 * self-signed CA certificate valid for 10 years with CA:TRUE constraint.
 *
 * @param {object} subject - subject fields {commonName, organizationName, countryName, stateOrProvinceName, localityName}
 * @returns {{ key: forge.pki.PrivateKey, cert: forge.pki.Certificate }}
 */
function initCA(subject) {
  console.log("[CA] Generating 4096-bit RSA key pair...");
  const keys = forge.pki.rsa.generateKeyPair(4096);

  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = randomSerial();

  const now = new Date();
  cert.validity.notBefore = now;
  cert.validity.notAfter = new Date(
    now.getFullYear() + 10,
    now.getMonth(),
    now.getDate()
  );

  const attrs = buildSubjectAttrs(subject);
  cert.setSubject(attrs);
  cert.setIssuer(attrs);

  cert.setExtensions([
    {
      name: "basicConstraints",
      cA: true,
      critical: true,
    },
    {
      name: "keyUsage",
      keyCertSign: true,
      cRLSign: true,
      critical: true,
    },
    {
      name: "subjectKeyIdentifier",
    },
    {
      name: "authorityKeyIdentifier",
      keyIdentifier: true,
    },
  ]);

  // Self-sign
  cert.sign(keys.privateKey, forge.md.sha256.create());

  console.log("[CA] Root CA certificate created (valid until " + cert.validity.notAfter + ")");
  return { key: keys.privateKey, cert };
}

/**
 * Load a CA from existing PEM-encoded key and certificate.
 *
 * @param {string} keyPem - PEM-encoded private key
 * @param {string} certPem - PEM-encoded certificate
 * @returns {{ key: forge.pki.PrivateKey, cert: forge.pki.Certificate }}
 */
function loadCA(keyPem, certPem) {
  const key = forge.pki.privateKeyFromPem(keyPem);
  const cert = forge.pki.certificateFromPem(certPem);
  return { key, cert };
}

/**
 * Convert a subject object to an array of forge attribute objects.
 */
function buildSubjectAttrs(subject) {
  const attrs = [];
  if (subject.commonName) {
    attrs.push({ name: "commonName", value: subject.commonName });
  }
  if (subject.organizationName) {
    attrs.push({ name: "organizationName", value: subject.organizationName });
  }
  if (subject.countryName) {
    attrs.push({ name: "countryName", value: subject.countryName });
  }
  if (subject.stateOrProvinceName) {
    attrs.push({ name: "stateOrProvinceName", value: subject.stateOrProvinceName });
  }
  if (subject.localityName) {
    attrs.push({ name: "localityName", value: subject.localityName });
  }
  return attrs;
}

/**
 * Generate a random hex serial number (8 bytes).
 */
function randomSerial() {
  const bytes = forge.random.getBytesSync(8);
  let hex = "";
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes.charCodeAt(i).toString(16);
    hex += b.length === 1 ? "0" + b : b;
  }
  return hex.toUpperCase();
}

module.exports = { initCA, loadCA };
