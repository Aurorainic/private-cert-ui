import { initCA, type KeyType } from '~/server/lib/crypto'
import { saveCA } from '~/server/lib/storage'

export default defineEventHandler(async (event) => {
  try {
    const { name, subject, keyType = 'rsa' } = await readBody(event) as {
      name: string
      subject: { commonName: string; organizationName?: string; countryName?: string }
      keyType?: KeyType
    }

    if (!name || !subject) {
      throw createError({ status: 400, message: 'name and subject are required' })
    }

    if (!['rsa', 'ed25519'].includes(keyType)) {
      throw createError({ status: 400, message: 'keyType must be rsa or ed25519' })
    }

    const cas = listCAs()
    if (cas.find((c) => c.name === name)) {
      throw createError({ status: 409, message: 'CA with this name already exists' })
    }

    console.log(`[API] Creating CA: ${name} (${keyType})`)
    const ca = await initCA(subject, keyType)
    await saveCA(name, ca)

    return {
      message: 'CA created',
      name,
      serialNumber: ca.cert.serialNumber,
      notBefore: ca.cert.notBefore.toISOString(),
      notAfter: ca.cert.notAfter.toISOString(),
      keyType,
    }
  } catch (err: any) {
    console.error('[ERROR] POST /api/ca:', err.message)
    throw createError({ status: 500, message: 'Failed to create CA: ' + err.message })
  }
})
