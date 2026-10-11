import { NextRequest, NextResponse } from 'next/server'
import ContactConfirmationEmail from '@/emails/contactConfirmationEmail'
import ContactSupportEmail from '@/emails/contactSupportEmail'
import { sendTransactionalEmail } from '@/lib/email'
import { getCeoContactEmailAddress } from '@/lib/email-config'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json(); const name = typeof body.name === 'string' ? body.name.trim() : ''; const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''; const message = typeof body.message === 'string' ? body.message.trim() : '';
    if (name.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || message.length < 10) return NextResponse.json({ error: 'Please provide your name, a valid email, and at least a little more detail.' }, { status: 400 });
    const destination = getCeoContactEmailAddress(); if (!destination) { console.error('[POST /api/contact/ceo] CEO_CONTACT_EMAIL is not configured'); return NextResponse.json({ error: 'Direct reporting is temporarily unavailable. Please contact SwiftDU support if the matter cannot wait.' }, { status: 503 }); }
    await sendTransactionalEmail({ to: destination, replyTo: email, subject: '[CEO REPORT] New SwiftDU escalation', react: ContactSupportEmail({ name, email, subject: 'Direct CEO report', message, category: 'ceo' }), tags: [{ name: 'email_type', value: 'ceo_escalation' }], headers: { 'X-SwiftDU-Contact-Category': 'ceo' } });
    try { await sendTransactionalEmail({ to: email, subject: 'Your report has been received', react: ContactConfirmationEmail({ name, subject: 'Direct CEO report', category: 'ceo' }), tags: [{ name: 'email_type', value: 'ceo_confirmation' }] }); } catch (error) { console.error('[POST /api/contact/ceo] confirmation failed', error); }
    return NextResponse.json({ success: true });
  } catch (error) { console.error('[POST /api/contact/ceo]', error); return NextResponse.json({ error: 'Failed to send your report right now. Please try again.' }, { status: 500 }); }
}
