import { loadCert } from '~/server/lib/storage'

export default defineEventHandler(async (event) => {
  const caName = getRouterParam(event, 'ca')!
  const serial = getRouterParam(event, 'serial')!

  const certData = await loadCert(caName, serial)

  if (!certData) {
    throw createError({ status: 404, message: 'Certificate not found' })
  }

  return {
    serial: certData.serial,
    caName: certData.caName,
    subject: certData.subject,
    notBefore: certData.notBefore,
    notAfter: certData.notAfter,
    keyType: certData.keyType,
    dnsNames: certData.dnsNames,
    ipAddresses: certData.ipAddresses,
    eku: certData.eku,
  }
})
