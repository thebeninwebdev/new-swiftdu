"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, Mail, CheckCircle2 } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { buildAuthCallbackPaths, buildAuthContinuationPath } from "@/lib/auth-continuation-paths";
import { getSafeContinuationReference } from "@/lib/auth-continuation-reference";
import { buildCompleteProfilePath, getPostAuthRedirect, getSafeNextPath, isProfileComplete } from "@/lib/profile-completion";
import { getAuthSessionState } from "@/lib/auth-session-state";

const COOLDOWN = 60;

export function AuthEntry() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, isPending: sessionPending, error: sessionError, refetch: refetchSession } = authClient.useSession();
  const sessionState = getAuthSessionState({ hasUser: Boolean(session?.user), isPending: sessionPending, error: sessionError });
  const [email, setEmail] = useState("");
  const [sentTo, setSentTo] = useState("");
  const [emailMethod, setEmailMethod] = useState<"magic" | "otp">("magic");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState(() => getAuthErrorMessage(searchParams));
  const [seconds, setSeconds] = useState(0);
  const requestedPath = getSafeNextPath(searchParams.get("next") ?? searchParams.get("callbackUrl") ?? searchParams.get("callbackURL") ?? searchParams.get("redirect"));
  const incomingContinuation = getSafeContinuationReference(searchParams.get("continuation"));
  const [continuationReference, setContinuationReference] = useState(incomingContinuation);
  const [resettingLogin, setResettingLogin] = useState(false);

  useEffect(() => {
    if (sessionState === "authenticated" && session?.user) {
      if (!isProfileComplete(session.user)) {
        router.replace(continuationReference
          ? buildAuthContinuationPath(continuationReference, { newUser: true })
          : buildCompleteProfilePath(requestedPath));
        return;
      }
      router.replace(continuationReference
        ? buildAuthContinuationPath(continuationReference)
        : getPostAuthRedirect(session.user, requestedPath));
    }
  }, [continuationReference, requestedPath, router, session?.user, sessionState]);

  useEffect(() => {
    if (seconds <= 0) return;

    const timer = window.setInterval(() => {
      setSeconds((value) => Math.max(0, value - 1));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [seconds]);

  async function ensureContinuation() {
    if (continuationReference || !requestedPath) return continuationReference;

    const response = await fetch("/api/auth/continuation", {
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ next: requestedPath }),
    });
    const payload = await response.json().catch(() => ({})) as { reference?: string };
    const reference = getSafeContinuationReference(payload.reference);
    if (!response.ok || !reference) {
      throw new Error("We couldn't prepare that sign-in destination. Please try again.");
    }

    setContinuationReference(reference);
    return reference;
  }

  async function sendLink(event?: FormEvent) {
    event?.preventDefault();

    const normalized = email.trim().toLowerCase();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
      setError("Enter a valid email address.");
      return;
    }

    setLoading(true);
    setError("");

    let authError;
    try {
      const callbacks = buildAuthCallbackPaths(await ensureContinuation(), {
        magicLink: true,
      });
      ({ error: authError } = await authClient.signIn.magicLink({
        email: normalized,
        ...callbacks,
      }));
    } catch (requestError) {
      authError = {
        message: requestError instanceof Error
          ? requestError.message
          : "We could not send the link.",
      };
    }

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


  async function sendCode(event?: FormEvent) {
    event?.preventDefault();
    const normalized = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
      setError("Enter a valid email address.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await ensureContinuation();
    } catch (requestError) {
      setLoading(false);
      setError(requestError instanceof Error ? requestError.message : "We could not prepare sign-in.");
      return;
    }
    const { error: authError } = await authClient.emailOtp.sendVerificationOtp({
      email: normalized,
      type: "sign-in",
    });
    setLoading(false);
    if (authError) {
      setError(authError.message || "We could not send the code. Please try again.");
      return;
    }
    setEmailMethod("otp");
    setSentTo(normalized);
    setSeconds(COOLDOWN);
  }

  async function verifyCode(event: FormEvent) {
    event.preventDefault();
    const code = otp.replace(/\D/g, "");
    if (code.length !== 6) {
      setError("Enter the 6-digit code from your email.");
      return;
    }
    setLoading(true);
    setError("");
    const { data, error: authError } = await authClient.signIn.emailOtp({
      email: sentTo,
      otp: code,
    });
    if (authError) {
      setLoading(false);
      setError(authError.code === "OTP_EXPIRED"
        ? "That code has expired. Request a new code below."
        : authError.code === "TOO_MANY_ATTEMPTS"
          ? "Too many incorrect attempts. Request a new code."
          : "That code is invalid or has already been used.");
      return;
    }
    const callbacks = buildAuthCallbackPaths(continuationReference);
    window.location.replace(data?.user && !isProfileComplete(data.user)
      ? callbacks.newUserCallbackURL
      : callbacks.callbackURL);
  }
  
async function resetSwiftDULogin() {
  setResettingLogin(true);

  try {
    const response = await fetch("/api/auth/recover", {
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error("Recovery failed");
    }

    window.location.replace("/auth");
  } catch {
    setError(
      "Unable to reset sign-in. Please try again."
    );
    setResettingLogin(false);
  }
}

  async function google() {
    setGoogleLoading(true);
    setError("");

    let authError;
    try {
      const callbacks = buildAuthCallbackPaths(await ensureContinuation());
      ({ error: authError } = await authClient.signIn.social({
        provider: "google",
        ...callbacks,
      }));
    } catch (requestError) {
      authError = {
        message: requestError instanceof Error
          ? requestError.message
          : "Google sign-in failed.",
      };
    }

    if (authError) {
      setError(authError.message || "Google sign-in failed.");
      setGoogleLoading(false);
    }
  }

  if (sessionState === "loading" || sessionState === "authenticated") {
    return <main className="flex min-h-screen items-center justify-center bg-[#f6f7fb]"><Loader2 className="h-7 w-7 animate-spin text-indigo-600" aria-label="Loading" /></main>;
  }

  if (sessionState === "unavailable") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f6f7fb] px-4">
        <div className="w-full max-w-md rounded-2xl border border-amber-200 bg-white p-6 text-center shadow-sm">
          <h1 className="text-xl font-bold text-slate-950">We couldn&apos;t verify your sign-in</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">Your session may still be active. Check your connection and try again; you have not been signed out.</p>
          <button type="button" onClick={() => void refetchSession()} className="mt-5 h-12 w-full rounded-xl bg-indigo-600 px-4 font-semibold text-white hover:bg-indigo-700">Try again</button>
        </div>
      </main>
    );
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
                  src="/logo.png?v=swiftdu-symbol-v1"
                  alt="SwiftDU"
                  width={512}
                  height={512}
                  className="h-11 w-auto object-contain"
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
                        src="/logo.png?v=swiftdu-symbol-v1"
                        alt="SwiftDU"
                        width={512}
                        height={512}
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

                  <form onSubmit={emailMethod === "otp" ? sendCode : sendLink} className="mt-8">
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
                      {emailMethod === "otp" ? "Email me a sign-in code" : "Email me a sign-in link"}
                    </button>
                  </form>

                  <button
                    type="button"
                    onClick={() => { setEmailMethod((value) => value === "otp" ? "magic" : "otp"); setError(""); }}
                    className="mt-4 w-full text-center text-sm font-semibold text-indigo-700 underline underline-offset-4"
                  >
                    {emailMethod === "otp" ? "Use a secure email link instead" : "Use a one-time code in this browser"}
                  </button>
                  {emailMethod === "otp" && (
                    <p className="mt-3 text-center text-xs leading-5 text-slate-500">
                      Best for Telegram, Safari, or an installed app: enter the code in this same browser.
                    </p>
                  )}

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
                    
<button
  type="button"
  onClick={() => void resetSwiftDULogin()}
  disabled={resettingLogin}
  className="mt-4 w-full text-center text-sm font-medium text-indigo-600 underline underline-offset-4 disabled:opacity-50"
>
  {resettingLogin
    ? "Resetting sign-in..."
    : "Having trouble signing in? Reset SwiftDU login"}
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
                    {emailMethod === "otp" ? "Enter your sign-in code" : "Check your email"}
                  </h1>

                  <p className="mt-4 text-base leading-7 text-slate-500">
                    We sent {emailMethod === "otp" ? "a 6-digit code" : "a secure sign-in link"} to
                  </p>

                  <p className="mt-1 break-all font-semibold text-slate-900">
                    {sentTo}
                  </p>

                  <p className="mt-4 text-sm leading-6 text-slate-500">
                    {emailMethod === "otp"
                      ? "Return here and enter the code below. It expires in 5 minutes."
                      : "Open the link to continue. If your email app opens another browser, use a one-time code here instead."}
                  </p>

                  {emailMethod === "otp" && (
                    <form onSubmit={verifyCode} className="mt-6">
                      <label htmlFor="otp" className="mb-2 block text-sm font-semibold text-slate-700">One-time code</label>
                      <input
                        id="otp"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        maxLength={6}
                        value={otp}
                        onChange={(event) => { setOtp(event.target.value.replace(/\D/g, "").slice(0, 6)); setError(""); }}
                        className="h-14 w-full rounded-xl border border-slate-300 px-4 text-center text-2xl font-semibold tracking-[0.35em] text-slate-900 outline-none focus:border-indigo-600 focus:ring-4 focus:ring-indigo-600/10"
                      />
                      <button type="submit" disabled={loading} className="mt-4 flex h-14 w-full items-center justify-center rounded-xl bg-indigo-600 px-5 font-semibold text-white disabled:opacity-50">
                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Sign in with code
                      </button>
                    </form>
                  )}

                  {error && (
                    <div className="mt-6 rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">
                      {error}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => void (emailMethod === "otp" ? sendCode() : sendLink())}
                    disabled={loading || seconds > 0}
                    className="mt-8 flex h-14 w-full items-center justify-center rounded-xl bg-indigo-600 px-5 font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Sending...
                      </>
                    ) : seconds > 0 ? (
                      `Resend ${emailMethod === "otp" ? "code" : "link"} in ${seconds}s`
                    ) : (
                      emailMethod === "otp" ? "Resend code" : "Resend link"
                    )}
                  </button>

                  {emailMethod === "magic" && (
                    <button
                      type="button"
                      onClick={() => { setSentTo(""); setEmailMethod("otp"); setError(""); setSeconds(0); }}
                      className="mt-5 block text-sm font-semibold text-indigo-600 transition hover:text-indigo-700"
                    >
                      Use a code in this browser instead
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setSentTo("");
                      setOtp("");
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

function getAuthErrorMessage(searchParams: { get(name: string): string | null; has(name: string): boolean }) {
  if (!searchParams.has("magicLinkError") && !searchParams.has("error")) return "";
  const code = searchParams.get("error") || searchParams.get("magicLinkError") || "";
  if (/expired/i.test(code)) return "That sign-in link has expired. Request a new link or use a one-time code below.";
  if (/used|invalid|token/i.test(code)) return "That sign-in link is invalid or has already been used. Request a new one or use a one-time code.";
  return "We could not complete sign-in. Request a new link or use a one-time code in this browser.";
}
