import * as React from 'react'
import { Button, Section, Text } from '@react-email/components'

import EmailLayout from '@/emails/components/EmailLayout'
import { primaryButtonStyle } from '@/emails/components/styles'
import { getEmailSiteUrl } from '@/lib/email-config'

interface TaskAcceptedEmailProps {
  userName: string
  taskerName: string
  description: string
  amount: number
  location: string
  deadline: string
  taskUrl?: string
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    maximumFractionDigits: 0,
  }).format(amount)
}

export default function TaskAcceptedEmail({
  userName,
  taskerName,
  description,
  amount,
  location,
  deadline,
  taskUrl,
}: TaskAcceptedEmailProps) {
  const nextTaskUrl = taskUrl || `${getEmailSiteUrl()}/dashboard/tasks`

  return (
    <EmailLayout
      preview="Your SwiftDU task has been accepted."
      eyebrow="Order Update"
      title="Your task has been accepted"
      greeting={`Hello ${userName},`}
      intro={`Good news. ${taskerName} has accepted your task. Review the details below and complete checkout so SwiftDU can release the order.`}
    >
      <Section className="rounded-[20px] border border-slate-200 bg-slate-50 px-6 py-5">
        <Text className="m-0 text-[14px] font-semibold uppercase tracking-[0.18em] text-slate-500">
          Accepted task
        </Text>
        <Text className="m-0 mt-4 text-[15px] leading-7 text-slate-700">
          <strong>Description:</strong> {description}
        </Text>
        <Text className="m-0 mt-2 text-[15px] leading-7 text-slate-700">
          <strong>Amount:</strong> {formatCurrency(amount)}
        </Text>
        <Text className="m-0 mt-2 text-[15px] leading-7 text-slate-700">
          <strong>Location:</strong> {location}
        </Text>
        <Text className="m-0 mt-2 text-[15px] leading-7 text-slate-700">
          <strong>Deadline:</strong> {deadline}
        </Text>
      </Section>

      <Section className="mt-8 text-center">
        <Button href={nextTaskUrl} style={primaryButtonStyle}>
          Open My Tasks
        </Button>
      </Section>
    </EmailLayout>
  )
}
