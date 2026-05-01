import * as React from 'react'
import { Button, Section, Text } from '@react-email/components'

import EmailLayout from '@/emails/components/EmailLayout'
import { primaryButtonStyle } from '@/emails/components/styles'

type OrderAlertEvent = 'created' | 'cancelled'

interface OrderAlertEmailProps {
  event: OrderAlertEvent
  orderId: string
  taskType?: string
  description?: string
  amount: number
  totalAmount?: number
  location: string
  customerName?: string
  customerEmail?: string
  actorLabel?: string
  taskerName?: string
  createdAt?: string
  cancelledAt?: string
  dashboardUrl: string
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    maximumFractionDigits: 0,
  }).format(amount)
}

function formatDate(value?: string) {
  if (!value) {
    return 'Not available'
  }

  return new Date(value).toLocaleString('en-NG', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatTaskType(taskType?: string) {
  const labels: Record<string, string> = {
    restaurant: 'Food delivery',
    printing: 'Printing',
    copy_notes: 'Copy notes',
    shopping: 'Shopping',
    water: 'Bag of Water',
    others: 'General errand',
  }

  return labels[taskType || ''] || taskType || 'Errand'
}

export default function OrderAlertEmail({
  event,
  orderId,
  taskType,
  description,
  amount,
  totalAmount,
  location,
  customerName,
  customerEmail,
  actorLabel,
  taskerName,
  createdAt,
  cancelledAt,
  dashboardUrl,
}: OrderAlertEmailProps) {
  const isCancelled = event === 'cancelled'
  const title = isCancelled ? 'A booking was cancelled' : 'A new booking was placed'
  const preview = isCancelled
    ? 'A SwiftDU booking has just been cancelled.'
    : 'A new SwiftDU booking needs your attention.'
  const intro = isCancelled
    ? `${actorLabel || 'A user'} cancelled this booking. Review the full order details in the admin dashboard.`
    : `${customerName || 'A customer'} just placed a new booking on SwiftDU. Review the order details below.`

  return (
    <EmailLayout
      preview={preview}
      eyebrow={isCancelled ? 'Cancellation Alert' : 'New Booking'}
      title={title}
      greeting="Hello SwiftDU team,"
      intro={intro}
    >
      <Section className="rounded-[20px] border border-slate-200 bg-slate-50 px-6 py-5">
        <Text className="m-0 text-[14px] font-semibold uppercase tracking-[0.18em] text-slate-500">
          Order details
        </Text>
        <Text className="m-0 mt-4 text-[15px] leading-7 text-slate-700">
          <strong>Order ID:</strong> {orderId}
        </Text>
        <Text className="m-0 mt-2 text-[15px] leading-7 text-slate-700">
          <strong>Task type:</strong> {formatTaskType(taskType)}
        </Text>
        <Text className="m-0 mt-2 text-[15px] leading-7 text-slate-700">
          <strong>Customer:</strong> {customerName || 'Unknown customer'}
          {customerEmail ? ` (${customerEmail})` : ''}
        </Text>
        <Text className="m-0 mt-2 text-[15px] leading-7 text-slate-700">
          <strong>Budget:</strong> {formatCurrency(amount)}
        </Text>
        <Text className="m-0 mt-2 text-[15px] leading-7 text-slate-700">
          <strong>Total collected:</strong> {formatCurrency(totalAmount || amount)}
        </Text>
        <Text className="m-0 mt-2 text-[15px] leading-7 text-slate-700">
          <strong>Location:</strong> {location}
        </Text>
        <Text className="m-0 mt-2 text-[15px] leading-7 text-slate-700">
          <strong>Description:</strong> {description?.trim() || 'No description provided.'}
        </Text>
        {taskerName ? (
          <Text className="m-0 mt-2 text-[15px] leading-7 text-slate-700">
            <strong>Tasker:</strong> {taskerName}
          </Text>
        ) : null}
        <Text className="m-0 mt-2 text-[15px] leading-7 text-slate-700">
          <strong>Booked at:</strong> {formatDate(createdAt)}
        </Text>
        {isCancelled ? (
          <Text className="m-0 mt-2 text-[15px] leading-7 text-slate-700">
            <strong>Cancelled at:</strong> {formatDate(cancelledAt)}
          </Text>
        ) : null}
      </Section>

      <Section className="mt-8 text-center">
        <Button href={dashboardUrl} style={primaryButtonStyle}>
          Open Admin Orders
        </Button>
      </Section>
    </EmailLayout>
  )
}
