"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, ArrowRight, Check, Loader2 } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import {
  getPostProfileCompletionPath,
  isValidBirthday,
  LOCATIONS,
  normalizePhoneNumber,
} from "@/lib/profile-completion";

type Gender = "male" | "female" | "other" | "prefer_not_to_say";
type OnboardingStep = "name" | "gender" | "phone" | "location" | "birthday" | "success";
type Profile = {
  name: string;
  phone: string;
  defaultLocation: string;
  gender: Gender | "";
  birthdayDay: number | null;
  birthdayMonth: number | null;
};

const STEPS: OnboardingStep[] = ["name", "gender", "phone", "location", "birthday"];
const INITIAL_PROFILE: Profile = { name: "", phone: "", defaultLocation: "", gender: "", birthdayDay: null, birthdayMonth: null };
const GENDERS: Array<{ value: Gender; label: string }> = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "other", label: "Other" },
  { value: "prefer_not_to_say", label: "Prefer not to say" },
];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const controlClass = "h-14 w-full rounded-2xl border border-slate-300 bg-white px-4 text-base text-slate-950 outline-none transition focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100";

export function CompleteProfileForm() {
  const router = useRouter();
  const search = useSearchParams();
  const reduceMotion = useReducedMotion();
  const { data: session, isPending } = authClient.useSession();
  const contentRef = useRef<HTMLDivElement>(null);
  const stepRef = useRef<OnboardingStep>("name");
  const [form, setForm] = useState(INITIAL_PROFILE);
  const [step, setStep] = useState<OnboardingStep>("name");
  const [direction, setDirection] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fieldError, setFieldError] = useState("");
  const [serverError, setServerError] = useState("");

  useEffect(() => { stepRef.current = step; }, [step]);

  useEffect(() => {
    if (!isPending && !session?.user) {
      const next = search.get("next");
      router.replace(next ? `/auth?next=${encodeURIComponent(next)}` : "/auth");
    }
  }, [isPending, router, search, session?.user]);

  useEffect(() => {
    if (!session?.user) return;
    let active = true;
    fetch("/api/users/me/profile", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("We couldn't load your profile. Please try again.");
        return response.json();
      })
      .then(({ user }) => {
        if (!active) return;
        setForm({
          name: user.name || "",
          gender: user.gender || "",
          phone: (user.phone || "").replace(/^\+?234/, ""),
          defaultLocation: user.defaultLocation || user.location || "",
          birthdayDay: user.birthdayDay ?? null,
          birthdayMonth: user.birthdayMonth ?? null,
        });
      })
      .catch((error: unknown) => {
        if (active) setServerError(error instanceof Error ? error.message : "We couldn't load your profile.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [session?.user]);

  useEffect(() => {
    if (loading || step === "success") return;
    const frame = requestAnimationFrame(() => {
      const target = contentRef.current?.querySelector<HTMLElement>("input, [role='radio'], select, button");
      target?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [loading, step]);

  useEffect(() => {
    window.history.replaceState({ ...window.history.state, swiftduProfileStep: 0 }, "");
    function handleHistory(event: PopStateEvent) {
      const index = Number(event.state?.swiftduProfileStep);
      if (Number.isInteger(index) && index >= 0 && index < STEPS.length) {
        setDirection(index < STEPS.indexOf(stepRef.current) ? -1 : 1);
        setStep(STEPS[index]);
        setFieldError("");
        setServerError("");
      }
    }
    window.addEventListener("popstate", handleHistory);
    return () => window.removeEventListener("popstate", handleHistory);
  }, []);

  const stepIndex = Math.max(0, STEPS.indexOf(step));
  const requiredProgress = step === "birthday" || step === "success" ? 100 : ((stepIndex + 1) / 4) * 100;

  function update<K extends keyof Profile>(key: K, value: Profile[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setFieldError("");
    setServerError("");
  }

  function validateCurrent() {
    if (step === "name" && !form.name.trim()) return "Enter your full name.";
    if (step === "gender" && !form.gender) return "Choose a gender option.";
    if (step === "phone") {
      const phone = normalizePhoneNumber("+234", form.phone);
      if (!form.phone.trim() || phone.replace(/\D/g, "").length < 10) return "Enter a valid WhatsApp number.";
    }
    if (step === "location" && !form.defaultLocation) return "Choose your default campus location.";
    if (step === "birthday" && !isValidBirthday(form.birthdayDay, form.birthdayMonth)) return "Choose both a valid day and month, or skip for now.";
    return "";
  }

  function next() {
    const message = validateCurrent();
    if (message) { setFieldError(message); return; }
    const index = STEPS.indexOf(step);
    if (index < STEPS.length - 1) {
      setDirection(1);
      setStep(STEPS[index + 1]);
      window.history.pushState({ ...window.history.state, swiftduProfileStep: index + 1 }, "");
      setFieldError("");
    }
  }

  function back() {
    const index = STEPS.indexOf(step);
    if (index <= 0) return;
    window.history.back();
  }

  async function finish(skipBirthday = false) {
    if (!skipBirthday) {
      const message = validateCurrent();
      if (message) { setFieldError(message); return; }
    }
    setSaving(true);
    setFieldError("");
    setServerError("");
    const birthdayDay = skipBirthday ? null : form.birthdayDay;
    const birthdayMonth = skipBirthday ? null : form.birthdayMonth;
    try {
      const response = await fetch("/api/users/me/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          gender: form.gender,
          phone: normalizePhoneNumber("+234", form.phone),
          defaultLocation: form.defaultLocation,
          birthdayDay,
          birthdayMonth,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "We couldn't save your profile. Please try again.");
      await authClient.getSession({ query: { disableCookieCache: true } });
      setDirection(1);
      setStep("success");
      window.setTimeout(() => router.replace(getPostProfileCompletionPath(session?.user, search.get("next"))), reduceMotion ? 500 : 750);
    } catch (error) {
      setServerError(error instanceof Error ? error.message : "We couldn't save your profile. Please try again.");
      setSaving(false);
    }
  }

  if (loading || isPending) return <OnboardingShell progress={8}><div className="flex flex-1 flex-col items-center justify-center" role="status"><div className="h-8 w-8 animate-pulse rounded-full bg-indigo-600"/><p className="mt-4 text-sm text-slate-500">Getting things ready...</p></div></OnboardingShell>;

  return (
    <OnboardingShell progress={requiredProgress}>
      <div ref={contentRef} className="flex min-h-0 flex-1 flex-col" aria-live="polite">
        <AnimatePresence mode="wait" custom={direction} initial={false}>
          <motion.div
            key={step}
            custom={direction}
            variants={{ enter: (value: number) => ({ opacity: 0, x: reduceMotion ? 0 : value * 20 }), center: { opacity: 1, x: 0 }, exit: (value: number) => ({ opacity: 0, x: reduceMotion ? 0 : value * -20 }) }}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: reduceMotion ? 0 : 0.25, ease: "easeOut" }}
            className="flex min-h-0 flex-1 flex-col"
          >
            {step === "success" ? <SuccessState reduceMotion={Boolean(reduceMotion)}/> : (
              <form onSubmit={(event) => {
                event.preventDefault();
                if (step === "birthday") void finish(false);
                else next();
              }} className="flex min-h-0 flex-1 flex-col">
                <div className="flex-1 py-8 sm:py-12">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-600">Let&apos;s get you set up</p>
                  {step === "name" && <NameStep form={form} update={update}/>} 
                  {step === "gender" && <GenderStep form={form} update={update}/>} 
                  {step === "phone" && <PhoneStep form={form} update={update}/>} 
                  {step === "location" && <LocationStep form={form} update={update}/>} 
                  {step === "birthday" && <BirthdayStep form={form} update={update}/>} 
                  <AnimatePresence initial={false}>{fieldError && <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-3 text-sm font-medium text-red-600" role="alert">{fieldError}</motion.p>}</AnimatePresence>
                  {serverError && <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">{serverError}</p>}
                </div>
                <div className="shrink-0 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
                  <div className="flex items-center gap-3">
                    {step !== "name" && <button type="button" onClick={back} disabled={saving} className="inline-flex h-12 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-slate-500 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"><ArrowLeft className="h-4 w-4"/>Back</button>}
                    <button type="submit" disabled={saving} className="ml-auto inline-flex h-13 min-w-40 items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-6 font-semibold text-white shadow-sm transition hover:bg-indigo-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60">
                      {saving ? <><Loader2 className="h-4 w-4 animate-spin"/>Saving...</> : <>{step === "birthday" ? "Finish setup" : "Continue"}<ArrowRight className="h-4 w-4"/></>}
                    </button>
                  </div>
                  {step === "birthday" && <button type="button" onClick={() => void finish(true)} disabled={saving} className="mt-4 w-full py-2 text-sm font-semibold text-slate-500 hover:text-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500">Skip for now</button>}
                </div>
              </form>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </OnboardingShell>
  );
}

function OnboardingShell({ progress, children }: { progress: number; children: React.ReactNode }) {
  return <main className="flex min-h-dvh items-center justify-center overflow-x-hidden bg-slate-50 p-4 sm:p-6"><section className="flex min-h-[calc(100dvh-2rem)] w-full max-w-xl flex-col rounded-3xl bg-white px-5 shadow-sm sm:min-h-[min(720px,calc(100dvh-3rem))] sm:px-10"><header className="shrink-0 pt-6"><div className="flex justify-end"><span className="text-xs font-medium text-slate-400">Profile setup</span></div><div className="mt-4 h-1 overflow-hidden rounded-full bg-slate-100"><motion.div className="h-full rounded-full bg-indigo-600" animate={{ width: `${progress}%` }} transition={{ duration: 0.3, ease: "easeOut" }}/></div></header>{children}</section></main>;
}

function Heading({ title, description }: { title: string; description: string }) { return <div className="mt-4"><h1 className="text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">{title}</h1><p className="mt-3 max-w-md text-sm leading-6 text-slate-500 sm:text-base">{description}</p></div>; }
function NameStep({ form, update }: StepProps) { return <><Heading title="What's your name?" description="Let other Swifters know who they're helping."/><label className="mt-8 block text-sm font-semibold text-slate-700" htmlFor="full-name">Full name</label><input id="full-name" autoComplete="name" value={form.name} onChange={(e) => update("name", e.target.value)} className={`${controlClass} mt-2`} placeholder="Eseosa Osayi"/></>; }
function GenderStep({ form, update }: StepProps) { return <><Heading title="What's your gender?" description="We use this to match you with Taskers according to SwiftDU's same-gender service policy."/><div className="mt-7 space-y-3" role="radiogroup" aria-label="Gender">{GENDERS.map(({ value, label }) => { const selected = form.gender === value; return <button key={value} type="button" role="radio" aria-checked={selected} onClick={() => update("gender", value)} className={`flex min-h-13 w-full items-center justify-between rounded-2xl border px-4 py-3 text-left font-medium transition focus:outline-none focus:ring-4 focus:ring-indigo-100 ${selected ? "border-indigo-600 bg-indigo-50 text-indigo-950" : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"}`}><span>{label}</span><span className={`flex h-6 w-6 items-center justify-center rounded-full border ${selected ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-300"}`}>{selected && <Check className="h-4 w-4"/>}</span></button>; })}</div></>; }
function PhoneStep({ form, update }: StepProps) { return <><Heading title="What's your WhatsApp number?" description="Your Tasker or SwiftDU support may need to reach you about an active order."/><label className="mt-8 block text-sm font-semibold text-slate-700" htmlFor="phone">WhatsApp number</label><div className="mt-2 flex"><span className="flex h-14 items-center rounded-l-2xl border border-r-0 border-slate-300 bg-slate-50 px-4 font-medium text-slate-600">+234</span><input id="phone" autoComplete="tel-national" inputMode="tel" value={form.phone} onChange={(e) => update("phone", e.target.value)} className={`${controlClass} rounded-l-none`} placeholder="801 234 5678"/></div></>; }
function LocationStep({ form, update }: StepProps) { return <><Heading title="Where are you on campus?" description="We'll use this as your default location. You can still choose another location when ordering."/><label className="mt-8 block text-sm font-semibold text-slate-700" htmlFor="location">Default campus location</label><select id="location" value={form.defaultLocation} onChange={(e) => update("defaultLocation", e.target.value)} className={`${controlClass} mt-2`}><option value="">Select hostel / location</option>{LOCATIONS.map((location) => <option key={location} value={location}>{location}</option>)}</select></>; }
function BirthdayStep({ form, update }: StepProps) { return <><Heading title="When's your birthday? 🎂" description="We'd love to celebrate with you. We only need the day and month."/><fieldset className="mt-8"><legend className="text-sm font-semibold text-slate-700">Birthday (optional)</legend><div className="mt-2 grid grid-cols-2 gap-3"><select aria-label="Birthday day" value={form.birthdayDay ?? ""} onChange={(e) => update("birthdayDay", e.target.value ? Number(e.target.value) : null)} className={controlClass}><option value="">Day</option>{Array.from({ length: 31 }, (_, index) => <option key={index + 1} value={index + 1}>{index + 1}</option>)}</select><select aria-label="Birthday month" value={form.birthdayMonth ?? ""} onChange={(e) => update("birthdayMonth", e.target.value ? Number(e.target.value) : null)} className={controlClass}><option value="">Month</option>{MONTHS.map((month, index) => <option key={month} value={index + 1}>{month}</option>)}</select></div></fieldset></>; }
function SuccessState({ reduceMotion }: { reduceMotion: boolean }) { return <div className="flex flex-1 flex-col items-center justify-center pb-20 text-center" role="status"><motion.div initial={{ opacity: 0, scale: reduceMotion ? 1 : 0.85 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: reduceMotion ? 0 : 0.25 }} className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-700"><Check className="h-8 w-8" strokeWidth={2.5}/></motion.div><h1 className="mt-6 text-3xl font-bold text-slate-950">You&apos;re all set.</h1><p className="mt-2 text-slate-500">Welcome to SwiftDU.</p></div>; }

type StepProps = { form: Profile; update: <K extends keyof Profile>(key: K, value: Profile[K]) => void };
