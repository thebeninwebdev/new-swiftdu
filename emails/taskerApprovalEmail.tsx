import { Button, Section, Text } from "@react-email/components";

import EmailLayout from "@/emails/components/EmailLayout";
import { primaryButtonStyle } from "@/emails/components/styles";

interface TaskerApprovalEmailProps {
  name: string;
  onboardingUrl: string;
  expiresInHours: number;
}

export default function TaskerApprovalEmail({
  name,
  onboardingUrl,
  expiresInHours,
}: TaskerApprovalEmailProps) {
  return (
    <EmailLayout
      preview="Your SwiftDU Tasker application has been approved."
      eyebrow="Tasker application"
      title="Your Tasker application is approved"
      greeting={`Hi ${name || "there"},`}
      intro="You can now securely connect your application to your SwiftDU account and continue into Tasker training."
    >
      <Section style={{ textAlign: "center", margin: "28px 0" }}>
        <Button href={onboardingUrl} style={primaryButtonStyle}>
          Continue Tasker Onboarding
        </Button>
      </Section>
      <Text style={{ color: "#475569", fontSize: "14px", lineHeight: "22px" }}>
        This private link expires in {expiresInHours} hours and can only be used
        to activate the approved application. If you did not apply, you can
        safely ignore this email.
      </Text>
    </EmailLayout>
  );
}
