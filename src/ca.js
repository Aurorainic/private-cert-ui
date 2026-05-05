require("reflect-metadata");
const { Crypto } = require("@peculiar/webcrypto");
const x509 = require("@peculiar/x509");
const { randomSerial } = require("./db");

const webcrypto = new Crypto();
x509.cryptoProvider.set(webcrypto);

// ---------------------------------------------------------------------------
// Key algorithm descriptors
// ---------------------------------------------------------------------------
const ALG = {
  rsa: {
    name: "RSASSA-PKCS1-v1_5",
    hash: "SHA-256",
    publicExponent: new Uint8Array([1, 0, 1]),
    modulusLength: 4096,
  },
  ed25519: { name: "Ed25519" },
};

const SIGN_ALG = {
  rsa: { name: "RSASSA-PKCS1-v1_5" },
  ed25519: { name: "Ed25519" },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function buildName(subject) {
  const parts = [];
  if (subject.countryName) parts.push(`C=${subject.countryName}`);
  if (subject.stateOrProvinceName) parts.push(`ST=${subject.stateOrProvinceName}`);
  if (subject.localityName) parts.push(`L=${subject.localityName}`);
  if (subject.organizationName) parts.push(`O=${subject.organizationName}`);
  if (subject.commonName) parts.push(`CN=${subject.commonName}`);
  return parts.join(", ");
}

async function exportKeyPem(cryptoKey) {
  const buf = await webcrypto.subtle.exportKey("pkcs8", cryptoKey);
  const b64 = Buffer.from(buf).toString("base64").match(/.{1,64}/g).join("\n");
  return `-----BEGIN PRIVATE KEY-----\n${b64}\n-----END PRIVATE KEY-----\n`;
}

async function importPrivateKey(pem, keyType) {
  const b64 = pem.replace(/-----[^-]+-----/g, "").replace(/\s/g, "");
  const buf = Buffer.from(b64, "base64");
  return webcrypto.subtle.importKey("pkcs8", buf, ALG[keyType], true, ["sign"]);
}

async function importPublicKey(pem, keyType) {
  const b64 = pem.replace(/-----[^-]+-----/g, "").replace(/\s/g, "");
  const buf = Buffer.from(b64, "base64");
  return webcrypto.subtle.importKey("spki", buf, ALG[keyType], true, ["verify"]);
}

// ---------------------------------------------------------------------------
// initCA — generate a self-signed root CA certificate
// ---------------------------------------------------------------------------
async function initCA(subject, keyType = "rsa") {
  const alg = ALG[keyType];
  const keys = await webcrypto.subtle.generateKey(alg, true, ["sign", "verify"]);

  const now = new Date();
  // Backdate by 2 minutes to tolerate minor clock skew on verifying clients
  const notBefore = new Date(now.getTime() - 2 * 60 * 1000);
  const notAfter = new Date(now);
  notAfter.setFullYear(notAfter.getFullYear() + 10);

  const cert = await x509.X509CertificateGenerator.createSelfSigned({
    serialNumber: randomSerial(),
    name: buildName(subject),
    notBefore,
    notAfter,
    signingAlgorithm: SIGN_ALG[keyType],
    keys,
    extensions: [
      new x509.BasicConstraintsExtension(true, undefined, true),
      new x509.KeyUsagesExtension(
        x509.KeyUsageFlags.keyCertSign | x509.KeyUsageFlags.cRLSign | x509.KeyUsageFlags.digitalSignature,
        true
      ),
      await x509.SubjectKeyIdentifierExtension.create(keys.publicKey, false, webcrypto),
    ],
  });

  const keyPem = await exportKeyPem(keys.privateKey);
  const certPem = cert.toString("pem");

  console.log(`[CA] Root CA created (${keyType.toUpperCase()}, valid until ${notAfter.toISOString().slice(0, 10)})`);
  return { certPem, keyPem, cert, keyType };
}

module.exports = { initCA, importPrivateKey, importPublicKey, exportKeyPem, buildName, ALG, SIGN_ALG, webcrypto };
