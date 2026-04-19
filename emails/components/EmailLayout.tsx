import * as React from 'react'
import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Section,
  Tailwind,
  Text,
} from '@react-email/components'

import {
  getEmailSiteUrl,
  getSupportEmailAddress,
} from '@/lib/email-config'

interface EmailLayoutProps {
  preview: string
  eyebrow: string
  title: string
  greeting?: string
  intro?: React.ReactNode
  helpText?: React.ReactNode
  children: React.ReactNode
}

const supportEmail = getSupportEmailAddress()
const siteUrl = getEmailSiteUrl()
const siteHost = siteUrl.replace(/^https?:\/\//, '')

export default function EmailLayout({
  preview,
  eyebrow,
  title,
  greeting,
  intro,
  helpText,
  children,
}: EmailLayoutProps) {
  return (
    <Html lang="en" dir="ltr">
      <Tailwind>
        <Head />
        <Preview>{preview}</Preview>
        <Body className="bg-slate-100 py-10 font-sans text-slate-900">
          <Container className="mx-auto max-w-[640px] px-4">
            <Section className="overflow-hidden rounded-[28px] bg-white shadow-sm">
              <Section className="bg-gradient-to-br from-slate-950 via-slate-900 to-sky-900 px-10 py-8 text-white">
                <Text className="m-0 text-[12px] font-semibold uppercase tracking-[0.24em] text-sky-200">
                  {eyebrow}
                </Text>
                <Heading className="m-0 mt-4 text-[30px] font-bold text-white">
                  SwiftDU
                </Heading>
                <Text className="m-0 mt-3 text-[14px] leading-6 text-slate-200">
                  Fast, reliable campus errands with professional support.
                </Text>
              </Section>

              <Section className="px-10 py-8">
                <Heading className="m-0 text-[28px] font-bold leading-9 text-slate-950">
                  {title}
                </Heading>

                {greeting ? (
                  <Text className="m-0 mt-6 text-[16px] leading-7 text-slate-700">
                    {greeting}
                  </Text>
                ) : null}

                {intro ? (
                  <Text className="m-0 mt-4 text-[16px] leading-7 text-slate-700">
                    {intro}
                  </Text>
                ) : null}

                <Section className="mt-8">{children}</Section>
              </Section>

              <Section className="border-t border-slate-200 bg-slate-50 px-10 py-6">
                <Text className="m-0 text-[14px] leading-6 text-slate-600">
                  {helpText || (
                    <>
                      Need help? Reply to this email or contact{' '}
                      <Link href={`mailto:${supportEmail}`} className="text-sky-700 underline">
                        {supportEmail}
                      </Link>
                      .
                    </>
                  )}
                </Text>

                <Text className="m-0 mt-4 text-[13px] leading-6 text-slate-500">
                  <Link href={siteUrl} className="text-slate-700 underline">
                    {siteHost}
                  </Link>{' '}
                  <span className="mx-1">•</span>
                  <Link href={`mailto:${supportEmail}`} className="text-slate-700 underline">
                    {supportEmail}
                  </Link>
                </Text>

                <Text className="m-0 mt-2 text-[12px] leading-5 text-slate-400">
                  © {new Date().getFullYear()} SwiftDU. All rights reserved.
                </Text>
              </Section>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  )
}
