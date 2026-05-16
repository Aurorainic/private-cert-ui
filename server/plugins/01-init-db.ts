import { initDatabase } from '~/server/lib/db'

export default defineNitroPlugin(async (nitroApp) => {
  await initDatabase()
})