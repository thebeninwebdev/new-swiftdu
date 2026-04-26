import * as React from 'react'
import { Button, Section, Text } from '@react-email/components'

import EmailLayout from '@/emails/components/EmailLayout'
import { primaryButtonStyle } from '@/emails/components/styles'

interface NewTaskEmailProps {
  taskerName?: string
  taskType?: string
  description: string
  amount: number
  location: string
  userName: string
  taskUrl: string
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    maximumFractionDigits: 0,
  }).format(amount)
}

export default function NewTaskEmail({
  taskerName,
  taskType,
  description,
  amount,
  location,
  userName,
  taskUrl,
}: NewTaskEmailProps) {
  return (
    <EmailLayout
      preview="A new task is available on SwiftDU."
      eyebrow="Task Alert"
      title="A new task is available"
      greeting={`Hello ${taskerName || 'Tasker'},`}
      intro={`A new ${taskType || 'task'} has just been posted by ${userName}. Review the details below and head to your dashboard if you want to accept it.`}
    >
      <Section className="rounded-[20px] border border-slate-200 bg-slate-50 px-6 py-5">
        <Text className="m-0 text-[14px] font-semibold uppercase tracking-[0.18em] text-slate-500">
          Task details
        </Text>
        <Text className="m-0 mt-4 text-[15px] leading-7 text-slate-700">
          <strong>Description:</strong> {description}
        </Text>
        <Text className="m-0 mt-2 text-[15px] leading-7 text-slate-700">
          <strong>Budget:</strong> {formatCurrency(amount)}
        </Text>
        <Text className="m-0 mt-2 text-[15px] leading-7 text-slate-700">
          <strong>Location:</strong> {location}
        </Text>
      </Section>

      <Section className="mt-8 text-center">
        <Button href={taskUrl} style={primaryButtonStyle}>
          Open Task Dashboard
        </Button>
      </Section>
    </EmailLayout>
  )
}
