require("reflect-metadata");
const x509 = require("@peculiar/x509");
const { randomSerial } = require("./db");
const { importPrivateKey, importPublicKey, exportKeyPem, buildName, ALG, SIGN_ALG, webcrypto } = require("./ca");

// ---------------------------------------------------------------------------
// signCert — sign an end-entity certificate under a CA
// ---------------------------------------------------------------------------
async function signCert(caKeyPem, caCertPem, caKeyType, subject, options = {}) {
  const dnsNames = options.dnsNames || [];
  const ipAddresses = options.ipAddresses || [];
  const eku = options.eku || "serverAuth";
  const days = options.days || 364;
  const keyType = options.keyType || "rsa";

  // Generate leaf key pair
  const leafAlg = ALG[keyType];
  const leafKeys = await webcrypto.subtle.generateKey(leafAlg, true, ["sign", "verify"]);

  // Load CA key and cert
  const caPrivKey = await importPrivateKey(caKeyPem, caKeyType);
  const caCert = new x509.X509Certificate(caCertPem);

  const now = new Date();
  // Backdate by 2 minutes to tolerate minor clock skew on verifying clients
  const notBefore = new Date(now.getTime() - 2 * 60 * 1000);
  const notAfter = new Date(now);
  notAfter.setDate(notAfter.getDate() + days);

  // KeyUsage: Ed25519 is a signature-only algorithm — keyEncipherment does not apply.
  // RSA certs used for TLS key exchange need keyEncipherment; ECDH/EdDSA do not.
  const keyUsageFlags = keyType === "rsa"
    ? x509.KeyUsageFlags.digitalSignature | x509.KeyUsageFlags.keyEncipherment
    : x509.KeyUsageFlags.digitalSignature;

  // EKU: honour the user's choice exactly — don't silently add clientAuth to serverAuth certs.
  const ekuOids = eku === "serverAuth"
    ? [x509.ExtendedKeyUsage.serverAuth]
    : [x509.ExtendedKeyUsage.clientAuth];

  const extensions = [
    // BasicConstraints non-critical on leaf certs is conventional; critical is also valid
    // but unnecessary since cA=false is the default interpretation.
    new x509.BasicConstraintsExtension(false, undefined, false),
    new x509.KeyUsagesExtension(keyUsageFlags, true),
    // EKU non-critical: unknown-EKU-aware software should still accept the cert.
    new x509.ExtendedKeyUsageExtension(ekuOids, false),
    await x509.SubjectKeyIdentifierExtension.create(leafKeys.publicKey, false, webcrypto),
    await x509.AuthorityKeyIdentifierExtension.create(caCert, false, webcrypto),
  ];

  // SAN: required by RFC 2818 for TLS server certs. Auto-include CN as a DNS SAN
  // when no explicit SANs are provided, so the cert works in modern browsers/clients.
  const effectiveDns = [...dnsNames];
  if (eku === "serverAuth" && effectiveDns.length === 0 && ipAddresses.length === 0 && subject.commonName) {
    effectiveDns.push(subject.commonName);
  }

  if (effectiveDns.length > 0 || ipAddresses.length > 0) {
    const altNames = [
      ...effectiveDns.map((v) => new x509.GeneralName("dns", v)),
      ...ipAddresses.map((v) => new x509.GeneralName("ip", v)),
    ];
    extensions.push(new x509.SubjectAlternativeNameExtension(altNames));
  }

  const cert = await x509.X509CertificateGenerator.create({
    serialNumber: randomSerial(),
    subject: buildName(subject),
    issuer: caCert.subject,
    notBefore,
    notAfter,
    signingAlgorithm: SIGN_ALG[caKeyType],
    publicKey: leafKeys.publicKey,
    signingKey: caPrivKey,
    extensions,
  });

  const keyPem = await exportKeyPem(leafKeys.privateKey);
  const certPem = cert.toString("pem");

  console.log(`[CERT] Signed for ${subject.commonName} (${keyType.toUpperCase()}, serial: ${cert.serialNumber})`);
  return { certPem, keyPem, cert, keyType };
}

module.exports = { signCert };
