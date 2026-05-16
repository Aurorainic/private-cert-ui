import { listCAs } from '~/server/lib/storage'

export default defineEventHandler(() => {
  return listCAs()
})
