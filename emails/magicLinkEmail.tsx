import EmailLayout from "./components/EmailLayout";

export default function MagicLinkEmail({ url }: { url: string }) {
  return (
    <EmailLayout preview="Your secure SwiftDU sign-in link" eyebrow="Secure sign in" title="Sign in to SwiftDU">
      <p style={{ color: "#4b5563", lineHeight: 1.6 }}>
        Use the secure button below to continue to your SwiftDU account. This link expires in 15 minutes and can only be used once.
      </p>
      <a href={url} style={{ background: "#4f46e5", borderRadius: 10, color: "white", display: "inline-block", fontWeight: 600, marginTop: 12, padding: "13px 22px", textDecoration: "none" }}>
        Continue to SwiftDU
      </a>
      <p style={{ color: "#6b7280", fontSize: 13, lineHeight: 1.5, marginTop: 24 }}>
        If you did not request this email, you can safely ignore it.
      </p>
    </EmailLayout>
  );
}
