"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import Link from "next/link";
import Image from "next/image";
import { toast } from "sonner";

export default function ForgotPasswordPage() {
  const [form, setForm] = useState({ email: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState("");

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      e.email = "Must be a valid email address.";
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

    const { error } = await authClient.requestPasswordReset({
      email: form.email,
      redirectTo: "/reset-password",
    });

    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Password reset email sent");
    }

    setLoading(false);
  };

  return (
    <div className="relative min-h-screen overflow-hidden">

      {/* Background */}
      <div
        className="absolute inset-0 bg-cover bg-top"
        style={{ backgroundImage: "url('/sign-up.jpg')" }}
      />
      <div className="absolute inset-0 bg-black/15" />

      {/* Center card */}
      <div className="relative z-10 flex min-h-screen items-center justify-center px-4 py-8">
        <div className="w-full max-w-120 rounded-[20px] bg-white px-12 py-11 shadow-[0_20px_60px_rgba(0,0,0,0.2)]">

          {/* Logo */}
          <div className="mb-8 text-center">
            <div className="relative flex items-center justify-center gap-x-3">
              <Link href="/">
                <Image
                  src="/logo.png"
                  alt="logo"
                  width={342}
                  height={63}
                  className="w-28 object-contain"
                />
              </Link>
            </div>
          </div>

          {/* Error */}
          {serverError && (
            <div className="mb-5 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
              {serverError}
            </div>
          )}

          <div className="text-center">
            <h1 className="mb-1 text-3xl text-gray-900 font-bold">
              Set Password
            </h1>
            <p className="mb-6 text-sm text-gray-600">
              Enter your email and we&apos;ll send you instructions to set your password
            </p>
          </div>

          <form onSubmit={handleSubmit} noValidate>

            {/* Email */}
            <div className="mb-4">
              <label
                htmlFor="email"
                className="mb-1 block text-sm font-semibold text-gray-900"
              >
                Email Address
              </label>

              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="Email Address"
                value={form.email}
                onChange={handleChange}
                className={`w-full rounded-lg border px-4 py-3 text-sm outline-none transition 
                ${
                  errors.email
                    ? "border-red-500 bg-red-50"
                    : "border-gray-300 focus:border-green-800 focus:ring-2 focus:ring-green-800/20"
                }`}
              />

              {errors.email && (
                <p className="mt-1 text-sm font-medium text-red-600">
                  {errors.email}
                </p>
              )}
            </div>

            {/* Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-full bg-[#1a6640] py-4 text-sm font-bold text-white transition hover:bg-[#155534] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Setting password..." : "Set Password"}
            </button>
          </form>

          {/* Signup */}
          <p className="mt-4 text-center text-sm text-gray-500">
            Don&apos;t have an account?{" "}
            <Link
              href="/signup"
              className="font-semibold text-[#1a6640] hover:underline"
            >
              Sign up
            </Link>
          </p>
        </div>
      </div>

      {/* Help button */}
      <button className="fixed bottom-6 left-6 z-50 flex items-center gap-2 rounded-full bg-[#1a6640] px-5 py-2.5 text-sm font-semibold text-white shadow-lg hover:bg-[#155534]">
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="10" />
          <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
        Help
      </button>
    </div>
  );
}