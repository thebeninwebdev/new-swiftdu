"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { toast } from "sonner";

const BRAND_PRIMARY = "#4f46e5";
const BRAND_PRIMARY_DARK = "#4338ca";
const CARD_BORDER = "rgba(255,255,255,0.6)";
const CARD_SHADOW = "0 24px 80px rgba(79,70,229,0.18)";

export default function LoginPage() {
  const router = useRouter();
  const [form, setForm] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState("");

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validationErrors = validate();
    if (Object.keys(validationErrors).length) {
      setErrors(validationErrors);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await authClient.signIn.email({
        email: form.email,
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

      // Role-based redirect
      if (data?.user?.role === 'admin') {
        router.push('/admin');
      } else if (data?.user?.role === 'tasker') {
        router.push('/tasker-dashboard');
      } else {
        router.push('/dashboard');
      }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      setServerError(err?.message || "Invalid email or password.");
    } finally {
      setLoading(false);
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

          {/* Logo */}
          <div style={{ textAlign: "center", marginBottom: "32px" }}>
            <div className="flex-center gap-x-3 relative">
            <Link href="/">
            <Image src={"/logo.png"} alt="logo" width={342} height={63} className="object-contain w-28"/>
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
              <input
                id="password" name="password" type="password" autoComplete="current-password"
                placeholder="Password"
                value={form.password} onChange={handleChange}
                style={errors.password ? errStyle : base}
                onFocus={e => { e.currentTarget.style.borderColor = BRAND_PRIMARY; e.currentTarget.style.boxShadow = `0 0 0 3px ${BRAND_PRIMARY}22`; }}
                onBlur={e => { e.currentTarget.style.borderColor = errors.password ? "#dc2626" : "#d1d5db"; e.currentTarget.style.boxShadow = "none"; }}
              />
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
              disabled={loading}
              style={{
                width: "100%", borderRadius: "999px",
                background: BRAND_PRIMARY, color: "#fff", border: "none",
                padding: "15px", fontSize: "16px", fontWeight: 700,
                cursor: loading ? "not-allowed" : "pointer",
                opacity: loading ? 0.65 : 1,
                transition: "background 0.15s, transform 0.1s, box-shadow 0.15s",
                letterSpacing: "0.01em",
                boxShadow: "0 16px 32px rgba(99,102,241,0.22)",
              }}
              onMouseEnter={e => { if (!loading) e.currentTarget.style.background = BRAND_PRIMARY_DARK; }}
              onMouseLeave={e => { e.currentTarget.style.background = BRAND_PRIMARY; }}
              onMouseDown={e => { e.currentTarget.style.transform = "scale(0.98)"; }}
              onMouseUp={e => { e.currentTarget.style.transform = "scale(1)"; }}
            >
              {loading ? "Logging in…" : "Log in"}
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

      {/* Help pill */}
      <button
        style={{
          position: "fixed", bottom: 24, left: 24, zIndex: 50,
          display: "flex", alignItems: "center", gap: 6,
          background: "linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)",
          color: "#fff", border: "none", borderRadius: "999px",
          padding: "10px 18px", fontSize: 14, fontWeight: 600,
          cursor: "pointer", boxShadow: "0 12px 30px rgba(79,70,229,0.28)",
        }}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
        Help
      </button>
    </div>
  );
}
