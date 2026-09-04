"use client";

import { Suspense, useEffect, useState } from "react";
import { authClient } from "@/lib/auth-client";
import { getPostAuthRedirect } from "@/lib/profile-completion";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { toast } from "sonner";
import { Fingerprint } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

const BRAND_PRIMARY = "#4f46e5";
const BRAND_PRIMARY_DARK = "#4338ca";
const CARD_BORDER = "rgba(255,255,255,0.6)";
const CARD_SHADOW = "0 24px 80px rgba(79,70,229,0.18)";

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [form, setForm] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [passkeyLoading, setPasskeyLoading] = useState(false);
  const [passkeySetupOpen, setPasskeySetupOpen] = useState(false);
  const [passkeySetupLoading, setPasskeySetupLoading] = useState(false);
  const [passkeySetupForm, setPasskeySetupForm] = useState({
    email: "",
    password: "",
  });
  const [passkeySetupErrors, setPasskeySetupErrors] = useState<
    Record<string, string>
  >({});
  const [showSetupPassword, setShowSetupPassword] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState("");
  const { data: session } = authClient.useSession();

  const callbackUrl = searchParams.get("callbackUrl");
  const safeCallbackUrl =
    callbackUrl && callbackUrl.startsWith("/") && !callbackUrl.startsWith("//")
      ? callbackUrl
      : "";
  const postAuthRedirect = (user?: Parameters<typeof getPostAuthRedirect>[0]) =>
    safeCallbackUrl || getPostAuthRedirect(user);

  const getAuthErrorMessage = (
    err: unknown,
    fallback: string
  ) => (err instanceof Error ? err.message : fallback);

  const hasErrorCode = (error: unknown, code: string) =>
    Boolean(
      error &&
        typeof error === "object" &&
        "code" in error &&
        error.code === code
    );

  const getPasskeySupportMessage = async () => {
    if (!window.isSecureContext) {
      return "Face ID or fingerprint sign-in needs a secure HTTPS connection on iPhone and most mobile browsers.";
    }

    if (!window.PublicKeyCredential) {
      return "This device does not support fingerprint or Face ID sign-in.";
    }

    if (
      typeof PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable ===
      "function"
    ) {
      try {
        const isAvailable =
          await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();

        if (!isAvailable) {
          return "Face ID, Touch ID, or fingerprint unlock is not available on this device. Check your device lock settings and try again.";
        }
      } catch {
        return "Could not check this device's Face ID or fingerprint support. Please try again.";
      }
    }

    return "";
  };

  const isPasskeyNotAvailableError = (error: unknown) => {
    if (hasErrorCode(error, "AUTH_CANCELLED")) return true;

    const message =
      error instanceof Error
        ? error.message
        : error && typeof error === "object" && "message" in error
          ? String(error.message)
          : "";

    return /not\s*allowed|cancel|no credential|not registered|authenticator|passkey/i.test(
      message
    );
  };

  const getPasskeySetupErrorMessage = (error: unknown) => {
    if (hasErrorCode(error, "ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED")) {
      return "This device is already enabled for Face ID or fingerprint sign-in.";
    }

    const message =
      error instanceof Error
        ? error.message
        : error && typeof error === "object" && "message" in error
          ? String(error.message)
          : "";

    if (/secure|https|origin|rp id|domain/i.test(message)) {
      return "Face ID or fingerprint setup needs the app to be opened on its secure HTTPS domain.";
    }

    if (/not\s*allowed|cancel|timeout|gesture|authenticator/i.test(message)) {
      return "Face ID or fingerprint setup was not completed. Unlock with Face ID, Touch ID, or your device passcode when your browser asks.";
    }

    return message || "Could not enable biometric sign-in.";
  };
  
  useEffect(() => {
    if (session?.user && !passkeyLoading && !passkeySetupLoading) {
      router.replace(postAuthRedirect(session.user));
    }
  }, [passkeyLoading, passkeySetupLoading, router, session?.user, safeCallbackUrl]);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      e.email = "Must be a valid email address.";
    if (!form.password) e.password = "Must enter a valid password.";
    return e;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setErrors((prev) => ({ ...prev, [e.target.name]: "" }));
    setServerError("");
  };

  const handlePasskeySetupChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    setPasskeySetupForm((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
    setPasskeySetupErrors((prev) => ({ ...prev, [e.target.name]: "" }));
    setServerError("");
  };

  const openPasskeySetup = () => {
    setPasskeySetupForm({
      email: form.email,
      password: "",
    });
    setPasskeySetupErrors({});
    setPasskeySetupOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validationErrors = validate();
    if (Object.keys(validationErrors).length) {
      setErrors(validationErrors);
      return;
    }

    setLoading(true);
    try {
      const normalizedEmail = form.email.trim().toLowerCase();
      const activationResponse = await fetch("/api/tasker-onboarding/request-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalizedEmail }),
      });
      const activation = await activationResponse.json().catch(() => ({}));

      if (activation.activationRequired) {
        if (!activationResponse.ok) {
          throw new Error(
            "Your Tasker account needs activation, but we could not send the secure link. Please try again shortly."
          );
        }
        setServerError(
          "Your approved Tasker account needs secure activation. Check your email for a private link to continue."
        );
        toast.success("Check your email to activate your Tasker account");
        return;
      }

      if (activation.nextAction === "google") {
        setServerError(
          "This email is connected to Google and does not have a password yet. Continue with Google below."
        );
        return;
      }

      const { data, error } = await authClient.signIn.email({
        email: normalizedEmail,
        password: form.password,
      });

      if (error) {
        toast.error(error.message);
        return;
      }

      // better-auth sets twoFactorRedirect when the account has 2FA enabled.
      // The session is in a pending state until the TOTP/backup code is verified.
      if (data && "twoFactorRedirect" in data) {
        router.push("/verify-2fa");
        return;
      }

      router.push(postAuthRedirect(data?.user));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      setServerError(err?.message || "Invalid email or password.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setServerError("");
    setGoogleLoading(true);

    try {
      const { error } = await authClient.signIn.social({
        provider: "google",
        callbackURL: safeCallbackUrl || "/signup/complete-profile",
        newUserCallbackURL: "/signup/complete-profile",
        errorCallbackURL: "/login",
      });

      if (error) {
        throw error;
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : "Google sign in failed. Please try again.";

      setServerError(message);
      toast.error("Google sign in failed", {
        description: message,
      });
    } finally {
      setGoogleLoading(false);
    }
  };

  const validatePasskeySetup = () => {
    const validationErrors: Record<string, string> = {};

    if (
      !passkeySetupForm.email ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(passkeySetupForm.email)
    ) {
      validationErrors.email = "Must be a valid email address.";
    }

    if (!passkeySetupForm.password) {
      validationErrors.password = "Must enter your password.";
    }

    setPasskeySetupErrors(validationErrors);
    return validationErrors;
  };

  const enablePasskeyForLogin = async (credentials: {
    email: string;
    password: string;
  }) => {
    const supportMessage = await getPasskeySupportMessage();

    if (supportMessage) {
      throw new Error(supportMessage);
    }

    const { data: signInData, error: signInError } =
      await authClient.signIn.email({
        email: credentials.email,
        password: credentials.password,
      });

    if (signInError) {
      throw new Error(signInError.message || "Invalid email or password.");
    }

    if (signInData && "twoFactorRedirect" in signInData) {
      router.push("/verify-2fa");
      throw new Error(
        "Complete two-factor verification before enabling Face ID or fingerprint sign-in."
      );
    }

    const { error: passkeyError } = await authClient.passkey.addPasskey({
      name: "Fingerprint / Face ID",
      authenticatorAttachment: "platform",
    });

    if (passkeyError) {
      throw new Error(getPasskeySetupErrorMessage(passkeyError));
    }

    toast.success("Fingerprint / Face ID sign-in enabled");
    router.push(postAuthRedirect(signInData?.user));
  };

  const handlePasskeySetupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const validationErrors = validatePasskeySetup();
    if (Object.keys(validationErrors).length) {
      return;
    }

    setPasskeySetupLoading(true);

    try {
      await enablePasskeyForLogin({
        email: passkeySetupForm.email,
        password: passkeySetupForm.password,
      });
      setPasskeySetupOpen(false);
    } catch (err: unknown) {
      const message = getAuthErrorMessage(
        err,
        "Could not enable biometric sign-in."
      );
      setServerError(message);
      toast.error(message);
    } finally {
      setPasskeySetupLoading(false);
    }
  };

  const handlePasskeySignIn = async () => {
    setServerError("");

    const supportMessage = await getPasskeySupportMessage();

    if (supportMessage) {
      const message = supportMessage;
      setServerError(message);
      toast.error(message);
      return;
    }

    setPasskeyLoading(true);

    try {
      const { data, error } = await authClient.signIn.passkey();

      if (error) {
        if (isPasskeyNotAvailableError(error)) {
          openPasskeySetup();
          return;
        }

        throw new Error(error.message || "Fingerprint / Face ID sign-in failed.");
      }

      router.push(postAuthRedirect(data?.user));
    } catch (err: unknown) {
      const message = getAuthErrorMessage(
        err,
        "Fingerprint / Face ID sign-in failed. Please try again."
      );

      setServerError(message);
      toast.error(message);
    } finally {
      setPasskeyLoading(false);
    }
  };

  const base: React.CSSProperties = {
    width: "100%",
    border: "1.5px solid #d1d5db",
    borderRadius: "8px",
    padding: "13px 16px",
    fontSize: "15px",
    color: "#111827",
    outline: "none",
    background: "#fff",
    boxSizing: "border-box",
    transition: "border-color 0.15s, box-shadow 0.15s",
  };

  const errStyle: React.CSSProperties = {
    ...base,
    borderColor: "#dc2626",
    background: "#fff5f5",
  };

  return (
    <div style={{ position: "relative", minHeight: "100vh", overflow: "hidden" }}>

      {/* Background photo */}
      <div
        style={{
          position: "absolute", inset: 0,
          backgroundImage: "url('/sign-up.jpg')",
          backgroundSize: "cover",
          backgroundPosition: "center top",
        }}
      />
      <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.7)" }} />

      {/* Centered card */}
      <div style={{
        position: "relative", zIndex: 10,
        display: "flex", alignItems: "center", justifyContent: "center",
        minHeight: "100vh", padding: "32px 16px",
      }}>
        <div style={{
          width: "100%", maxWidth: "480px",
          background: "rgba(255,255,255,0.92)",
          border: `1px solid ${CARD_BORDER}`,
          borderRadius: "20px",
          padding: "44px 48px 40px",
          boxShadow: CARD_SHADOW,
          backdropFilter: "blur(18px)",
        }}>
          <div style={{ marginBottom: 18 }}>
            <Link
              href="/"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                color: BRAND_PRIMARY,
                fontSize: 14,
                fontWeight: 700,
                textDecoration: "none",
              }}
            >
              <span aria-hidden="true">←</span>
              Back to home
            </Link>
          </div>

          {/* Logo */}
          <div style={{ textAlign: "center", marginBottom: "28px" }}>
            <div className="flex-center gap-x-3 relative">
            <Link href="/">
            <Image src={"/logo.png?v=20260826"} alt="logo" width={342} height={63} className="object-contain w-28"/>
            </Link>
          </div>
          </div>

          {/* Server error */}
          {serverError && (
            <div style={{
              marginBottom: 20, borderRadius: 8,
              border: "1px solid #fca5a5", background: "#fef2f2",
              padding: "12px 16px", fontSize: 14, color: "#b91c1c",
            }}>
              {serverError}
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate>

            {/* Email */}
            <div style={{ marginBottom: "16px" }}>
              <label htmlFor="email" style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#111827", marginBottom: 6 }}>
                Email Address
              </label>
              <input
                id="email" name="email" type="email" autoComplete="email"
                placeholder="Email Address"
                value={form.email} onChange={handleChange}
                style={errors.email ? errStyle : base}
                onFocus={e => { e.currentTarget.style.borderColor = BRAND_PRIMARY; e.currentTarget.style.boxShadow = `0 0 0 3px ${BRAND_PRIMARY}22`; }}
                onBlur={e => { e.currentTarget.style.borderColor = errors.email ? "#dc2626" : "#d1d5db"; e.currentTarget.style.boxShadow = "none"; }}
              />
              {errors.email && (
                <p style={{ marginTop: 5, fontSize: 13, color: "#dc2626", fontWeight: 500 }}>{errors.email}</p>
              )}
            </div>

            {/* Password */}
            <div style={{ marginBottom: "8px" }}>
              <label htmlFor="password" style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#111827", marginBottom: 6 }}>
                Password
              </label>
              <div style={{ position: "relative" }}>
                <input
                  id="password" name="password" type={showPassword ? "text" : "password"} autoComplete="current-password"
                  placeholder="Password"
                  value={form.password} onChange={handleChange}
                  style={{
                    ...(errors.password ? errStyle : base),
                    paddingRight: "84px",
                  }}
                  onFocus={e => { e.currentTarget.style.borderColor = BRAND_PRIMARY; e.currentTarget.style.boxShadow = `0 0 0 3px ${BRAND_PRIMARY}22`; }}
                  onBlur={e => { e.currentTarget.style.borderColor = errors.password ? "#dc2626" : "#d1d5db"; e.currentTarget.style.boxShadow = "none"; }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  style={{
                    position: "absolute",
                    top: "50%",
                    right: 12,
                    transform: "translateY(-50%)",
                    border: "none",
                    background: "transparent",
                    color: BRAND_PRIMARY,
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: "pointer",
                    padding: 0,
                  }}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
              {errors.password && (
                <p style={{ marginTop: 5, fontSize: 13, color: "#dc2626", fontWeight: 500 }}>{errors.password}</p>
              )}
            </div>

            {/* Forgot password */}
            <div style={{ marginBottom: "24px" }}>
              <Link
                href="/password/reset"
                style={{ fontSize: 14, fontWeight: 600, color: BRAND_PRIMARY, textDecoration: "none" }}
              >
                Forgot password?
              </Link>
            </div>

            {/* Log in button */}
            <button
              type="submit"
              disabled={loading || googleLoading || passkeyLoading}
              style={{
                width: "100%", borderRadius: "999px",
                background: BRAND_PRIMARY, color: "#fff", border: "none",
                padding: "15px", fontSize: "16px", fontWeight: 700,
                cursor: loading || googleLoading || passkeyLoading ? "not-allowed" : "pointer",
                opacity: loading || googleLoading || passkeyLoading ? 0.65 : 1,
                transition: "background 0.15s, transform 0.1s, box-shadow 0.15s",
                letterSpacing: "0.01em",
                boxShadow: "0 16px 32px rgba(99,102,241,0.22)",
              }}
              onMouseEnter={e => { if (!loading && !googleLoading && !passkeyLoading) e.currentTarget.style.background = BRAND_PRIMARY_DARK; }}
              onMouseLeave={e => { e.currentTarget.style.background = BRAND_PRIMARY; }}
              onMouseDown={e => { e.currentTarget.style.transform = "scale(0.98)"; }}
              onMouseUp={e => { e.currentTarget.style.transform = "scale(1)"; }}
            >
              {loading ? "Logging in…" : "Log in"}
            </button>

            <div style={{ position: "relative", marginTop: 18, marginBottom: 2 }}>
              <div style={{ position: "absolute", inset: "50% 0 auto", borderTop: "1px solid #e5e7eb" }} />
              <div style={{ position: "relative", textAlign: "center" }}>
                <span
                  style={{
                    background: "rgba(255,255,255,0.92)",
                    padding: "0 12px",
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                    color: "#9ca3af",
                  }}
                >
                  Or continue with
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={loading || googleLoading || passkeyLoading}
              style={{
                width: "100%",
                marginTop: 18,
                borderRadius: "999px",
                border: "1px solid #e5e7eb",
                background: "#fff",
                color: "#374151",
                padding: "14px 16px",
                fontSize: "15px",
                fontWeight: 700,
                cursor: loading || googleLoading || passkeyLoading ? "not-allowed" : "pointer",
                opacity: loading || googleLoading || passkeyLoading ? 0.65 : 1,
                transition: "background 0.15s, transform 0.1s, box-shadow 0.15s",
                boxShadow: "0 8px 24px rgba(15,23,42,0.06)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 10,
              }}
              onMouseEnter={e => {
                if (!loading && !googleLoading && !passkeyLoading) e.currentTarget.style.background = "#f9fafb";
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = "#fff";
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="#EA4335"
                  d="M12 10.2v3.9h5.5c-.2 1.3-1.5 3.9-5.5 3.9-3.3 0-6-2.7-6-6s2.7-6 6-6c1.9 0 3.2.8 3.9 1.5l2.7-2.6C16.9 3.2 14.7 2.2 12 2.2a9.8 9.8 0 1 0 0 19.6c5.6 0 9.3-3.9 9.3-9.4 0-.6-.1-1.1-.2-1.5H12Z"
                />
                <path
                  fill="#4285F4"
                  d="M3.9 7.4 7.1 9.8c.9-2.1 2.8-3.6 4.9-3.6 1.9 0 3.2.8 3.9 1.5l2.7-2.6C16.9 3.2 14.7 2.2 12 2.2c-3.7 0-7 2.1-8.1 5.2Z"
                />
                <path
                  fill="#FBBC05"
                  d="M12 21.8c2.6 0 4.8-.9 6.4-2.5l-3-2.4c-.8.6-1.9 1.1-3.4 1.1-3.9 0-5.2-2.6-5.5-3.9L3.4 16.4c1.1 3.2 4.4 5.4 8.6 5.4Z"
                />
                <path
                  fill="#34A853"
                  d="M3.4 16.4 6.5 14c-.2-.6-.4-1.3-.4-2s.1-1.4.4-2L3.4 7.4A9.8 9.8 0 0 0 2.2 12c0 1.6.4 3.1 1.2 4.4Z"
                />
              </svg>
              <span>{googleLoading ? "Connecting to Google..." : "Login with Google"}</span>
            </button>

            <button
              type="button"
              onClick={handlePasskeySignIn}
              aria-label="Continue with fingerprint or Face ID"
              title="Continue with fingerprint or Face ID"
              disabled={loading || googleLoading || passkeyLoading || passkeySetupLoading}
              style={{
                width: 52,
                height: 52,
                marginTop: 18,
                marginLeft: "auto",
                marginRight: "auto",
                borderRadius: "999px",
                border: "1px solid #e5e7eb",
                background: "#111827",
                color: "#fff",
                padding: 0,
                cursor: loading || googleLoading || passkeyLoading || passkeySetupLoading ? "not-allowed" : "pointer",
                opacity: loading || googleLoading || passkeyLoading || passkeySetupLoading ? 0.65 : 1,
                transition: "background 0.15s, transform 0.1s, box-shadow 0.15s",
                boxShadow: "0 8px 24px rgba(15,23,42,0.12)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
              onMouseEnter={e => {
                if (!loading && !googleLoading && !passkeyLoading && !passkeySetupLoading) e.currentTarget.style.background = "#0f172a";
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = "#111827";
              }}
            >
              <Fingerprint size={24} aria-hidden="true" />
            </button>
          </form>

          {/* Sign up link */}
          <p style={{ marginTop: 16, textAlign: "center", fontSize: 13, color: "#6b7280" }}>
            Don&apos;t have an account?{" "}
            <Link href="/signup" style={{ color: BRAND_PRIMARY, fontWeight: 600, textDecoration: "none" }}>
              Sign up
            </Link>
          </p>
        </div>
      </div>

      <Dialog open={passkeySetupOpen} onOpenChange={setPasskeySetupOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handlePasskeySetupSubmit} className="space-y-5">
            <DialogHeader>
              <DialogTitle>Set up biometric sign-in</DialogTitle>
              <DialogDescription>
                Enter your SwiftDU login details once, then approve Face ID,
                Touch ID, or fingerprint when your device asks.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <label
                  htmlFor="passkey-email"
                  className="text-sm font-medium text-foreground"
                >
                  Email Address
                </label>
                <Input
                  id="passkey-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  value={passkeySetupForm.email}
                  onChange={handlePasskeySetupChange}
                  disabled={passkeySetupLoading}
                  aria-invalid={Boolean(passkeySetupErrors.email)}
                />
                {passkeySetupErrors.email && (
                  <p className="text-sm font-medium text-destructive">
                    {passkeySetupErrors.email}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="passkey-password"
                  className="text-sm font-medium text-foreground"
                >
                  Password
                </label>
                <div className="relative">
                  <Input
                    id="passkey-password"
                    name="password"
                    type={showSetupPassword ? "text" : "password"}
                    autoComplete="current-password"
                    value={passkeySetupForm.password}
                    onChange={handlePasskeySetupChange}
                    disabled={passkeySetupLoading}
                    aria-invalid={Boolean(passkeySetupErrors.password)}
                    className="pr-16"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSetupPassword((prev) => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-indigo-600"
                    disabled={passkeySetupLoading}
                  >
                    {showSetupPassword ? "Hide" : "Show"}
                  </button>
                </div>
                {passkeySetupErrors.password && (
                  <p className="text-sm font-medium text-destructive">
                    {passkeySetupErrors.password}
                  </p>
                )}
              </div>
            </div>

            <DialogFooter className="gap-3 sm:gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setPasskeySetupOpen(false)}
                disabled={passkeySetupLoading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={passkeySetupLoading}>
                {passkeySetupLoading ? "Setting up..." : "Set up"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginContent />
    </Suspense>
  );
}
