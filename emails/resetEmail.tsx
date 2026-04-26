import * as React from 'react'
import { Button, Link, Section, Text } from '@react-email/components'

import EmailLayout from '@/emails/components/EmailLayout'
import { primaryButtonStyle } from '@/emails/components/styles'

interface ResetEmailProps {
  url: string
  email: string
}

export default function ResetEmail({ url, email }: ResetEmailProps) {
  return (
    <EmailLayout
      preview="Reset your SwiftDU account password."
      eyebrow="Password Security"
      title="Reset your password"
      greeting="Hello,"
      intro={`We received a password reset request for the SwiftDU account linked to ${email}. Use the button below to choose a new password.`}
    >
      <Section className="text-center">
        <Button href={url} style={primaryButtonStyle}>
          Reset Password
        </Button>
      </Section>

      <Section className="mt-8 rounded-[20px] border border-amber-200 bg-amber-50 px-6 py-5">
        <Text className="m-0 text-[14px] font-semibold leading-6 text-amber-900">
          Security reminder
        </Text>
        <Text className="m-0 mt-2 text-[14px] leading-6 text-amber-800">
          This reset link expires in 24 hours. If you did not request a password
          reset, you can ignore this email and your password will stay the same.
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
