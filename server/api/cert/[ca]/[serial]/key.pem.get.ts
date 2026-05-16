import { loadCert } from '~/server/lib/storage'

export default defineEventHandler(async (event) => {
  const caName = getRouterParam(event, 'ca')!
  const serial = getRouterParam(event, 'serial')!

  const certData = await loadCert(caName, serial)

  if (!certData) {
    throw createError({ status: 404, message: 'Certificate not found' })
  }

  setHeader(event, 'Content-Type', 'application/x-pem-file')
  setHeader(event, 'Content-Disposition', `attachment; filename="${caName}-${serial}-key.pem"`)
  return certData.keyPem
})
