import { signCert, type SignOptions } from '~/server/lib/crypto'
import { loadCA, saveCert } from '~/server/lib/storage'

export default defineEventHandler(async (event) => {
  const caName = getRouterParam(event, 'ca')!

  try {
    const caData = await loadCA(caName)
    if (!caData) {
      throw createError({ status: 404, message: 'CA not found' })
    }

    const body = await readBody(event) as {
      subject: { commonName: string; organizationName?: string; countryName?: string }
      dnsNames?: string[]
      ipAddresses?: string[]
      eku?: string
      days?: number
      keyType?: 'rsa' | 'ed25519'
    }

    if (!body.subject?.commonName) {
      throw createError({ status: 400, message: 'subject.commonName is required' })
    }

    const options: SignOptions = {
      dnsNames: body.dnsNames || [],
      ipAddresses: body.ipAddresses || [],
      eku: (body.eku === 'clientAuth' || body.eku === 'serverAuth') ? body.eku : undefined,
      days: body.days || 364,
      keyType: body.keyType || 'rsa',
    }

    console.log(`[API] Signing cert for: ${body.subject.commonName} (${options.keyType})`)
    const result = await signCert(caData.keyPem, caData.certPem, caData.keyType, body.subject, options)

    await saveCert(caName, {
      ...result,
      subject: body.subject,
      dnsNames: options.dnsNames,
      ipAddresses: options.ipAddresses,
      eku: options.eku || 'serverAuth',
    })

    return {
      message: 'Certificate signed',
      serial: result.cert.serialNumber,
      subject: body.subject,
      notBefore: result.cert.notBefore.toISOString(),
      notAfter: result.cert.notAfter.toISOString(),
      keyType: result.keyType,
    }
  } catch (err: any) {
    console.error('[ERROR] POST /api/cert/[ca]/certs:', err.message)
    throw createError({ status: 500, message: 'Failed to sign certificate: ' + err.message })
  }
})
