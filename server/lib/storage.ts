import { db, encryptKey, decryptKey } from './db'
import type { CertResult, KeyType, Subject } from './crypto'

function isValidCaName(name: string): boolean {
  // Allow alphanumeric, underscore, hyphen, 2-32 chars
  return /^[a-zA-Z0-9_-]{2,32}$/.test(name)
}

function isValidSerial(serial: string): boolean {
  // Allow hex string, 8-64 chars
  return /^[0-9A-Fa-f]{8,64}$/.test(serial)
}

// ---------------------------------------------------------------------------
// CA operations
// ---------------------------------------------------------------------------

export interface CAListItem {
  name: string
  subject: string
  serialNumber: string
  notBefore: string
  notAfter: string
  keyType: KeyType
  certCount?: number
}

export interface CAFull {
  name: string
  subject: string
  serialNumber: string
  notBefore: string
  notAfter: string
  keyType: KeyType
  certPem: string
  keyPem: string
}

export async function saveCA(name: string, { certPem, keyPem, cert, keyType }: CertResult): Promise<void> {
  if (!isValidCaName(name)) throw new Error('Invalid CA name')

  const enc = await encryptKey(keyPem)
  const subject = cert.subject

  db.prepare(`
    INSERT OR REPLACE INTO cas
      (name, subject, serial, not_before, not_after, cert_pem, key_enc, key_iv, key_tag, key_type)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    name,
    subject,
    cert.serialNumber,
    cert.notBefore.toISOString(),
    cert.notAfter.toISOString(),
    certPem,
    enc.keyEnc, enc.keyIv, enc.keyTag,
    keyType
  )
}

export function listCAs(): CAListItem[] {
  const stmt = db.prepare(`
    SELECT name, subject, serial, not_before, not_after, key_type,
           (SELECT COUNT(*) FROM certs WHERE ca_name = cas.name) as cert_count
    FROM cas ORDER BY name
  `)
  const results: any[] = []
  while (stmt.step()) {
    results.push(stmt.getAsObject())
  }
  stmt.free()
  return results.map((row: any) => ({
    name: row.name,
    subject: row.subject,
    serialNumber: row.serial,
    notBefore: row.not_before,
    notAfter: row.not_after,
    keyType: row.key_type,
    certCount: row.cert_count,
  }))
}

export async function loadCA(name: string): Promise<CAFull | null> {
  if (!isValidCaName(name)) throw new Error('Invalid CA name')

  const stmt = db.prepare('SELECT * FROM cas WHERE name = ?')
  stmt.bind([name])
  if (!stmt.step()) {
    stmt.free()
    return null
  }
  const row = stmt.getAsObject()
  stmt.free()

  const keyPem = await decryptKey(row.key_enc as string, row.key_iv as string, row.key_tag as string)

  return {
    name: row.name as string,
    subject: row.subject as string,
    serialNumber: row.serial as string,
    notBefore: row.not_before as string,
    notAfter: row.not_after as string,
    keyType: row.key_type as KeyType,
    certPem: row.cert_pem as string,
    keyPem,
  }
}

// ---------------------------------------------------------------------------
// Certificate operations
// ---------------------------------------------------------------------------

export interface CertMeta {
  serial: string
  caName: string
  subject: Subject
  dnsNames: string[]
  ipAddresses: string[]
  eku: string
  notBefore: string
  notAfter: string
  createdAt: string
  keyType?: KeyType
}

export interface CertFull {
  caName: string
  serial: string
  subject: Subject
  dnsNames: string[]
  ipAddresses: string[]
  eku: string
  notBefore: string
  notAfter: string
  createdAt: string
  keyType: KeyType
  certPem: string
  keyPem: string
}

export async function saveCert(
  caName: string,
  { certPem, keyPem, cert, keyType }: CertResult,
  subject: Subject,
  dnsNames: string[],
  ipAddresses: string[],
  eku: string
): Promise<void> {
  if (!isValidCaName(caName)) throw new Error('Invalid CA name')

  const serial = cert.serialNumber
  if (!isValidSerial(serial)) throw new Error('Invalid serial number')

  const enc = await encryptKey(keyPem)

  db.prepare(`
    INSERT OR REPLACE INTO certs
      (serial, ca_name, subject, dns_names, ip_addresses, eku, not_before, not_after, created_at,
       cert_pem, key_enc, key_iv, key_tag, key_type)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    serial, caName,
    JSON.stringify(subject),
    JSON.stringify(dnsNames || []),
    JSON.stringify(ipAddresses || []),
    eku || 'serverAuth',
    cert.notBefore.toISOString(),
    cert.notAfter.toISOString(),
    new Date().toISOString(),
    certPem,
    enc.keyEnc, enc.keyIv, enc.keyTag,
    keyType
  )
}

export function listCerts(caName: string): CertMeta[] {
  if (!isValidCaName(caName)) throw new Error('Invalid CA name')

  const stmt = db.prepare(`
    SELECT * FROM certs WHERE ca_name = ? ORDER BY created_at DESC
  `)
  stmt.bind([caName])
  const results: any[] = []
  while (stmt.step()) {
    results.push(stmt.getAsObject())
  }
  stmt.free()
  return results.map((row: any) => ({
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
  }))
}

export async function loadCert(caName: string, serial: string): Promise<CertFull | null> {
  if (!isValidCaName(caName)) throw new Error('Invalid CA name')
  if (!isValidSerial(serial)) throw new Error('Invalid serial number')

  const stmt = db.prepare(`
    SELECT * FROM certs WHERE ca_name = ? AND serial = ?
  `)
  stmt.bind([caName, serial])
  if (!stmt.step()) {
    stmt.free()
    return null
  }
  const row = stmt.getAsObject()
  stmt.free()

  const keyPem = await decryptKey(row.key_enc as string, row.key_iv as string, row.key_tag as string)

  return {
    caName,
    serial,
    subject: JSON.parse(row.subject as string),
    dnsNames: JSON.parse(row.dns_names as string),
    ipAddresses: JSON.parse(row.ip_addresses as string),
    eku: row.eku as string,
    notBefore: row.not_before as string,
    notAfter: row.not_after as string,
    createdAt: row.created_at as string,
    keyType: row.key_type as KeyType,
    certPem: row.cert_pem as string,
    keyPem,
  }
}

export function deleteCert(caName: string, serial: string): boolean {
  if (!isValidCaName(caName)) throw new Error('Invalid CA name')
  if (!isValidSerial(serial)) throw new Error('Invalid serial number')

  const result = db.prepare('DELETE FROM certs WHERE ca_name = ? AND serial = ?').run(caName, serial)
  return result.changes > 0
}
