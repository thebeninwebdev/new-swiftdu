import * as React from 'react';
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
  Tailwind,
} from '@react-email/components';

interface VerifyEmailProps {
  url: string;
  name: string;
}

const verifyEmail = (props: VerifyEmailProps) => {
  const { url, name } = props;

  return (
    <Html lang="en" dir="ltr">
      <Tailwind>
        <Head />
        <Preview>Verify your SwiftDU account to get started</Preview>
        <Body className="bg-gray-100 font-sans py-10">
          <Container className="bg-white rounded-[8px] shadow-sm max-w-145 mx-auto px-10 py-10">
            {/* Header */}
            <Section className="text-center mb-8">
              <Heading className="text-[28px] font-bold text-gray-900 m-0 mb-2">
                SwiftDU
              </Heading>
            </Section>

            {/* Main Content */}
            <Section className="mb-8">
              <Heading className="text-[24px] font-bold text-gray-900 mb-4 mt-0">
                Verify Your Email Address
              </Heading>
              
              <Text className="text-[16px] text-gray-700 leading-6 mb-4 mt-0">
                Hi {name},
              </Text>
              
              <Text className="text-[16px] text-gray-700 leading-6 mb-4 mt-0">
                Welcome to SwiftDU! We&apos;re excited to have you join our community of users who trust us for reliable services.
              </Text>
              
              <Text className="text-[16px] text-gray-700 leading-5 mb-6 mt-0">
                To complete your account setup and start using SwiftDU&apos;s services, please verify your email address by clicking the button below:
              </Text>

              {/* Verification Button */}
              <Section className="text-center mb-8">
                <Button
                  href={url}
                  className="bg-blue-600 text-white px-8 py-4 rounded-[8px] text-[16px] font-semibold no-underline box-border inline-block"
                >
                  Verify Email Address
                </Button>
              </Section>

              <Text className="text-[14px] text-gray-600 leading-5 mb-4 mt-0">
                If the button doesn&apos;t work, you can copy and paste this link into your browser:
              </Text>
              
              <Text className="text-[14px] text-blue-600 break-all mb-6 mt-0">
                {url}
              </Text>

              <Text className="text-[14px] text-gray-600 leading-5 mb-4 mt-0">
                This verification link will expire in 24 hours for security purposes.
              </Text>
            </Section>

            {/* Security Notice */}
            <Section className="bg-gray-50 rounded-[8px] px-6 py-5 mb-8">
              <Text className="text-[14px] text-gray-700 leading-5 mb-2 mt-0 font-semibold">
                Security Notice:
              </Text>
              <Text className="text-[14px] text-gray-600 leading-5 m-0">
                If you didn&apos;t create a SwiftDU account, please ignore this email. Your email address will not be added to our system.
              </Text>
            </Section>

            {/* Footer */}
            <Section className="border-t border-gray-200 pt-6">
              <Text className="text-[14px] text-gray-600 leading-5 mb-2 mt-0">
                Best regards,<br />
                The SwiftDU Team
              </Text>
              
              <Text className="text-[12px] text-gray-500 leading-5 m-0">
                SwiftDU<br />
                123 Business District, Lagos, Nigeria<br />
                <br />
                © {new Date().getFullYear()} SwiftDU. All rights reserved
              </Text>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
};

export default verifyEmail;