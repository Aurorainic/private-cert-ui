import 'reflect-metadata'
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
require('reflect-metadata')

import { Crypto } from '@peculiar/webcrypto'
import x509 from '@peculiar/x509'
import { randomSerial } from './db'

const x509Any = x509 as any
const webcrypto = new Crypto()

export const ALG = {
  rsa: {
    name: 'RSASSA-PKCS1-v1_5',
    hash: 'SHA-256',
    publicExponent: new Uint8Array([1, 0, 1]),
    modulusLength: 4096,
  },
  ed25519: { name: 'Ed25519' },
} as const

export const SIGN_ALG = {
  rsa: { name: 'RSASSA-PKCS1-v1_5' },
  ed25519: { name: 'Ed25519' },
} as const

export type KeyType = 'rsa' | 'ed25519'

export interface Subject {
  commonName: string
  organizationName?: string
  countryName?: string
  stateOrProvinceName?: string
  localityName?: string
}

export interface CertResult {
  certPem: string
  keyPem: string
  cert: any
  keyType: KeyType
}

export interface SignOptions {
  dnsNames?: string[]
  ipAddresses?: string[]
  eku?: 'serverAuth' | 'clientAuth'
  days?: number
  keyType?: KeyType
}

function buildName(subject: Subject): string {
  const parts: string[] = []
  if (subject.countryName) parts.push(`C=${subject.countryName}`)
  if (subject.stateOrProvinceName) parts.push(`ST=${subject.stateOrProvinceName}`)
  if (subject.localityName) parts.push(`L=${subject.localityName}`)
  if (subject.organizationName) parts.push(`O=${subject.organizationName}`)
  if (subject.commonName) parts.push(`CN=${subject.commonName}`)
  return parts.join(', ')
}

async function exportKeyPem(cryptoKey: CryptoKey): Promise<string> {
  const buf = await webcrypto.subtle.exportKey('pkcs8', cryptoKey)
  const b64 = Buffer.from(buf).toString('base64').match(/.{1,64}/g)?.join('\n') || ''
  return `-----BEGIN PRIVATE KEY-----\n${b64}\n-----END PRIVATE KEY-----\n`
}

async function importPrivateKey(pem: string, keyType: KeyType): Promise<CryptoKey> {
  const b64 = pem.replace(/-----[^-]+-----/g, '').replace(/\s/g, '')
  const buf = Buffer.from(b64, 'base64')
  return webcrypto.subtle.importKey('pkcs8', buf, ALG[keyType], true, ['sign'])
}

async function importPublicKey(pem: string, keyType: KeyType): Promise<CryptoKey> {
  const b64 = pem.replace(/-----[^-]+-----/g, '').replace(/\s/g, '')
  const buf = Buffer.from(b64, 'base64')
  return webcrypto.subtle.importKey('spki', buf, ALG[keyType], true, ['verify'])
}

export async function initCA(subject: Subject, keyType: KeyType = 'rsa'): Promise<CertResult> {
  const alg = ALG[keyType]
  const keys = await webcrypto.subtle.generateKey(alg, true, ['sign', 'verify'])

  const now = new Date()
  const notBefore = new Date(now.getTime() - 2 * 60 * 1000)
  const notAfter = new Date(now)
  notAfter.setFullYear(notAfter.getFullYear() + 10)

  const cert = await x509Any.X509CertificateGenerator.createSelfSigned({
    serialNumber: randomSerial(),
    name: buildName(subject),
    notBefore,
    notAfter,
    signingAlgorithm: SIGN_ALG[keyType],
    keys,
    extensions: [
      new x509Any.BasicConstraintsExtension(true, undefined, true),
      new x509Any.KeyUsageExtension(
        x509Any.KeyUsageFlags.keyCertSign | x509Any.KeyUsageFlags.cRLSign | x509Any.KeyUsageFlags.digitalSignature,
        true
      ),
      await x509Any.SubjectKeyIdentifierExtension.create(keys.publicKey, false, webcrypto),
    ],
  })

  const keyPem = await exportKeyPem(keys.privateKey)
  const certPem = cert.toString('pem')

  console.log(`[CA] Root CA created (${keyType.toUpperCase()}, valid until ${notAfter.toISOString().slice(0, 10)})`)
  return { certPem, keyPem, cert, keyType }
}

export async function signCert(
  caKeyPem: string,
  caCertPem: string,
  caKeyType: KeyType,
  subject: Subject,
  options: SignOptions = {}
): Promise<CertResult> {
  const dnsNames = options.dnsNames || []
  const ipAddresses = options.ipAddresses || []
  const eku = options.eku || 'serverAuth'
  const days = options.days || 364
  const keyType = options.keyType || 'rsa'

  const leafAlg = ALG[keyType]
  const leafKeys = await webcrypto.subtle.generateKey(leafAlg, true, ['sign', 'verify'])

  const caPrivKey = await importPrivateKey(caKeyPem, caKeyType)
  const caCert = new x509Any.X509Certificate(caCertPem)

  const now = new Date()
  const notBefore = new Date(now.getTime() - 2 * 60 * 1000)
  const notAfter = new Date(now)
  notAfter.setDate(notAfter.getDate() + days)

  const keyUsageFlags = keyType === 'rsa'
    ? x509Any.KeyUsageFlags.digitalSignature | x509Any.KeyUsageFlags.keyEncipherment
    : x509Any.KeyUsageFlags.digitalSignature

  const ekuOids = eku === 'serverAuth'
    ? [x509Any.ExtendedKeyUsage.serverAuth]
    : [x509Any.ExtendedKeyUsage.clientAuth]

  const extensions = [
    new x509Any.BasicConstraintsExtension(false, undefined, false),
    new x509Any.KeyUsageExtension(keyUsageFlags, true),
    new x509Any.KeyUsageExtension(ekuOids, false),
    await x509Any.SubjectKeyIdentifierExtension.create(leafKeys.publicKey, false, webcrypto),
    await x509Any.AuthorityKeyIdentifierExtension.create(caCert, false, webcrypto),
  ]

  const effectiveDns = [...dnsNames]
  if (eku === 'serverAuth' && effectiveDns.length === 0 && ipAddresses.length === 0 && subject.commonName) {
    effectiveDns.push(subject.commonName)
  }

  if (effectiveDns.length > 0 || ipAddresses.length > 0) {
    const altNames = [
      ...effectiveDns.map((v: string) => new x509Any.GeneralName('dns', v)),
      ...ipAddresses.map((v: string) => new x509Any.GeneralName('ip', v)),
    ]
    extensions.push(new x509Any.SubjectAlternativeNameExtension(altNames))
  }

  const cert = await x509Any.X509CertificateGenerator.create({
    serialNumber: randomSerial(),
    subject: buildName(subject),
    issuer: caCert.subject,
    notBefore,
    notAfter,
    signingAlgorithm: SIGN_ALG[caKeyType],
    publicKey: leafKeys.publicKey,
    signingKey: caPrivKey,
    extensions,
  })

  const keyPem = await exportKeyPem(leafKeys.privateKey)
  const certPem = cert.toString('pem')

  console.log(`[CERT] Signed for ${subject.commonName} (${keyType.toUpperCase()}, serial: ${cert.serialNumber})`)
  return { certPem, keyPem, cert, keyType }
}

export { webcrypto }