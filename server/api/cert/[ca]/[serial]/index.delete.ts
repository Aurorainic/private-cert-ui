import { deleteCert } from '~/server/lib/storage'

export default defineEventHandler((event) => {
  const caName = getRouterParam(event, 'ca')!
  const serial = getRouterParam(event, 'serial')!

  const deleted = deleteCert(caName, serial)

  if (!deleted) {
    throw createError({ status: 404, message: 'Certificate not found' })
  }

  return { message: 'Certificate deleted' }
})
