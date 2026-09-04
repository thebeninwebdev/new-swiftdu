"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, Mail, CheckCircle2 } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { buildCompleteProfilePath, getPostAuthRedirect, getSafeNextPath } from "@/lib/profile-completion";

const COOLDOWN = 60;

export function AuthEntry() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, isPending: sessionPending } = authClient.useSession();
  const [email, setEmail] = useState("");
  const [sentTo, setSentTo] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState(() =>
    searchParams.has("magicLinkError") || searchParams.has("error")
      ? "We could not complete authentication. Please try again."
      : ""
  );
  const [seconds, setSeconds] = useState(0);
  const requestedPath = getSafeNextPath(searchParams.get("next") ?? searchParams.get("callbackUrl") ?? searchParams.get("callbackURL") ?? searchParams.get("redirect"));
  const callbackURL = buildAuthContinuePath(requestedPath);
  const newUserCallbackURL = buildCompleteProfilePath(requestedPath);

  useEffect(() => {
    if (!sessionPending && session?.user) router.replace(getPostAuthRedirect(session.user, requestedPath));
  }, [requestedPath, router, session?.user, sessionPending]);

  useEffect(() => {
    if (seconds <= 0) return;

    const timer = window.setInterval(() => {
      setSeconds((value) => Math.max(0, value - 1));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [seconds]);

  async function sendLink(event?: FormEvent) {
    event?.preventDefault();

    const normalized = email.trim().toLowerCase();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
      setError("Enter a valid email address.");
      return;
    }

    setLoading(true);
    setError("");

    const { error: authError } = await authClient.signIn.magicLink({
      email: normalized,
      callbackURL,
      newUserCallbackURL,
      errorCallbackURL: buildAuthErrorPath(requestedPath, true),
    });

    setLoading(false);

    if (authError) {
      setError(
        authError.message || "We could not send the link. Please try again."
      );
      return;
    }

    setSentTo(normalized);
    setSeconds(COOLDOWN);
  }

  async function google() {
    setGoogleLoading(true);
    setError("");

    const { error: authError } = await authClient.signIn.social({
      provider: "google",
      callbackURL,
      newUserCallbackURL,
      errorCallbackURL: buildAuthErrorPath(requestedPath),
    });

    if (authError) {
      setError(authError.message || "Google sign-in failed.");
      setGoogleLoading(false);
    }
  }

  if (sessionPending || session?.user) {
    return <main className="flex min-h-screen items-center justify-center bg-[#f6f7fb]"><Loader2 className="h-7 w-7 animate-spin text-indigo-600" aria-label="Loading" /></main>;
  }

  return (
    <main className="min-h-screen bg-[#f6f7fb] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-6xl items-center justify-center">
        <div className="grid w-full overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_30px_80px_rgba(15,23,42,0.12)] lg:grid-cols-2">
          {/* IMAGE PANEL */}
          <section className="relative hidden min-h-[720px] overflow-hidden lg:block">
            <div
              role="img"
              aria-label="SwiftDU community"
              className="absolute inset-0 bg-cover bg-center"
              style={{ backgroundImage: "url('/sign-up.png')" }}
            />

            <div className="absolute inset-0 bg-gradient-to-br from-[#4f2bd6]/90 via-[#6b46e8]/78 to-[#8b5cf6]/65" />
            <div className="absolute inset-0 bg-black/15" />

            <div className="relative z-10 flex h-full flex-col justify-between p-10 xl:p-12">
              <Link href="/" className="inline-flex w-fit">
                <Image
                  src="/logo.png?v=20260826"
                  alt="SwiftDU"
                  width={150}
                  height={48}
                  className="h-11 w-auto object-contain brightness-0 invert"
                />
              </Link>

              <div className="max-w-md mb-16">

                <h2 className="text-5xl font-semibold leading-tight text-white xl:text-5xl">
                  Join the campus community that gets things done.
                </h2>

                <div className="mt-8 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm text-white/90 backdrop-blur">
                  <CheckCircle2 className="h-4 w-4" />
                  Fast, simple and secure
                </div>
              </div>
            </div>
          </section>

          {/* AUTH PANEL */}
          <section className="flex min-h-[720px] items-center bg-white px-6 py-10 sm:px-10 lg:px-12 xl:px-16">
            <div className="mx-auto w-full max-w-md">
              {!sentTo ? (
                <>
                  <div>
                    <Link href="/" className="inline-flex lg:hidden">
                      <Image
                        src="/logo.png?v=20260826"
                        alt="SwiftDU"
                        width={150}
                        height={54}
                        className="h-11 w-auto object-contain"
                      />
                    </Link>

                    <h1 className="sr-only lg:not-sr-only lg:mt-4 lg:text-3xl lg:font-bold lg:tracking-tight lg:text-slate-950 xl:text-4xl">
                      Continue to SwiftDU
                    </h1>

                    <p className="mt-3 text-sm leading-6 text-slate-500 sm:text-base">
                      Welcome back, Swifter.
                    </p>
                  </div>

                  <form onSubmit={sendLink} className="mt-8">
                    <label
                      htmlFor="email"
                      className="mb-2.5 block text-sm font-semibold text-slate-700"
                    >
                      Email address
                    </label>

                    <div className="relative">
                      <input
                        id="email"
                        type="email"
                        autoComplete="email"
                        value={email}
                        onChange={(event) => {
                          setEmail(event.target.value);
                          setError("");
                        }}
                        placeholder="student@email.com"
                        className="h-14 w-full rounded-xl border border-slate-300 bg-white px-4 pr-12 text-[15px] text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-600 focus:ring-4 focus:ring-indigo-600/10"
                      />
                      <Mail className="absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                    </div>

                    {error && (
                      <div className="mt-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
                        {error}
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={loading || googleLoading}
                      className="mt-6 flex h-14 w-full items-center justify-center rounded-xl bg-indigo-600 px-5 font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {loading && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      Continue with email
                    </button>
                  </form>

                  <div className="my-6 flex items-center gap-4">
                    <div className="h-px flex-1 bg-slate-200" />
                    <span className="text-xs font-medium uppercase tracking-[0.16em] text-slate-400">
                      or
                    </span>
                    <div className="h-px flex-1 bg-slate-200" />
                  </div>

                  <button
                    type="button"
                    onClick={google}
                    disabled={loading || googleLoading}
                    className="flex h-14 w-full items-center justify-center gap-3 rounded-xl border border-slate-300 bg-white px-5 font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {googleLoading ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <GoogleIcon />
                    )}
                    Continue with Google
                  </button>

                  <p className="mt-8 text-sm leading-6 text-slate-500">
                    By continuing, you agree to SwiftDU&apos;s{" "}
                    <Link
                      href="/terms"
                      className="font-medium text-slate-800 underline underline-offset-2"
                    >
                      Terms
                    </Link>{" "}
                    and{" "}
                    <Link
                      href="/privacy"
                      className="font-medium text-slate-800 underline underline-offset-2"
                    >
                      Privacy Policy
                    </Link>
                    .
                  </p>
                </>
              ) : (
                <div>
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
                    <Mail className="h-6 w-6" />
                  </div>

                  <h1 className="mt-6 text-3xl font-bold tracking-tight text-slate-950">
                    Check your email
                  </h1>

                  <p className="mt-4 text-base leading-7 text-slate-500">
                    We sent a secure sign-in link to
                  </p>

                  <p className="mt-1 break-all font-semibold text-slate-900">
                    {sentTo}
                  </p>

                  <p className="mt-4 text-sm leading-6 text-slate-500">
                    Open the link to continue to SwiftDU.
                  </p>

                  {error && (
                    <div className="mt-6 rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">
                      {error}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => void sendLink()}
                    disabled={loading || seconds > 0}
                    className="mt-8 flex h-14 w-full items-center justify-center rounded-xl bg-indigo-600 px-5 font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Sending...
                      </>
                    ) : seconds > 0 ? (
                      `Resend link in ${seconds}s`
                    ) : (
                      "Resend link"
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setSentTo("");
                      setError("");
                      setSeconds(0);
                    }}
                    className="mt-5 text-sm font-semibold text-indigo-600 transition hover:text-indigo-700"
                  >
                    Use a different email
                  </button>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

function buildAuthErrorPath(nextPath: string | null, magicLinkError = false) {
  const params = new URLSearchParams();
  if (nextPath) params.set("next", nextPath);
  if (magicLinkError) params.set("magicLinkError", "true");
  const query = params.toString();
  return query ? `/auth?${query}` : "/auth";
}

function buildAuthContinuePath(nextPath: string | null) {
  return nextPath ? `/auth/continue?next=${encodeURIComponent(nextPath)}` : "/auth/continue";
}

function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M21.6 12.23c0-.71-.06-1.4-.18-2.07H12v3.91h5.38a4.6 4.6 0 0 1-2 3.02v2.52h3.24c1.9-1.75 2.98-4.33 2.98-7.38Z"
      />
      <path
        fill="#34A853"
        d="M12 22c2.7 0 4.97-.9 6.63-2.43l-3.24-2.52c-.9.6-2.05.96-3.39.96-2.61 0-4.82-1.76-5.61-4.13H3.05v2.6A10 10 0 0 0 12 22Z"
      />
      <path
        fill="#FBBC05"
        d="M6.39 13.88A6.02 6.02 0 0 1 6.08 12c0-.65.11-1.28.31-1.88v-2.6H3.05A10 10 0 0 0 2 12c0 1.61.39 3.13 1.05 4.48l3.34-2.6Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.99c1.47 0 2.79.5 3.83 1.5l2.87-2.87A9.62 9.62 0 0 0 12 2a10 10 0 0 0-8.95 5.52l3.34 2.6C7.18 7.75 9.39 5.99 12 5.99Z"
      />
    </svg>
  );
}
