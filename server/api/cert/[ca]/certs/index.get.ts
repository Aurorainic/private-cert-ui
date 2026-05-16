import { listCerts } from '~/server/lib/storage'

export default defineEventHandler((event) => {
  const caName = getRouterParam(event, 'ca')!
  return listCerts(caName)
})
