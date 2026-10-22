import { redirect } from 'next/navigation'

export default function IndomieBatchingRedirect() {
  redirect('/admin/orders?tab=batches')
}
