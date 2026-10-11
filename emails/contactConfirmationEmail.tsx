import * as React from 'react'
import { Button, Section, Text } from '@react-email/components'

import EmailLayout from '@/emails/components/EmailLayout'
import { primaryButtonStyle } from '@/emails/components/styles'
import { getEmailSupportMailto } from '@/lib/email-config'

interface ContactConfirmationEmailProps {
  name: string
  subject: string
  category: string
}

const categoryLabels: Record<string, string> = {
  general: 'General Inquiry',
  support: 'Technical Support',
  business: 'Business Partnership',
  student: 'Student Issue',
  order: 'Order or Payment',
  account: 'Account or Technical Issue',
  ceo: 'Direct CEO Report',
}

export default function ContactConfirmationEmail({
  name,
  subject,
  category,
}: ContactConfirmationEmailProps) {
  const categoryLabel = categoryLabels[category] || 'General Inquiry'

  return (
    <EmailLayout
      preview="We received your message."
      eyebrow="Support Confirmation"
      title="We received your message"
      greeting={`Hi ${name},`}
      intro={category === 'ceo' ? "Your report has been received through SwiftDU's leadership escalation channel." : "Thanks for contacting SwiftDU. Our support team has received your message and will review it as soon as possible."}
    >
      <Section className="rounded-[20px] border border-slate-200 bg-slate-50 px-6 py-5">
        <Text className="m-0 text-[14px] font-semibold uppercase tracking-[0.18em] text-slate-500">
          Your submission
        </Text>
        <Text className="m-0 mt-4 text-[15px] leading-7 text-slate-700">
          <strong>Category:</strong> {categoryLabel}
        </Text>
        <Text className="m-0 mt-2 text-[15px] leading-7 text-slate-700">
          <strong>Subject:</strong> {subject}
        </Text>
      </Section>

      <Section className="mt-8 rounded-[20px] border border-emerald-200 bg-emerald-50 px-6 py-5">
        <Text className="m-0 text-[14px] font-semibold leading-6 text-emerald-900">
          What happens next
        </Text>
        <Text className="m-0 mt-2 text-[14px] leading-6 text-emerald-800">
          {category === 'ceo' ? "We have recorded your report. It may be shared internally where needed to investigate or resolve the issue." : "We will get back to you through the contact details you provided."}
        </Text>
      </Section>

      <Section className="mt-8 text-center">
        <Button href={getEmailSupportMailto()} style={primaryButtonStyle}>
          Email support@swiftdu.org
        </Button>
      </Section>
    </EmailLayout>
  )
}
