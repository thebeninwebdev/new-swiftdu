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

interface TaskAcceptedEmailProps {
  userName: string;
  taskerName: string;
  description: string;
  amount: number;
  location: string;
  deadline: string;
}

const TaskAcceptedEmail = (props: TaskAcceptedEmailProps) => {
  const { userName, taskerName, description, amount, location, deadline } = props;
  return (
    <Html lang="en" dir="ltr">
      <Tailwind>
        <Head />
        <Preview>Your Task Has Been Accepted</Preview>
        <Body className="bg-gray-100 font-sans py-10">
          <Container className="bg-white rounded-[8px] shadow-sm max-w-145 mx-auto px-10 py-10">
            <Section className="text-center mb-8">
              <Heading className="text-[28px] font-bold text-gray-900 m-0 mb-2">
                SwiftDU
              </Heading>
            </Section>
            <Section className="mb-8">
              <Heading className="text-[22px] font-bold text-gray-900 mb-4 mt-0">
                Your Task Has Been Accepted!
              </Heading>
              <Text className="text-[16px] text-gray-700 leading-6 mb-2 mt-0">
                Hello {userName},
              </Text>
              <Text className="text-[16px] text-gray-700 leading-5 mb-4 mt-0">
                Your task has been accepted by <b>{taskerName}</b>. Please make payment to proceed.
              </Text>
              <Text className="text-[16px] text-gray-700 leading-5 mb-2 mt-0">
                <b>Description:</b> {description}
              </Text>
              <Text className="text-[16px] text-gray-700 leading-5 mb-2 mt-0">
                <b>Amount:</b> ₦{amount}
              </Text>
              <Text className="text-[16px] text-gray-700 leading-5 mb-2 mt-0">
                <b>Location:</b> {location}
              </Text>
              <Text className="text-[16px] text-gray-700 leading-5 mb-2 mt-0">
                <b>Deadline:</b> {deadline}
              </Text>
              <Section className="text-center mt-6">
                <Button
                  href="https://swiftdu.com/dashboard/tasks"
                  className="bg-indigo-600 text-white px-8 py-4 rounded-[8px] text-[16px] font-semibold no-underline box-border inline-block"
                >
                  Go to My Tasks
                </Button>
              </Section>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
};

export default TaskAcceptedEmail;
