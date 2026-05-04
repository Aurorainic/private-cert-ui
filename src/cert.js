const forge = require("node-forge");

/**
 * Sign a new end-entity certificate under the given CA.
 *
 * @param {string} caKeyPem  - PEM-encoded CA private key
 * @param {string} caCertPem - PEM-encoded CA certificate
 * @param {object} subject   - subject fields (commonName, organizationName, countryName, etc.)
 * @param {object} options   - { dnsNames: [], ipAddresses: [], eku: "serverAuth"|"clientAuth", days: 364 }
 * @returns {{ key: forge.pki.PrivateKey, cert: forge.pki.Certificate, keyPem: string, certPem: string }}
 */
function signCert(caKeyPem, caCertPem, subject, options = {}) {
  const caKey = forge.pki.privateKeyFromPem(caKeyPem);
  const caCert = forge.pki.certificateFromPem(caCertPem);

  // Default options
  const dnsNames = options.dnsNames || [];
  const ipAddresses = options.ipAddresses || [];
  const eku = options.eku || "serverAuth";
  const days = options.days || 364;

  // Generate 2048-bit key pair for the new cert
  console.log("[CERT] Generating 2048-bit RSA key pair...");
  const keys = forge.pki.rsa.generateKeyPair(2048);

  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;

  // Random serial number (8 bytes, hex-encoded)
  cert.serialNumber = randomSerial();

  const now = new Date();
  cert.validity.notBefore = now;
  cert.validity.notAfter = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + days
  );

  // Subject
  const subjectAttrs = [];
  if (subject.commonName) {
    subjectAttrs.push({ name: "commonName", value: subject.commonName });
  }
  if (subject.organizationName) {
    subjectAttrs.push({ name: "organizationName", value: subject.organizationName });
  }
  if (subject.countryName) {
    subjectAttrs.push({ name: "countryName", value: subject.countryName });
  }
  if (subject.stateOrProvinceName) {
    subjectAttrs.push({ name: "stateOrProvinceName", value: subject.stateOrProvinceName });
  }
  if (subject.localityName) {
    subjectAttrs.push({ name: "localityName", value: subject.localityName });
  }
  cert.setSubject(subjectAttrs);

  // Issuer = CA subject
  cert.setIssuer(caCert.subject.attributes);

  // Extensions
  const extensions = [
    {
      name: "basicConstraints",
      cA: false,
      critical: true,
    },
    {
      name: "keyUsage",
      digitalSignature: true,
      keyEncipherment: true,
      critical: true,
    },
    {
      name: "extKeyUsage",
      serverAuth: eku === "serverAuth",
      clientAuth: eku === "clientAuth" || eku === "serverAuth",
      critical: true,
    },
    {
      name: "subjectKeyIdentifier",
    },
    {
      name: "authorityKeyIdentifier",
      keyIdentifier: true,
    },
  ];

  // SAN
  const sanAltNames = [];
  for (const dns of dnsNames) {
    sanAltNames.push({ type: 2, value: dns }); // DNS
  }
  for (const ip of ipAddresses) {
    sanAltNames.push({ type: 7, value: ip }); // IP
  }
  if (sanAltNames.length > 0) {
    extensions.push({
      name: "subjectAltName",
      altNames: sanAltNames,
    });
  }

  cert.setExtensions(extensions);

  // Sign with CA key
  cert.sign(caKey, forge.md.sha256.create());

  const keyPem = forge.pki.privateKeyToPem(keys.privateKey);
  const certPem = forge.pki.certificateToPem(cert);

  console.log("[CERT] Certificate signed for " + subject.commonName + " (serial: " + cert.serialNumber + ")");
  return { key: keys.privateKey, cert, keyPem, certPem };
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

module.exports = { signCert };
