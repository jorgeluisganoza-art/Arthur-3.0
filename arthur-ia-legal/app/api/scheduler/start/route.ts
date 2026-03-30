import { startScheduler } from '@/lib/scheduler'

export async function POST() {
  startScheduler()
  return Response.json({ message: 'Scheduler started' })
}
