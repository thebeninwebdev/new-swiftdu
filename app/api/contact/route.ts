import { NextRequest, NextResponse } from 'next/server'

import ContactConfirmationEmail from '@/emails/contactConfirmationEmail'
import ContactSupportEmail from '@/emails/contactSupportEmail'
import { sendTransactionalEmail } from '@/lib/email'
import { getSupportEmailAddress } from '@/lib/email-config'

const allowedCategories = new Set(['general', 'support', 'business', 'student'])

function normalizeValue(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const name = normalizeValue(body.name)
    const email = normalizeValue(body.email).toLowerCase()
    const subject = normalizeValue(body.subject)
    const message = normalizeValue(body.message)
    const category = normalizeValue(body.category) || 'general'

    if (!name || !email || !subject || !message) {
      return NextResponse.json(
        { error: 'Name, email, subject, and message are required.' },
        { status: 400 }
      )
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { error: 'Enter a valid email address.' },
        { status: 400 }
      )
    }

    if (name.length < 2) {
      return NextResponse.json(
        { error: 'Name must be at least 2 characters.' },
        { status: 400 }
      )
    }

    if (subject.length < 3) {
      return NextResponse.json(
        { error: 'Subject must be at least 3 characters.' },
        { status: 400 }
      )
    }

    if (message.length < 10) {
      return NextResponse.json(
        { error: 'Message must be at least 10 characters.' },
        { status: 400 }
      )
    }

    if (!allowedCategories.has(category)) {
      return NextResponse.json(
        { error: 'Select a valid contact category.' },
        { status: 400 }
      )
    }

    await sendTransactionalEmail({
      to: getSupportEmailAddress(),
      subject: `Contact form: ${subject}`,
      replyTo: email,
      react: ContactSupportEmail({
        name,
        email,
        subject,
        message,
        category,
      }),
      tags: [
        { name: 'email_type', value: 'contact_form' },
        { name: 'contact_category', value: category },
      ],
      headers: {
        'X-SwiftDU-Contact-Category': category,
      },
    })

    try {
      await sendTransactionalEmail({
        to: email,
        subject: 'We received your message',
        react: ContactConfirmationEmail({
          name,
          subject,
          category,
        }),
        tags: [
          { name: 'email_type', value: 'contact_confirmation' },
          { name: 'contact_category', value: category },
        ],
      })
    } catch (confirmationError) {
      console.error('[POST /api/contact] confirmation email failed', confirmationError)
    }

    return NextResponse.json({
      success: true,
      message: 'Your message has been sent successfully.',
    })
  } catch (error) {
    console.error('[POST /api/contact]', error)

    return NextResponse.json(
      { error: 'Failed to send your message right now. Please try again.' },
      { status: 500 }
    )
  }
}
