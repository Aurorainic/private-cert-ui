import { loadCA } from '~/server/lib/storage'

export default defineEventHandler(async (event) => {
  const name = getRouterParam(event, 'name')!

  const ca = await loadCA(name)

  if (!ca) {
    throw createError({ status: 404, message: 'CA not found' })
  }

  setHeader(event, 'Content-Type', 'application/x-pem-file')
  setHeader(event, 'Content-Disposition', `attachment; filename="${name}-ca.pem"`)
  return ca.certPem
})
