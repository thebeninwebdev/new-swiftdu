"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import Link from "next/link";
import Image from "next/image";
import { toast } from "sonner";
import { Eye, EyeOff, Loader2, ChevronDown, Mail, MapPin } from "lucide-react";

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

const LOCATIONS = [
  { value: "", label: "Select your hostel / location", disabled: true },
  { value: "Amnesty", label: "Amnesty" },
  { value: "Girls Hostel", label: "Girls Hostel" },
  { value: "Law Hall", label: "Law Hall" },
  { value: "Staff Quarters", label: "Staff Quarters" },
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
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.firstName.trim()) e.firstName = "First name is required";
    if (!form.lastName.trim()) e.lastName = "Last name is required";
    if (!form.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      e.email = "Please enter a valid email address";
    if (!form.phone.trim()) e.phone = "Phone number is required";
    if (!form.location) e.location = "Please select your location";
    if (!form.password || form.password.length < 8)
      e.password = "Password must be at least 8 characters";
    if (form.password !== form.confirmPassword)
      e.confirmPassword = "Passwords do not match";
    return e;
  };

  const validateField = (name: keyof typeof form, value: string) => {
    const e: Record<string, string> = {};
    switch (name) {
      case "firstName":
        if (!value.trim()) e.firstName = "First name is required";
        break;
      case "lastName":
        if (!value.trim()) e.lastName = "Last name is required";
        break;
      case "email":
        if (!value || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))
          e.email = "Please enter a valid email address";
        break;
      case "phone":
        if (!value.trim()) e.phone = "Phone number is required";
        break;
      case "location":
        if (!value) e.location = "Please select your location";
        break;
      case "password":
        if (!value || value.length < 8)
          e.password = "Password must be at least 8 characters";
        if (form.confirmPassword && value !== form.confirmPassword)
          e.confirmPassword = "Passwords do not match";
        break;
      case "confirmPassword":
        if (value !== form.password)
          e.confirmPassword = "Passwords do not match";
        break;
    }
    return e;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    
    if (touched[name]) {
      const fieldErrors = validateField(name as keyof typeof form, value);
      setErrors((prev) => ({ ...prev, ...fieldErrors }));
      if (!fieldErrors[name]) {
        setErrors((prev) => {
          const newErrors = { ...prev };
          delete newErrors[name];
          return newErrors;
        });
      }
    }
    setServerError("");
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setTouched((prev) => ({ ...prev, [name]: true }));
    const fieldErrors = validateField(name as keyof typeof form, value);
    setErrors((prev) => ({ ...prev, ...fieldErrors }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const allTouched = Object.keys(form).reduce((acc, key) => ({ ...acc, [key]: true }), {});
    setTouched(allTouched);
    
    const validationErrors = validate();
    if (Object.keys(validationErrors).length) {
      setErrors(validationErrors);
      return;
    }
    
    setLoading(true);
    try {
      const normalizedEmail = form.email.trim().toLowerCase();
      const { error: signUpError } = await authClient.signUp.email({
        name: `${form.firstName} ${form.lastName}`,
        email: normalizedEmail,
        password: form.password,
        phone: `${countryDial.dial}${form.phone}`,
        location: form.location,
      });

      if (signUpError) {
        throw signUpError;
      }

      const { error: verificationError } = await authClient.sendVerificationEmail({
        email: normalizedEmail,
      });

      if (verificationError) {
        const message =
          "Your account was created, but we couldn't send the verification email right now. Please try signing up again with the same email in a moment to resend it.";
        setServerError(message);
        toast.error("Account created, but email delivery failed", {
          description: "We couldn't send your verification link right now.",
        });
        return;
      }
      
      toast.success("Verify your email", {
        description: "We sent a verification link to your email.",
        action: {
          label: "Open Gmail",
          onClick: () => window.open("https://mail.google.com", "_blank"),
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
      setTouched({});
    } catch (err: unknown) {
      setServerError(
        err instanceof Error
          ? err.message
          : "Something went wrong. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  const inputClasses = (error?: string, isSelect = false) => `
    w-full px-4 py-3 text-sm sm:text-base
    border-2 rounded-xl transition-all duration-200 ease-out
    focus:outline-none focus:ring-4 focus:ring-opacity-20
    ${error 
      ? "border-red-400 bg-red-50/50 focus:border-red-500 focus:ring-red-500" 
      : "border-gray-200 focus:border-indigo-600 focus:ring-indigo-600 hover:border-indigo-300"
    }
    ${isSelect ? "appearance-none cursor-pointer bg-white" : "bg-white"}
    placeholder:text-gray-400 text-gray-900
  `;

  return (
    <div className="min-h-screen relative flex items-center justify-center p-3 sm:p-4 lg:p-6">
      {/* Background Image */}
      <div className="absolute inset-0 z-0">
        <Image
          src="/sign-up.jpg"
          alt="Background"
          fill
          className="object-cover object-center"
          priority
        />
        <div className="absolute inset-0 bg-black/70" />
      </div>

      {/* Main Card - No Header/Footer */}
      <div className="relative z-10 w-full max-w-md overflow-hidden rounded-2xl border border-white/60 bg-white/92 backdrop-blur-xl shadow-[0_24px_80px_rgba(79,70,229,0.18)] sm:rounded-3xl">
        {/* Logo Only - No Header Section */}
        <div className="px-6 sm:px-8 pt-6 sm:pt-8 pb-2 flex justify-center">
          <Link href="/" className="inline-block hover:opacity-80 transition-opacity">
            <Image 
              src="/logo.png" 
              alt="SwiftDU" 
              width={140} 
              height={50} 
              className="object-contain h-12 w-auto"
            />
          </Link>
        </div>

        {/* Form Content */}
        <div className="px-5 sm:px-8 py-4 sm:py-6">
          {/* Server Error */}
          {serverError && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 flex items-start gap-2 animate-in slide-in-from-top-2">
              <div className="w-4 h-4 rounded-full bg-red-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-white text-[10px]">!</span>
              </div>
              <p className="text-xs sm:text-sm text-red-700">{serverError}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            {/* Name Row */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <input
                  id="firstName"
                  name="firstName"
                  type="text"
                  autoComplete="given-name"
                  placeholder="First Name"
                  value={form.firstName}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  className={inputClasses(errors.firstName)}
                />
                {errors.firstName && (
                  <p className="text-[10px] sm:text-xs text-red-600">{errors.firstName}</p>
                )}
              </div>

              <div className="space-y-1">
                <input
                  id="lastName"
                  name="lastName"
                  type="text"
                  autoComplete="family-name"
                  placeholder="Last Name"
                  value={form.lastName}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  className={inputClasses(errors.lastName)}
                />
                {errors.lastName && (
                  <p className="text-[10px] sm:text-xs text-red-600">{errors.lastName}</p>
                )}
              </div>
            </div>

            {/* Email */}
            <div className="space-y-1">
              <div className="relative">
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder="Email Address"
                  value={form.email}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  className={inputClasses(errors.email)}
                />
                <Mail className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-gray-400 pointer-events-none" />
              </div>
              {errors.email && (
                <p className="text-[10px] sm:text-xs text-red-600">{errors.email}</p>
              )}
            </div>

            {/* Phone */}
            <div className="space-y-1">
              <div className="flex gap-2">
                <div className="relative flex-shrink-0">
                  <select
                    value={countryDial.code}
                    onChange={(e) => {
                      const found = COUNTRY_CODES.find((c) => c.code === e.target.value);
                      if (found) setCountryDial(found);
                    }}
                    className={`${inputClasses(undefined, true)} w-[85px] sm:w-[100px] pr-6 text-center text-xs sm:text-sm`}
                  >
                    {COUNTRY_CODES.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.flag} {c.dial}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 sm:w-4 sm:h-4 text-gray-500 pointer-events-none" />
                </div>
                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  autoComplete="tel"
                  placeholder="Phone Number"
                  value={form.phone}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  className={inputClasses(errors.phone)}
                />
              </div>
              {errors.phone && (
                <p className="text-[10px] sm:text-xs text-red-600">{errors.phone}</p>
              )}
            </div>

            {/* Location */}
            <div className="space-y-1">
              <div className="relative">
                <select
                  id="location"
                  name="location"
                  value={form.location}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  className={inputClasses(errors.location, true)}
                >
                  {LOCATIONS.map((loc) => (
                    <option key={loc.value} value={loc.value} disabled={loc.disabled}>
                      {loc.label}
                    </option>
                  ))}
                </select>
                <MapPin className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-gray-400 pointer-events-none" />
              </div>
              {errors.location && (
                <p className="text-[10px] sm:text-xs text-red-600">{errors.location}</p>
              )}
            </div>

            {/* Password Row - Responsive: stacked on mobile, side-by-side on sm+ */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <div className="relative">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    placeholder="Password"
                    value={form.password}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    className={inputClasses(errors.password)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors p-1"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-[10px] sm:text-xs text-red-600">{errors.password}</p>
                )}
              </div>

              <div className="space-y-1">
                <div className="relative">
                  <input
                    id="confirmPassword"
                    name="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    autoComplete="new-password"
                    placeholder="Confirm Password"
                    value={form.confirmPassword}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    className={inputClasses(errors.confirmPassword)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors p-1"
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {errors.confirmPassword && (
                  <p className="text-[10px] sm:text-xs text-red-600">{errors.confirmPassword}</p>
                )}
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-full bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-200 transition-all duration-200 ease-out hover:-translate-y-0.5 hover:bg-indigo-700 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-60 sm:text-base"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
                  <span>Creating account...</span>
                </>
              ) : (
                <span>Create Account</span>
              )}
            </button>

            {/* Login Link - Compact */}
            <p className="text-center text-xs sm:text-sm text-gray-600 pt-2">
              Already have an account?{" "}
              <Link 
                href="/login" 
                className="font-semibold text-indigo-600 transition-colors hover:text-purple-600"
              >
                Log in
              </Link>
            </p>
          </form>
        </div>
      </div>

      {/* Help Button */}
      <button className="fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-full border-none bg-linear-to-r from-indigo-600 to-purple-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-900/20 transition-all hover:scale-105 hover:from-indigo-700 hover:to-purple-700">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/>
          <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
          <line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
        Help
      </button>
    </div>
  );
}
