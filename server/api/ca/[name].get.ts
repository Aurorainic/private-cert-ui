import { listCAs } from '~/server/lib/storage'

export default defineEventHandler((event) => {
  const name = getRouterParam(event, 'name')
  const cas = listCAs()
  const ca = cas.find((c) => c.name === name)

  if (!ca) {
    throw createError({ status: 404, message: 'CA not found' })
  }

  return ca
})
