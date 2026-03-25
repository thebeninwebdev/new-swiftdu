"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import Link from "next/link";
import Image from "next/image";
import { toast } from "sonner";

const GREEN = "#1a6640";
const GREEN_DARK = "#155534";

const COUNTRY_CODES = [
    { code: "NG", dial: "+234", flag: "🇳🇬" },
  { code: "US", dial: "+1", flag: "🇺🇸" },
  { code: "GB", dial: "+44", flag: "🇬🇧" },
  { code: "CA", dial: "+1", flag: "🇨🇦" },
  { code: "AU", dial: "+61", flag: "🇦🇺" },
  { code: "DE", dial: "+49", flag: "🇩🇪" },
  { code: "FR", dial: "+33", flag: "🇫🇷" },
  { code: "ES", dial: "+34", flag: "🇪🇸" },
];

export default function SignUpPage() {
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    location: "",
    password: "",
    confirmPassword: "",
  });
  const [countryDial, setCountryDial] = useState(COUNTRY_CODES[0]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState("");

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.firstName.trim()) e.firstName = "First name is required.";
    if (!form.lastName.trim()) e.lastName = "Last name is required.";
    if (!form.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      e.email = "Must be a valid email address.";
    if (!form.phone.trim()) e.phone = "Phone number is required.";
    if (!form.password || form.password.length < 8)
      e.password = "Password must be at least 8 characters.";
    if (form.password !== form.confirmPassword)
      e.confirmPassword = "Passwords do not match.";
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
      await authClient.signUp.email({
        name: `${form.firstName} ${form.lastName}`,
        email: form.email,
        password: form.password,
        phone: form.phone,
        location: form.location
      });
toast.success("Verify your email", {
  description: "We sent a verification link to your email.",
  action: {
    label: "Open Gmail",
    onClick: () => window.open("https://mail.google.com"),
  },
});

setForm({
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  location: "",
  password: "",
  confirmPassword: "",
});
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      setServerError(err?.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const base: React.CSSProperties = {
    width: "100%",
    border: "1.5px solid #d1d5db",
    borderRadius: "8px",
    padding: "11px 14px",
    fontSize: "15px",
    color: "#111827",
    outline: "none",
    background: "#fff",
    boxSizing: "border-box",
  };

  const errStyle: React.CSSProperties = { ...base, borderColor: "#dc2626", background: "#fff5f5" };

  const inp = (name: keyof typeof form, placeholder: string, type = "text", autoComplete = "") => (
    <div>
      <input
        id={name} name={name} type={type}
        autoComplete={autoComplete || name}
        placeholder={placeholder}
        value={form[name]} onChange={handleChange}
        style={errors[name] ? errStyle : base}
        onFocus={e => { e.currentTarget.style.borderColor = GREEN; e.currentTarget.style.boxShadow = `0 0 0 3px ${GREEN}22`; }}
        onBlur={e => { e.currentTarget.style.borderColor = errors[name] ? "#dc2626" : "#d1d5db"; e.currentTarget.style.boxShadow = "none"; }}
      />
      {errors[name] && <p style={{ marginTop: 4, fontSize: 12, color: "#dc2626" }}>{errors[name]}</p>}
    </div>
  );

  return (
    <div style={{ position: "relative", minHeight: "100vh", overflow: "hidden" }}>

      {/* BG */}
      <div style={{ position: "absolute", inset: 0, backgroundImage: "url('/sign-up.jpg')", backgroundSize: "cover", backgroundPosition: "center top" }} />
      <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.15)" }} />

      {/* Scroll wrapper */}
      <div style={{ position: "relative", zIndex: 10, display: "flex", justifyContent: "center", minHeight: "100vh", padding: "32px 16px 48px", alignItems: "flex-start" }}>
        <div style={{ width: "100%", maxWidth: "540px", background: "#fff", borderRadius: "20px", padding: "32px 44px 32px", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>

          {/* SwiftDU logo text */}
          <div style={{ textAlign: "center", marginBottom: "24px" }}>
            <div className="flex-center gap-x-3 relative">
            <Link href="/">
            <Image src={"/logo.png"} alt="logo" width={342} height={63} className="object-contain w-28"/>
            </Link>
          </div>
          </div>

          {serverError && (
            <div style={{ marginBottom: 20, borderRadius: 8, border: "1px solid #fca5a5", background: "#fef2f2", padding: "12px 16px", fontSize: 14, color: "#b91c1c" }}>
              {serverError}
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate style={{ display: "flex", flexDirection: "column", gap: "14px" }}>

  {/* First + Last name row */}
  <div style={{ display: "flex", gap: "10px" }}>
    <div style={{ flex: 1 }}>{inp("firstName", "First Name", "text", "given-name")}</div>
    <div style={{ flex: 1 }}>{inp("lastName", "Last Name", "text", "family-name")}</div>
  </div>
            {inp("email", "Email Address", "email", "email")}


            {/* Phone row */}
            <div>
              <div style={{ display: "flex", gap: "8px" }}>
                <div style={{ position: "relative", flexShrink: 0 }}>
                  <select
                    value={countryDial.code}
                    onChange={e => {
                      const found = COUNTRY_CODES.find(c => c.code === e.target.value);
                      if (found) setCountryDial(found);
                    }}
                    style={{
                      appearance: "none", WebkitAppearance: "none",
                      border: "1.5px solid #d1d5db", borderRadius: "8px",
                      padding: "14px 32px 14px 12px",
                      fontSize: "14px", background: "#fff", cursor: "pointer",
                      outline: "none", color: "#111827", minWidth: "96px",
                    }}
                  >
                    {COUNTRY_CODES.map(c => (
                      <option key={c.code} value={c.code}>{c.flag} {c.dial}</option>
                    ))}
                  </select>
                  <svg style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: "#6b7280" }} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M6 9l6 6 6-6"/>
                  </svg>
                </div>
                <input
                  id="phone" name="phone" type="tel" autoComplete="tel"
                  placeholder="Phone Number"
                  value={form.phone} onChange={handleChange}
                  style={{ ...(errors.phone ? errStyle : base), flex: 1 }}
                  onFocus={e => { e.currentTarget.style.borderColor = GREEN; e.currentTarget.style.boxShadow = `0 0 0 3px ${GREEN}22`; }}
                  onBlur={e => { e.currentTarget.style.borderColor = errors.phone ? "#dc2626" : "#d1d5db"; e.currentTarget.style.boxShadow = "none"; }}
                />
              </div>
              {errors.phone && <p style={{ marginTop: 4, fontSize: 12, color: "#dc2626" }}>{errors.phone}</p>}
            </div>
 {/* Location select */}
<div>
  <div style={{ position: "relative" }}>
    <select
      id="location"
      name="location"
      value={form.location}
      onChange={e => {
        setForm(prev => ({ ...prev, location: e.target.value }));
        setErrors(prev => ({ ...prev, location: "" }));
        setServerError("");
      }}
      style={{
        ...base,
        appearance: "none", WebkitAppearance: "none",
        cursor: "pointer",
        color: form.location ? "#111827" : "#9ca3af",
        ...(errors.location ? { borderColor: "#dc2626", background: "#fff5f5" } : {}),
      }}
      onFocus={e => { e.currentTarget.style.borderColor = GREEN; e.currentTarget.style.boxShadow = `0 0 0 3px ${GREEN}22`; }}
      onBlur={e => { e.currentTarget.style.borderColor = errors.location ? "#dc2626" : "#d1d5db"; e.currentTarget.style.boxShadow = "none"; }}
    >
      <option value="" disabled>Select your hostel / location</option>
      <option value="Amnesty">Amnesty</option>
      <option value="Girls Hostel">Girls Hostel</option>
      <option value="Law Hall">Law Hall</option>
      <option value="Staff Quarters">Staff Quarters</option>
    </select>
    <svg style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: "#6b7280" }} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 9l6 6 6-6"/>
    </svg>
  </div>
  {errors.location && <p style={{ marginTop: 4, fontSize: 12, color: "#dc2626" }}>{errors.location}</p>}
</div>
<div className="flex flex-col gap-4 md:hidden ">
            {inp("password", "Password", "password", "new-password")}
            {inp("confirmPassword", "Confirm Password", "password", "new-password")}
</div>


              {/* Password row */}
  <div className="md:flex hidden" style={{ gap: "10px" }}>
    <div style={{ flex: 1 }}>{inp("password", "Password", "password", "new-password")}</div>
    <div style={{ flex: 1 }}>{inp("confirmPassword", "Confirm Password", "password", "new-password")}</div>
  </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                marginTop: "6px", width: "100%", borderRadius: "999px",
                background: GREEN, color: "#fff", border: "none",
                padding: "15px", fontSize: "16px", fontWeight: 700,
                cursor: loading ? "not-allowed" : "pointer",
                opacity: loading ? 0.65 : 1, transition: "background 0.15s, transform 0.1s",
                letterSpacing: "0.02em",
              }}
              onMouseEnter={e => { if (!loading) e.currentTarget.style.background = GREEN_DARK; }}
              onMouseLeave={e => { e.currentTarget.style.background = GREEN; }}
              onMouseDown={e => { e.currentTarget.style.transform = "scale(0.98)"; }}
              onMouseUp={e => { e.currentTarget.style.transform = "scale(1)"; }}
            >
              {loading ? "Creating account…" : "Create Account"}
            </button>
          </form>

          <p style={{ marginTop: 20, textAlign: "center", fontSize: 13, color: "#6b7280" }}>
            Already have an account?{" "}
            <Link href="/login" style={{ color: GREEN, fontWeight: 600, textDecoration: "none" }}>
              Log in
            </Link>
          </p>

          <p style={{ marginTop: 12, textAlign: "center", fontSize: 11, color: "#9ca3af", lineHeight: 1.6 }}>
            By creating an account you agree to Taskrabbit&apos;s{" "}
            <a href="#" style={{ textDecoration: "underline" }}>Terms of Service</a> and{" "}
            <a href="#" style={{ textDecoration: "underline" }}>Privacy Policy</a>.
          </p>
        </div>
      </div>

      {/* Help pill */}
      <button style={{
        position: "fixed", bottom: 24, left: 24, zIndex: 50,
        display: "flex", alignItems: "center", gap: 6,
        background: GREEN, color: "#fff", border: "none", borderRadius: "999px",
        padding: "10px 18px", fontSize: 14, fontWeight: 600,
        cursor: "pointer", boxShadow: "0 4px 14px rgba(0,0,0,0.25)",
      }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/>
          <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
          <line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
        Help
      </button>
    </div>
  );
}