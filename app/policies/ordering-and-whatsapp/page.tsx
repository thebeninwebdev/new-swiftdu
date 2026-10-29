import Link from 'next/link'

export default function OrderingAndWhatsAppPolicyPage() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-12 text-slate-800 dark:text-slate-100">
      <Link href="/terms" className="text-sm font-semibold text-indigo-600">Back to Terms</Link>
      <h1 className="mt-6 text-3xl font-black">Ordering and WhatsApp Policy</h1>
      <div className="mt-6 space-y-5 text-sm leading-7 text-slate-600 dark:text-slate-300">
        <p>SwiftDU provides campus errands, food delivery, shopping, printing, and pickup services.</p>
        <p>We do not accept requests involving regulated or restricted products, including alcohol, tobacco, controlled drugs, weapons, gambling products, adult products, stolen goods, or counterfeit goods.</p>
        <p>When you link WhatsApp, you explicitly agree to receive transactional and service messages about your account and orders. You can stop proactive WhatsApp messages at any time.</p>
        <p>WhatsApp is used for order and support communication, not unsolicited bulk marketing.</p>
        <p>Certain university residences restrict who may enter the premises. SwiftDU applies destination access requirements for these locations. The rule is based on physical campus access requirements and is not based on the customer’s gender.</p>
      </div>
    </main>
  )
}
