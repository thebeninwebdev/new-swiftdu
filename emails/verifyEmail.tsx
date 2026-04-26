import * as React from 'react'
import { Button, Link, Section, Text } from '@react-email/components'

import EmailLayout from '@/emails/components/EmailLayout'
import { primaryButtonStyle } from '@/emails/components/styles'

interface VerifyEmailProps {
  url: string
  name: string
}

export default function VerifyEmail({ url, name }: VerifyEmailProps) {
  return (
    <EmailLayout
      preview="Verify your SwiftDU account to get started."
      eyebrow="Account Verification"
      title="Verify your email address"
      greeting={`Hi ${name},`}
      intro="Welcome to SwiftDU. Confirm your email address to activate your account and start using the platform."
    >
      <Section className="text-center">
        <Button href={url} style={primaryButtonStyle}>
          Verify Email Address
        </Button>
      </Section>

      <Section className="mt-8 rounded-[20px] border border-slate-200 bg-slate-50 px-6 py-5">
        <Text className="m-0 text-[14px] font-semibold leading-6 text-slate-900">
          Secure access
        </Text>
        <Text className="m-0 mt-2 text-[14px] leading-6 text-slate-600">
          This verification link expires in 24 hours. If you did not create a
          SwiftDU account, you can safely ignore this email.
        </Text>
      </Section>

      <Text className="m-0 mt-8 text-[14px] leading-6 text-slate-600">
        If the button does not work, copy and paste this link into your browser:
      </Text>
      <Text className="m-0 mt-2 break-all text-[14px] leading-6 text-sky-700">
        <Link href={url} className="text-sky-700 underline">
          {url}
        </Link>
      </Text>
    </EmailLayout>
  )
}
