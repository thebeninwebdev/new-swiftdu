import { Button, Section, Text } from "@react-email/components";

import EmailLayout from "@/emails/components/EmailLayout";
import { primaryButtonStyle } from "@/emails/components/styles";

interface TaskerApprovalEmailProps {
  name: string;
  onboardingUrl: string;
}

export default function TaskerApprovalEmail({
  name,
  onboardingUrl,
}: TaskerApprovalEmailProps) {
  return (
    <EmailLayout
      preview="Congratulations — you have been selected as a SwiftDU Tasker."
      eyebrow="Tasker application"
      title="Congratulations — you’re a SwiftDU Tasker 🎉"
      greeting={`Hi ${name || "there"},`}
      intro="You’ve been selected to join the SwiftDU Community as a verified Tasker. Sign in to open your Tasker dashboard and continue into training."
    >
      <Section style={{ textAlign: "center", margin: "28px 0" }}>
        <Button href={onboardingUrl} style={primaryButtonStyle}>
          Open Tasker Dashboard
        </Button>
      </Section>
      <Text style={{ color: "#475569", fontSize: "14px", lineHeight: "22px" }}>
        Use your existing SwiftDU sign-in details to access your account. One of our team members will contact you shortly with the next steps.
      </Text>
    </EmailLayout>
  );
}
