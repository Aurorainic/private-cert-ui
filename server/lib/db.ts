import * as crypto from 'crypto'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import initSqlJs from 'sql.js'
import fs from 'fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

let masterKey: Buffer | null = null

function initMasterKeySync(): void {
  const config = useRuntimeConfig()
  if (config.caMasterKey) {
    const buf = Buffer.from(config.caMasterKey, 'hex')
    if (buf.length !== 32) {
      throw new Error('CA_MASTER_KEY must be 64 hex chars (32 bytes)')
    }
    masterKey = buf
  } else {
    masterKey = crypto.randomBytes(32)
    console.warn('[WARN] CA_MASTER_KEY not set. Generated ephemeral key (data lost on restart):')
    console.warn('  CA_MASTER_KEY=' + masterKey.toString('hex'))
    console.warn('  Set this env var to persist private key decryption across restarts.')
  }
}

initMasterKeySync()

export async function encryptKey(pem: string): Promise<{
  keyEnc: string
  keyIv: string
  keyTag: string
}> {
  const iv = crypto.randomBytes(12)

  const cipher = crypto.createCipheriv('aes-256-gcm', masterKey!, iv)
  const enc = Buffer.concat([cipher.update(pem, 'utf8'), cipher.final()])

  return {
    keyEnc: enc.toString('base64'),
    keyIv: iv.toString('base64'),
    keyTag: cipher.getAuthTag().toString('base64'),
  }
}

export async function decryptKey(enc: string, iv: string, tag: string): Promise<string> {
  const decipher = crypto.createDecipheriv('aes-256-gcm', masterKey!, Buffer.from(iv, 'base64'))
  decipher.setAuthTag(Buffer.from(tag, 'base64'))
  return decipher.update(Buffer.from(enc, 'base64')) + decipher.final('utf8')
}

export function randomSerial(): string {
  const bytes = crypto.randomBytes(8)
  bytes[0] &= 0x7f
  bytes[0] |= 0x01
  return bytes.toString('hex').toUpperCase()
}

const DB_PATH = join(__dirname, '../../data/ca.db')

const dataDir = dirname(DB_PATH)
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true })
}

let db: any = null

export async function initDatabase(): Promise<void> {
  const SQL = await initSqlJs()
  
  db = new SQL.Database()
  
  db.run(`
    CREATE TABLE IF NOT EXISTS cas (
      name      TEXT PRIMARY KEY,
      subject   TEXT NOT NULL,
      serial    TEXT NOT NULL,
      not_before TEXT NOT NULL,
      not_after  TEXT NOT NULL,
      cert_pem  TEXT NOT NULL,
      key_enc   TEXT NOT NULL,
      key_iv    TEXT NOT NULL,
      key_tag   TEXT NOT NULL,
      key_type  TEXT NOT NULL DEFAULT 'rsa'
    )
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS certs (
      serial       TEXT NOT NULL,
      ca_name      TEXT NOT NULL,
      subject      TEXT NOT NULL,
      dns_names    TEXT NOT NULL DEFAULT '[]',
      ip_addresses TEXT NOT NULL DEFAULT '[]',
      eku          TEXT NOT NULL DEFAULT 'serverAuth',
      not_before   TEXT NOT NULL,
      not_after    TEXT NOT NULL,
      created_at   TEXT NOT NULL,
      cert_pem     TEXT NOT NULL,
      key_enc      TEXT NOT NULL,
      key_iv       TEXT NOT NULL,
      key_tag      TEXT NOT NULL,
      key_type     TEXT NOT NULL DEFAULT 'rsa',
      PRIMARY KEY (serial, ca_name)
    )
  `)
}

export { db }