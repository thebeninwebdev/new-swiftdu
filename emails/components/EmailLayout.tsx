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
        <Head>
          <meta name="color-scheme" content="light only" />
          <meta name="supported-color-schemes" content="light only" />
          <style>{`
            @media only screen and (max-width: 480px) {
              .email-body { padding: 12px 0 !important; }
              .email-card { border-radius: 16px !important; }
              .email-header { padding: 24px 20px !important; }
              .email-content { padding: 24px 20px !important; }
              .email-footer { padding: 20px !important; }
              .email-title { font-size: 24px !important; line-height: 32px !important; }
              .email-children { margin-top: 24px !important; }
            }
          `}</style>
        </Head>
        <Preview>{preview}</Preview>
        <Body
          className="email-body font-sans"
          style={{ margin: 0, backgroundColor: '#f1f5f9', color: '#0f172a', padding: '32px 0' }}
        >
          <Container style={{ margin: '0 auto', maxWidth: '640px', padding: '0 12px' }}>
            <Section
              className="email-card"
              style={{ overflow: 'hidden', borderRadius: '22px', backgroundColor: '#ffffff' }}
            >
              <Section
                className="email-header"
                style={{ backgroundColor: '#0f172a', padding: '28px 32px' }}
              >
                <Text
                  className="m-0 text-[12px] font-semibold uppercase tracking-[0.24em]"
                  style={{ color: '#bae6fd' }}
                >
                  {eyebrow}
                </Text>
                <Heading className="m-0 mt-4 text-[30px] font-bold" style={{ color: '#ffffff' }}>
                  SwiftDU
                </Heading>
                <Text
                  className="m-0 mt-3 text-[14px] leading-6"
                  style={{ color: '#e2e8f0' }}
                >
                  Fast, reliable campus errands with professional support.
                </Text>
              </Section>

              <Section className="email-content" style={{ backgroundColor: '#ffffff', padding: '28px 32px' }}>
                <Heading
                  className="email-title m-0 text-[28px] font-bold leading-9"
                  style={{ color: '#0f172a' }}
                >
                  {title}
                </Heading>

                {greeting ? (
                  <Text className="m-0 mt-6 text-[16px] leading-7" style={{ color: '#334155' }}>
                    {greeting}
                  </Text>
                ) : null}

                {intro ? (
                  <Text className="m-0 mt-4 text-[16px] leading-7" style={{ color: '#334155' }}>
                    {intro}
                  </Text>
                ) : null}

                <Section className="email-children mt-7">{children}</Section>
              </Section>

              <Section
                className="email-footer"
                style={{ borderTop: '1px solid #e2e8f0', backgroundColor: '#f8fafc', padding: '22px 32px' }}
              >
                <Text className="m-0 text-[14px] leading-6" style={{ color: '#475569' }}>
                  {helpText || (
                    <>
                      Need help? Reply to this email or contact{' '}
                      <Link
                        href={`mailto:${supportEmail}`}
                        className="underline"
                        style={{ color: '#0369a1' }}
                      >
                        {supportEmail}
                      </Link>
                      .
                    </>
                  )}
                </Text>

                <Text className="m-0 mt-4 text-[13px] leading-6" style={{ color: '#64748b' }}>
                  <Link href={siteUrl} className="underline" style={{ color: '#334155' }}>
                    {siteHost}
                  </Link>{' '}
                  <span className="mx-1">&middot;</span>
                  <Link
                    href={`mailto:${supportEmail}`}
                    className="underline"
                    style={{ color: '#334155' }}
                  >
                    {supportEmail}
                  </Link>
                </Text>

                <Text className="m-0 mt-2 text-[12px] leading-5" style={{ color: '#64748b' }}>
                  &copy; {new Date().getFullYear()} SwiftDU. All rights reserved.
                </Text>
              </Section>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  )
}
