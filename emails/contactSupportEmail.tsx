import * as React from 'react'
import { Button, Section, Text } from '@react-email/components'

import EmailLayout from '@/emails/components/EmailLayout'

interface ContactSupportEmailProps {
  name: string
  email: string
  subject: string
  message: string
  category: string
}

const categoryLabels: Record<string, string> = {
  general: 'General Inquiry',
  support: 'Technical Support',
  business: 'Business Partnership',
  student: 'Student Issue',
}

export default function ContactSupportEmail({
  name,
  email,
  subject,
  message,
  category,
}: ContactSupportEmailProps) {
  const categoryLabel = categoryLabels[category] || 'General Inquiry'

  return (
    <EmailLayout
      preview={`New contact form message from ${name}.`}
      eyebrow="Contact Inbox"
      title="New message from the contact form"
      intro="A visitor submitted a new message through the SwiftDU contact page."
      helpText="This message was generated from the public contact form."
    >
      <Section className="rounded-[20px] border border-slate-200 bg-slate-50 px-6 py-5">
        <Text className="m-0 text-[14px] font-semibold uppercase tracking-[0.18em] text-slate-500">
          Submission details
        </Text>
        <Text className="m-0 mt-4 text-[15px] leading-7 text-slate-700">
          <strong>Name:</strong> {name}
        </Text>
        <Text className="m-0 mt-2 text-[15px] leading-7 text-slate-700">
          <strong>Email:</strong> {email}
        </Text>
        <Text className="m-0 mt-2 text-[15px] leading-7 text-slate-700">
          <strong>Category:</strong> {categoryLabel}
        </Text>
        <Text className="m-0 mt-2 text-[15px] leading-7 text-slate-700">
          <strong>Subject:</strong> {subject}
        </Text>
      </Section>

      <Section className="mt-8 rounded-[20px] border border-slate-200 bg-white px-6 py-5">
        <Text className="m-0 text-[14px] font-semibold uppercase tracking-[0.18em] text-slate-500">
          Message
        </Text>
        <Text className="m-0 mt-4 whitespace-pre-line text-[15px] leading-7 text-slate-700">
          {message}
        </Text>
      </Section>

      <Section className="mt-8 text-center">
        <Button
          href={`mailto:${email}?subject=${encodeURIComponent(`Re: ${subject}`)}`}
          className="inline-block rounded-[14px] bg-sky-600 px-8 py-4 text-[16px] font-semibold text-white no-underline"
        >
          Reply to {name}
        </Button>
      </Section>
    </EmailLayout>
  )
}
