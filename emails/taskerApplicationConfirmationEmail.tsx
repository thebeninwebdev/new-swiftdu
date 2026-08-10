import * as React from 'react'
import { Section, Text } from '@react-email/components'

import EmailLayout from '@/emails/components/EmailLayout'

interface TaskerApplicationConfirmationEmailProps {
  name: string
}

export default function TaskerApplicationConfirmationEmail({
  name,
}: TaskerApplicationConfirmationEmailProps) {
  return (
    <EmailLayout
      preview="Your SwiftDU tasker application has been received."
      eyebrow="SwiftDU Taskers"
      title="You’re one step closer to joining the team"
      greeting={`Hi ${name},`}
      intro="Thank you for applying to become a SwiftDU tasker. We’re glad you’re interested in being part of the community that keeps things moving on campus."
    >
      <Section>
        <Text className="m-0 text-[16px] font-semibold leading-6 text-[#18181B]">
          What happens next?
        </Text>

        <Text className="m-0 mt-3 text-[14px] leading-6 text-[#52525B]">
          Our team will review your application, including your matric number,
          availability and the information you provided.
        </Text>

        <Text className="m-0 mt-4 text-[14px] leading-6 text-[#52525B]">
          If your application moves forward, we’ll contact you with the next
          steps for joining the SwiftDU tasker community and completing your
          onboarding.
        </Text>
      </Section>

      <Section
        className="mt-6 rounded-[12px] px-4 py-4"
        style={{ backgroundColor: '#f1f5f9' }}
      >
        <Text className="m-0 text-[14px] leading-6 text-[#3F3A34]">
          For now, there’s nothing else you need to do. Just keep an eye on
          your email — we’ll reach out when there’s an update.
        </Text>
      </Section>

      <Text className="m-0 mt-6 text-[14px] leading-6 text-[#52525B]">
        We’re building SwiftDU with people who are dependable, respectful and
        proud to serve their campus community. We appreciate your interest in
        being part of that.
      </Text>
    </EmailLayout>
  )
}
