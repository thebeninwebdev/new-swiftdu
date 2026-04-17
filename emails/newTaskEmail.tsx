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
  Tailwind,
  Text,
} from '@react-email/components';

interface NewTaskEmailProps {
  taskerName?: string;
  taskType?: string;
  description: string;
  amount: number;
  location: string;
  userName: string;
  taskUrl: string;
}

const NewTaskEmail = (props: NewTaskEmailProps) => {
  const {
    taskerName,
    taskType,
    description,
    amount,
    location,
    userName,
    taskUrl,
  } = props;

  const formattedAmount = new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    maximumFractionDigits: 2,
  }).format(amount);

  return (
    <Html lang="en" dir="ltr">
      <Tailwind>
        <Head />
        <Preview>New task posted on SwiftDU</Preview>
        <Body className="bg-gray-100 font-sans py-10">
          <Container className="bg-white rounded-[8px] shadow-sm max-w-145 mx-auto px-10 py-10">
            <Section className="text-center mb-8">
              <Heading className="text-[28px] font-bold text-gray-900 m-0 mb-2">
                SwiftDU
              </Heading>
            </Section>

            <Section className="mb-8">
              <Heading className="text-[22px] font-bold text-gray-900 mb-4 mt-0">
                New Task Available
              </Heading>

              <Text className="text-[16px] text-gray-700 leading-6 mb-2 mt-0">
                Hello {taskerName || 'Tasker'},
              </Text>

              <Text className="text-[16px] text-gray-700 leading-5 mb-4 mt-0">
                A new {taskType || 'task'} has just been posted by {userName}.
              </Text>

              <Text className="text-[16px] text-gray-700 leading-5 mb-2 mt-0">
                <b>Description:</b> {description}
              </Text>
              <Text className="text-[16px] text-gray-700 leading-5 mb-2 mt-0">
                <b>Amount:</b> {formattedAmount}
              </Text>
              <Text className="text-[16px] text-gray-700 leading-5 mb-2 mt-0">
                <b>Location:</b> {location}
              </Text>

              <Section className="text-center mt-6">
                <Button
                  href={taskUrl}
                  className="bg-indigo-600 text-white px-8 py-4 rounded-[8px] text-[16px] font-semibold no-underline box-border inline-block"
                >
                  View Task Dashboard
                </Button>
              </Section>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
};

export default NewTaskEmail;
