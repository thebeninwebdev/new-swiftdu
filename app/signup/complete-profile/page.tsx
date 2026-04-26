"use client";

import { Suspense, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronDown, Loader2, Mail, MapPin, Phone } from "lucide-react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import {
  COUNTRY_CODES,
  DEFAULT_COUNTRY_CODE,
  LOCATIONS,
  type RequiredProfileField,
  getMissingRequiredProfileFields,
  getPostProfileCompletionPath,
  normalizePhoneNumber,
} from "@/lib/profile-completion";

type CompletionForm = {
  name: string;
  phone: string;
  location: string;
};

const STEP_COPY: Record<
  RequiredProfileField,
  {
    badge: string;
    title: string;
    description: string;
  }
> = {
  name: {
    badge: "Step 1",
    title: "What should we call you?",
    description:
      "Google did not send your full name, so we need it before we finish your account.",
  },
  phone: {
    badge: "Phone number",
    title: "Where can runners reach you?",
    description:
      "We already got your email from Google. Your phone number helps with delivery updates and support.",
  },
  location: {
    badge: "Location",
    title: "Which hostel or location are you in?",
    description:
      "We use this to match you faster and keep the experience local for campus users.",
  },
};

function CompleteProfilePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, isPending } = authClient.useSession();
  const user = session?.user;
  const nextPath = searchParams.get("next");

  const [currentStep, setCurrentStep] = useState(0);
  const [countryDial, setCountryDial] = useState(DEFAULT_COUNTRY_CODE);
  const [form, setForm] = useState<CompletionForm>({
    name: "",
    phone: "",
    location: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  const missingFields = getMissingRequiredProfileFields(user);
  const steps = missingFields.map((field) => ({
    field,
    ...STEP_COPY[field],
  }));
  const activeStep = steps[currentStep];
  const destination = getPostProfileCompletionPath(user, nextPath);

  useEffect(() => {
    if (user) {
      setForm((previous) => ({
        name: previous.name || user.name || "",
        phone: previous.phone,
        location: previous.location || user.location || "",
      }));
    }
  }, [user]);

  useEffect(() => {
    if (!isPending && !user) {
      router.replace("/login");
    }
  }, [isPending, router, user]);

  useEffect(() => {
    if (!user) {
      return;
    }

    if (missingFields.length === 0) {
      router.replace(destination);
    }
  }, [destination, missingFields.length, router, user]);

  useEffect(() => {
    if (currentStep > Math.max(steps.length - 1, 0)) {
      setCurrentStep(Math.max(steps.length - 1, 0));
    }
  }, [currentStep, steps.length]);

  const validateStep = (field: RequiredProfileField) => {
    switch (field) {
      case "name":
        if (!form.name.trim()) {
          return "Please enter your full name";
        }
        return "";
      case "phone":
        if (!form.phone.trim()) {
          return "Please enter your phone number";
        }

        if (normalizePhoneNumber(countryDial.dial, form.phone).length < 8) {
          return "Please enter a valid phone number";
        }

        return "";
      case "location":
        if (!form.location) {
          return "Please select your hostel or location";
        }
        return "";
      default:
        return "";
    }
  };

  const handleChange = (
    event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = event.target;

    setForm((previous) => ({ ...previous, [name]: value }));
    setServerError("");

    if (errors[name]) {
      setErrors((previous) => {
        const nextErrors = { ...previous };
        delete nextErrors[name];
        return nextErrors;
      });
    }
  };

  const handleContinue = async () => {
    if (!activeStep) {
      return;
    }

    const message = validateStep(activeStep.field);
    if (message) {
      setErrors((previous) => ({ ...previous, [activeStep.field]: message }));
      return;
    }

    if (currentStep < steps.length - 1) {
      setCurrentStep((previous) => previous + 1);
      return;
    }

    setIsSaving(true);
    setServerError("");

    try {
      const payload: Partial<CompletionForm> = {};

      if (missingFields.includes("name")) {
        payload.name = form.name.trim();
      }

      if (missingFields.includes("phone")) {
        payload.phone = normalizePhoneNumber(countryDial.dial, form.phone);
      }

      if (missingFields.includes("location")) {
        payload.location = form.location;
      }

      const { error } = await authClient.updateUser(payload);

      if (error) {
        throw error;
      }

      toast.success("Your account is ready", {
        description: "We saved the missing details from your Google sign up.",
      });

      router.replace(destination);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "We could not save your details right now. Please try again.";

      setServerError(message);
      toast.error("Could not finish setup", {
        description: message,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleExit = async () => {
    setIsLeaving(true);

    try {
      await authClient.signOut();
    } finally {
      router.replace("/login");
      setIsLeaving(false);
    }
  };

  if (isPending || !user || !activeStep) {
    return (
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 px-4">
        <div className="absolute inset-0">
          <Image
            src="/sign-up.jpg"
            alt="Background"
            fill
            className="object-cover object-center"
            priority
          />
          <div className="absolute inset-0 bg-slate-950/75" />
        </div>
        <div className="relative z-10 flex items-center gap-3 rounded-full border border-white/15 bg-white/10 px-5 py-3 text-sm font-medium text-white backdrop-blur">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Preparing your account...</span>
        </div>
      </div>
    );
  }

  const helperCountLabel =
    missingFields.length === 1 ? "1 detail" : `${missingFields.length} details`;

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950 px-3 py-4 sm:px-4 sm:py-6">
      <div className="absolute inset-0">
        <Image
          src="/sign-up.jpg"
          alt="Background"
          fill
          className="object-cover object-center"
          priority
        />
        <div className="absolute inset-0 bg-slate-950/80" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(99,102,241,0.22),transparent_48%)]" />
      </div>

      <div className="relative z-10 mx-auto flex min-h-[calc(100vh-2rem)] w-full max-w-md items-center justify-center">
        <div className="w-full overflow-hidden rounded-[28px] border border-white/15 bg-white/95 shadow-[0_30px_80px_rgba(15,23,42,0.45)] backdrop-blur-xl">
          <div className="border-b border-slate-100 px-5 pb-4 pt-6 sm:px-7">
            <Link href="/" className="inline-flex items-center">
              <Image
                src="/logo.png"
                alt="SwiftDU"
                width={136}
                height={48}
                className="h-10 w-auto object-contain"
              />
            </Link>

            <div className="mt-5 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-indigo-600">
                  Finish sign up
                </p>
                <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
                  One last thing
                </h1>
              </div>
              <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                {currentStep + 1} / {steps.length}
              </div>
            </div>

            <p className="mt-3 text-sm leading-6 text-slate-600">
              Google shared your email. We still need {helperCountLabel} to
              complete your SwiftDU account.
            </p>

            <div className="mt-4 flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-600">
              <Mail className="h-4 w-4 flex-shrink-0 text-slate-400" />
              <span className="truncate">{user.email}</span>
            </div>

            <div className="mt-5 flex gap-2">
              {steps.map((step, index) => (
                <div
                  key={step.field}
                  className={`h-2 flex-1 rounded-full transition-colors ${
                    index <= currentStep ? "bg-indigo-600" : "bg-slate-200"
                  }`}
                />
              ))}
            </div>
          </div>

          <div className="px-5 py-5 sm:px-7 sm:py-6">
            {serverError && (
              <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {serverError}
              </div>
            )}

            <div className="rounded-[24px] border border-slate-100 bg-white p-5 shadow-sm">
              <div className="mb-5">
                <span className="inline-flex rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
                  {activeStep.badge}
                </span>
                <h2 className="mt-3 text-xl font-semibold tracking-tight text-slate-900">
                  {activeStep.title}
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {activeStep.description}
                </p>
              </div>

              {activeStep.field === "name" && (
                <div className="space-y-2">
                  <label
                    htmlFor="name"
                    className="text-sm font-semibold text-slate-700"
                  >
                    Full name
                  </label>
                  <input
                    id="name"
                    name="name"
                    type="text"
                    autoComplete="name"
                    placeholder="Enter your full name"
                    value={form.name}
                    onChange={handleChange}
                    className={`w-full rounded-2xl border-2 bg-white px-4 py-3.5 text-base text-slate-900 outline-none transition focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100 ${
                      errors.name ? "border-red-400 bg-red-50/60" : "border-slate-200"
                    }`}
                  />
                  {errors.name && (
                    <p className="text-xs text-red-600">{errors.name}</p>
                  )}
                </div>
              )}

              {activeStep.field === "phone" && (
                <div className="space-y-2">
                  <label
                    htmlFor="phone"
                    className="text-sm font-semibold text-slate-700"
                  >
                    Phone number
                  </label>
                  <div className="flex gap-2">
                    <div className="relative w-[96px] flex-shrink-0">
                      <select
                        value={countryDial.code}
                        onChange={(event) => {
                          const nextCountry = COUNTRY_CODES.find(
                            (country) => country.code === event.target.value
                          );

                          if (nextCountry) {
                            setCountryDial(nextCountry);
                          }
                        }}
                        className="w-full appearance-none rounded-2xl border-2 border-slate-200 bg-white px-3 py-3.5 pr-8 text-sm font-medium text-slate-700 outline-none transition focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100"
                      >
                        {COUNTRY_CODES.map((country) => (
                          <option key={country.code} value={country.code}>
                            {country.flag} {country.dial}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    </div>

                    <div className="relative flex-1">
                      <input
                        id="phone"
                        name="phone"
                        type="tel"
                        autoComplete="tel"
                        inputMode="tel"
                        placeholder="8012345678"
                        value={form.phone}
                        onChange={handleChange}
                        className={`w-full rounded-2xl border-2 bg-white px-4 py-3.5 pl-11 text-base text-slate-900 outline-none transition focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100 ${
                          errors.phone ? "border-red-400 bg-red-50/60" : "border-slate-200"
                        }`}
                      />
                      <Phone className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    </div>
                  </div>
                  <p className="text-xs text-slate-500">
                    Use the number you want riders and support to reach.
                  </p>
                  {errors.phone && (
                    <p className="text-xs text-red-600">{errors.phone}</p>
                  )}
                </div>
              )}

              {activeStep.field === "location" && (
                <div className="space-y-2">
                  <label
                    htmlFor="location"
                    className="text-sm font-semibold text-slate-700"
                  >
                    Hostel or location
                  </label>
                  <div className="relative">
                    <select
                      id="location"
                      name="location"
                      value={form.location}
                      onChange={handleChange}
                      className={`w-full appearance-none rounded-2xl border-2 bg-white px-4 py-3.5 pr-11 text-base text-slate-900 outline-none transition focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100 ${
                        errors.location
                          ? "border-red-400 bg-red-50/60"
                          : "border-slate-200"
                      }`}
                    >
                      {LOCATIONS.map((location) => (
                        <option
                          key={location.value}
                          value={location.value}
                          disabled={location.disabled}
                        >
                          {location.label}
                        </option>
                      ))}
                    </select>
                    <MapPin className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  </div>
                  <p className="text-xs text-slate-500">
                    This keeps task matching fast for the places students use most.
                  </p>
                  {errors.location && (
                    <p className="text-xs text-red-600">{errors.location}</p>
                  )}
                </div>
              )}
            </div>

            <div className="mt-5 flex items-center gap-3">
              {currentStep > 0 ? (
                <button
                  type="button"
                  onClick={() => setCurrentStep((previous) => previous - 1)}
                  className="flex-1 rounded-full border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                >
                  Back
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleExit}
                  disabled={isLeaving}
                  className="flex-1 rounded-full border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                >
                  {isLeaving ? "Signing out..." : "Sign out"}
                </button>
              )}

              <button
                type="button"
                onClick={handleContinue}
                disabled={isSaving || isLeaving}
                className="flex flex-[1.3] items-center justify-center gap-2 rounded-full bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-200 transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <span>
                    {currentStep === steps.length - 1 ? "Finish setup" : "Continue"}
                  </span>
                )}
              </button>
            </div>

            <p className="mt-5 text-center text-xs leading-5 text-slate-500">
              This page only asks for the details Google does not always provide.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CompleteProfilePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center px-6 text-center text-sm text-slate-500">
          Loading your account setup...
        </div>
      }
    >
      <CompleteProfilePageContent />
    </Suspense>
  );
}
