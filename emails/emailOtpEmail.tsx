import EmailLayout from "./components/EmailLayout";

export default function EmailOtpEmail({ otp }: { otp: string }) {
  return (
    <EmailLayout preview="Your SwiftDU sign-in code" eyebrow="Secure sign in" title="Your SwiftDU code">
      <p style={{ color: "#4b5563", lineHeight: 1.6 }}>
        Enter this one-time code in the same SwiftDU browser where you requested it:
      </p>
      <p style={{ color: "#312e81", fontSize: 32, fontWeight: 700, letterSpacing: 8, margin: "20px 0" }}>
        {otp}
      </p>
      <p style={{ color: "#6b7280", fontSize: 13, lineHeight: 1.5 }}>
        This code expires in 5 minutes and can only be used once. Never share it with anyone.
      </p>
      <p style={{ color: "#6b7280", fontSize: 13, lineHeight: 1.5, marginTop: 20 }}>
        If you did not request this code, you can safely ignore this email.
      </p>
    </EmailLayout>
  );
}