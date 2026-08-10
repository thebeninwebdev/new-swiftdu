"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useCallback, useEffect, useState } from "react";
import { CheckCircle2, Loader2, LockKeyhole, Mail, TriangleAlert } from "lucide-react";
import { toast } from "sonner";

import { authClient } from "@/lib/auth-client";

type OnboardingData = {
  state: "ready";
  applicant: { name: string; email: string };
  account: { exists: boolean; hasCredential: boolean; hasGoogle: boolean };
  session: { authenticated: boolean; matches: boolean; email?: string };
};

function TaskerOnboardingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";
  const [data, setData] = useState<OnboardingData | null>(null);
  const [error, setError] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [completing, setCompleting] = useState(false);

  const completeExisting = useCallback(async () => {
    if (!token || completing) return;
    setCompleting(true);
    setError("");
    try {
      const response = await fetch("/api/tasker-onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "complete-existing", token }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Could not link your account.");
      toast.success("Your SwiftDU account is now connected to Tasker training.");
      router.replace(payload.redirectTo || "/tasker-dashboard");
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not link your account.");
      setCompleting(false);
    }
  }, [completing, router, token]);

  useEffect(() => {
    if (!token) {
      setError("This onboarding link is invalid.");
      return;
    }

    let active = true;
    fetch(`/api/tasker-onboarding?token=${encodeURIComponent(token)}`, {
      cache: "no-store",
    })
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error || "This onboarding link is unavailable.");
        return payload as OnboardingData;
      })
      .then((payload) => {
        if (active) setData(payload);
      })
      .catch((reason) => {
        if (active) setError(reason instanceof Error ? reason.message : "This onboarding link is unavailable.");
      });
    return () => {
      active = false;
    };
  }, [token]);

  useEffect(() => {
    if (data?.session.authenticated && data.session.matches && !completing) {
      void completeExisting();
    }
  }, [completeExisting, completing, data]);

  const signInWithPassword = async (event: FormEvent) => {
    event.preventDefault();
    if (!data) return;
    setBusy(true);
    setError("");
    try {
      const { data: signInData, error: signInError } = await authClient.signIn.email({
        email: data.applicant.email,
        password,
      });
      if (signInError) throw new Error(signInError.message || "Invalid email or password.");
      if (signInData && "twoFactorRedirect" in signInData) {
        sessionStorage.setItem("swiftdu-post-2fa-callback", window.location.href);
        router.push("/verify-2fa");
        return;
      }
      await completeExisting();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Sign in failed.");
    } finally {
      setBusy(false);
    }
  };

  const continueWithGoogle = async () => {
    setBusy(true);
    setError("");
    const callbackURL = `/tasker/onboarding?token=${encodeURIComponent(token)}`;
    const { error: googleError } = await authClient.signIn.social({
      provider: "google",
      callbackURL,
      errorCallbackURL: callbackURL,
    });
    if (googleError) {
      setError(googleError.message || "Google sign in failed.");
      setBusy(false);
    }
  };

  const createAccount = async (event: FormEvent) => {
    event.preventDefault();
    if (!data) return;
    if (password.length < 8) {
      setError("Use at least 8 characters for your password.");
      return;
    }
    if (password !== confirmPassword) {
      setError("The passwords do not match.");
      return;
    }

    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/tasker-onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create-password", token, password }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Could not activate your account.");

      const { error: signInError } = await authClient.signIn.email({
        email: payload.email,
        password,
      });
      if (signInError) {
        toast.success("Your Tasker account is ready. Sign in to continue.");
        router.replace(`/login?callbackUrl=${encodeURIComponent("/tasker-dashboard")}`);
        return;
      }
      toast.success("Welcome to SwiftDU Tasker training.");
      router.replace(payload.redirectTo || "/tasker-dashboard");
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not activate your account.");
    } finally {
      setBusy(false);
    }
  };

  const signOutWrongAccount = async () => {
    setBusy(true);
    await authClient.signOut();
    window.location.reload();
  };

  const loading = !data && !error;
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 px-4 py-10">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(37,99,235,0.28),transparent_48%)]" />
      <section className="relative z-10 w-full max-w-md overflow-hidden rounded-[28px] border border-white/15 bg-white shadow-2xl">
        <div className="border-b border-slate-100 px-6 py-6">
          <Link href="/" className="inline-flex">
            <Image src="/logo.png" alt="SwiftDU" width={132} height={46} className="h-10 w-auto object-contain" />
          </Link>
          <p className="mt-5 text-xs font-bold uppercase tracking-[0.2em] text-blue-600">Tasker onboarding</p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-950">
            {data ? `Welcome, ${data.applicant.name.split(" ")[0]}` : "Connect your SwiftDU account"}
          </h1>
        </div>

        <div className="space-y-5 px-6 py-6">
          {loading && (
            <div className="flex items-center gap-3 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
              <Loader2 className="h-5 w-5 animate-spin text-blue-600" /> Checking your secure link...
            </div>
          )}

          {error && (
            <div className="flex gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-700">
              <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0" /> <span>{error}</span>
            </div>
          )}

          {data && (
            <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
              <Mail className="h-5 w-5 shrink-0 text-slate-400" />
              <span className="truncate">{data.applicant.email}</span>
              <CheckCircle2 className="ml-auto h-5 w-5 shrink-0 text-emerald-600" />
            </div>
          )}

          {data?.session.authenticated && data.session.matches && (
            <div className="flex items-center justify-center gap-2 py-8 text-sm font-medium text-slate-600">
              <Loader2 className="h-5 w-5 animate-spin text-blue-600" /> Connecting your account...
            </div>
          )}

          {data?.session.authenticated && !data.session.matches && (
            <div className="space-y-4">
              <p className="text-sm leading-6 text-slate-600">
                You are signed in as <strong>{data.session.email}</strong>. Sign out and use the account matching this application.
              </p>
              <button onClick={signOutWrongAccount} disabled={busy} className="w-full rounded-full bg-slate-900 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60">
                Sign out and continue
              </button>
            </div>
          )}

          {data && !data.session.authenticated && data.account.exists && data.account.hasCredential && (
            <form onSubmit={signInWithPassword} className="space-y-4">
              <p className="text-sm leading-6 text-slate-600">Your SwiftDU account already exists. Enter your password to connect it to this approved application.</p>
              <label className="block text-sm font-semibold text-slate-700" htmlFor="existing-password">Password</label>
              <div className="relative">
                <LockKeyhole className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input id="existing-password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} className="w-full rounded-2xl border-2 border-slate-200 py-3 pl-11 pr-4 outline-none focus:border-blue-600" required />
              </div>
              <button disabled={busy || completing} className="w-full rounded-full bg-blue-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60">
                {busy || completing ? "Connecting..." : "Sign in and continue"}
              </button>
              {data.account.hasGoogle && <button type="button" onClick={continueWithGoogle} disabled={busy} className="w-full rounded-full border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 disabled:opacity-60">Continue with Google</button>}
            </form>
          )}

          {data && !data.session.authenticated && data.account.exists && !data.account.hasCredential && (
            <div className="space-y-4">
              <p className="text-sm leading-6 text-slate-600">This application matches an existing account without a password. Continue with Google to confirm it is yours.</p>
              {data.account.hasGoogle ? (
                <button onClick={continueWithGoogle} disabled={busy} className="w-full rounded-full bg-white px-4 py-3 text-sm font-semibold text-slate-800 shadow-sm ring-1 ring-slate-200 disabled:opacity-60">
                  {busy ? "Connecting to Google..." : "Continue with Google"}
                </button>
              ) : (
                <Link href={`/login?callbackUrl=${encodeURIComponent(`/tasker/onboarding?token=${token}`)}`} className="block w-full rounded-full bg-blue-600 px-4 py-3 text-center text-sm font-semibold text-white">Sign in to continue</Link>
              )}
            </div>
          )}

          {data && !data.session.authenticated && !data.account.exists && (
            <form onSubmit={createAccount} className="space-y-4">
              <p className="text-sm leading-6 text-slate-600">Your SwiftDU account is ready to activate. Create a password—your approved application already supplies the rest.</p>
              <input type="password" autoComplete="new-password" placeholder="Create a password" value={password} onChange={(event) => setPassword(event.target.value)} className="w-full rounded-2xl border-2 border-slate-200 px-4 py-3 outline-none focus:border-blue-600" required />
              <input type="password" autoComplete="new-password" placeholder="Confirm password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className="w-full rounded-2xl border-2 border-slate-200 px-4 py-3 outline-none focus:border-blue-600" required />
              <p className="text-xs leading-5 text-slate-500">This password is passed directly to Better Auth and is never stored by the Tasker application.</p>
              <button disabled={busy} className="w-full rounded-full bg-blue-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60">
                {busy ? "Activating..." : "Create password and continue"}
              </button>
            </form>
          )}

          {!loading && !data && (
            <Link href="/" className="block text-center text-sm font-semibold text-blue-700">Return to SwiftDU</Link>
          )}
        </div>
      </section>
    </main>
  );
}

export default function TaskerOnboardingPage() {
  return (
    <Suspense fallback={<main className="flex min-h-screen items-center justify-center bg-slate-950 text-white">Loading onboarding...</main>}>
      <TaskerOnboardingContent />
    </Suspense>
  );
}
