"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { toast } from "sonner";

export default function ResetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [form, setForm] = useState({ newPassword: "", confirmPassword: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.newPassword || form.newPassword.length < 8)
      e.newPassword = "Password must be at least 8 characters.";
    if (!form.confirmPassword)
      e.confirmPassword = "Please confirm your password.";
    else if (form.newPassword !== form.confirmPassword)
      e.confirmPassword = "Passwords do not match.";
    return e;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setErrors((prev) => ({ ...prev, [e.target.name]: "" }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validationErrors = validate();
    if (Object.keys(validationErrors).length) {
      setErrors(validationErrors);
      return;
    }
    setLoading(true);

    const token = searchParams.get("token");

    const { error } = await authClient.resetPassword({
      newPassword: form.newPassword,
      token: token ?? "",
    });

    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Password reset successfully");
      router.push("/login");
    }

    setLoading(false);
  };

  const EyeIcon = ({ open }: { open: boolean }) =>
    open ? (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    ) : (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
        <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
        <line x1="1" y1="1" x2="23" y2="23" />
      </svg>
    );

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

          <div className="text-center">
            <h1 className="mb-1 text-3xl text-gray-900 font-bold">
              Reset Password
            </h1>
            <p className="mb-6 text-sm text-gray-600">
              Enter and confirm your new password below
            </p>
          </div>

          <form onSubmit={handleSubmit} noValidate>

            {/* New Password */}
            <div className="mb-4">
              <label
                htmlFor="newPassword"
                className="mb-1 block text-sm font-semibold text-gray-900"
              >
                New Password
              </label>
              <div className="relative">
                <input
                  id="newPassword"
                  name="newPassword"
                  type={showNew ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="New Password"
                  value={form.newPassword}
                  onChange={handleChange}
                  className={`w-full rounded-lg border px-4 py-3 pr-11 text-sm outline-none transition
                  ${
                    errors.newPassword
                      ? "border-red-500 bg-red-50"
                      : "border-gray-300 focus:border-green-800 focus:ring-2 focus:ring-green-800/20"
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowNew((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  tabIndex={-1}
                >
                          {/* eslint-disable-next-line react-hooks/static-components */}
                  <EyeIcon open={showNew} />
                </button>
              </div>
              {errors.newPassword && (
                <p className="mt-1 text-sm font-medium text-red-600">
                  {errors.newPassword}
                </p>
              )}
            </div>

            {/* Confirm Password */}
            <div className="mb-6">
              <label
                htmlFor="confirmPassword"
                className="mb-1 block text-sm font-semibold text-gray-900"
              >
                Confirm Password
              </label>
              <div className="relative">
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={showConfirm ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="Confirm Password"
                  value={form.confirmPassword}
                  onChange={handleChange}
                  className={`w-full rounded-lg border px-4 py-3 pr-11 text-sm outline-none transition
                  ${
                    errors.confirmPassword
                      ? "border-red-500 bg-red-50"
                      : "border-gray-300 focus:border-green-800 focus:ring-2 focus:ring-green-800/20"
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  tabIndex={-1}
                >
                    
                   {/* eslint-disable-next-line react-hooks/static-components */}
                  <EyeIcon open={showConfirm} />
                </button>
              </div>
              {errors.confirmPassword && (
                <p className="mt-1 text-sm font-medium text-red-600">
                  {errors.confirmPassword}
                </p>
              )}
            </div>

            {/* Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-full bg-[#1a6640] py-4 text-sm font-bold text-white transition hover:bg-[#155534] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Resetting password..." : "Reset Password"}
            </button>
          </form>

          {/* Back to login */}
          <p className="mt-4 text-center text-sm text-gray-500">
            Remember your password?{" "}
            <Link
              href="/login"
              className="font-semibold text-[#1a6640] hover:underline"
            >
              Log in
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