import { redirect } from 'next/navigation'

// Results entry has moved to the Admin panel (Joshua-only)
export default function ResultsPage() {
  redirect('/admin')
}
