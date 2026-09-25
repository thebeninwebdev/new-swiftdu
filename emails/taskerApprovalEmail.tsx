import { Button, Section, Text } from "@react-email/components";

import EmailLayout from "@/emails/components/EmailLayout";
import { primaryButtonStyle } from "@/emails/components/styles";

interface TaskerApprovalEmailProps {
  name: string;
  onboardingUrl: string;
  expiresInHours: number;
  accountLinked?: boolean;
}

export default function TaskerApprovalEmail({
  name,
  onboardingUrl,
  expiresInHours,
  accountLinked = false,
}: TaskerApprovalEmailProps) {
  return (
    <EmailLayout
      preview="Your SwiftDU Tasker application has been approved."
      eyebrow="Tasker application"
      title="Your Tasker application is approved"
      greeting={`Hi ${name || "there"},`}
      intro={accountLinked ? "Your SwiftDU account is now a Tasker account. Sign in to open your dashboard and continue into Tasker training." : "You can now securely connect your application to your SwiftDU account and continue into Tasker training."}
    >
      <Section style={{ textAlign: "center", margin: "28px 0" }}>
        <Button href={onboardingUrl} style={primaryButtonStyle}>
          {accountLinked ? 'Open Tasker Dashboard' : 'Continue Tasker Onboarding'}
        </Button>
      </Section>
      <Text style={{ color: "#475569", fontSize: "14px", lineHeight: "22px" }}>
        {accountLinked ? 'Use your existing SwiftDU sign-in details to access your Tasker account.' : `This private link expires in ${expiresInHours} hours and can only be used to activate the approved application. If you did not apply, you can safely ignore this email.`}
      </Text>
    </EmailLayout>
  );
}
