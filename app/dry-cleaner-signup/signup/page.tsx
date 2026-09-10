"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { authClient } from "@/lib/auth-client";
import { getPostAuthRedirect } from "@/lib/profile-completion";

const DAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;

type Day = (typeof DAYS)[number];

type FormState = {
  businessName: string;
  ownerName: string;
  phone: string;
  location: string;
  shirt: string;
  trouser: string;
  hoodieMin: string;
  hoodieMax: string;
  bedsheetMin: string;
  bedsheetMax: string;
  duvetMin: string;
  duvetMax: string;
  underwear: string;
  shoes: string;
  doesNotWashShirt: boolean;
  doesNotWashTrouser: boolean;
  doesNotWashHoodie: boolean;
  doesNotWashBedsheet: boolean;
  doesNotWashDuvet: boolean;
  doesNotWashUnderwear: boolean;
  doesNotWashShoes: boolean;
  acceptingDays: Day[];
  cutoffTime: string;
  expectedDeliveryDays: string;
  temporarilyClosed: boolean;
};

type CloudinaryResult = {
  secure_url: string;
  public_id: string;
};

const DEFAULT_FORM: FormState = {
  businessName: "",
  ownerName: "",
  phone: "",
  location: "",
  shirt: "500",
  trouser: "500",
  hoodieMin: "500",
  hoodieMax: "1000",
  bedsheetMin: "1000",
  bedsheetMax: "1500",
  duvetMin: "2000",
  duvetMax: "2500",
  underwear: "500",
  shoes: "500",
  doesNotWashShirt: false,
  doesNotWashTrouser: false,
  doesNotWashHoodie: false,
  doesNotWashBedsheet: false,
  doesNotWashDuvet: true,
  doesNotWashUnderwear: true,
  doesNotWashShoes: true,
  acceptingDays: ["monday", "wednesday", "friday"],
  cutoffTime: "17:00",
  expectedDeliveryDays: "2",
  temporarilyClosed: false,
};

function money(value: string) {
  return Number(value || 0);
}

export default function DryCleanerSignupPage() {
  const router = useRouter();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [user, setUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [uploadedLogo, setUploadedLogo] = useState<CloudinaryResult | null>(null);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);

  useEffect(() => {
    const getSession = async () => {
      try {
        const { data, error } = await authClient.getSession();
        if (error || !data?.user) {
          router.push("/auth");
          return;
        }

        const nextPath = getPostAuthRedirect(data.user, "/dry-cleaner-signup/signup");
        if (nextPath !== "/dry-cleaner-signup/signup") {
          router.replace(nextPath);
          return;
        }

        setUser(data.user);
        setForm((current) => ({
          ...current,
          ownerName: data.user.name || "",
          location: data.user.location || "",
        }));
      } catch {
        router.push("/auth");
      } finally {
        setIsLoading(false);
      }
    };

    void getSession();
  }, [router]);

  const setField = (name: keyof FormState, value: string | boolean | Day[]) => {
    setForm((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: "" }));
  };

  const toggleDay = (day: Day) => {
    setField(
      "acceptingDays",
      form.acceptingDays.includes(day)
        ? form.acceptingDays.filter((item) => item !== day)
        : [...form.acceptingDays, day]
    );
  };

  const handleLogoSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please select a valid image file");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Logo must be under 5MB");
      return;
    }

    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
    setUploadedLogo(null);
    event.target.value = "";
  };

  const uploadLogo = async (): Promise<CloudinaryResult | null> => {
    if (!logoFile) return uploadedLogo;

    setIsUploadingLogo(true);
    try {
      const formData = new FormData();
      formData.append("file", logoFile);
      formData.append(
        "upload_preset",
        process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET || "dry_cleaner_logos"
      );

      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/image/upload`,
        { method: "POST", body: formData }
      );

      if (!response.ok) throw new Error("Upload failed");

      const data = await response.json();
      const result = {
        secure_url: data.secure_url,
        public_id: data.public_id,
      };
      setUploadedLogo(result);
      return result;
    } catch {
      toast.error("Logo upload failed. Please try again.");
      return null;
    } finally {
      setIsUploadingLogo(false);
    }
  };

  const validate = () => {
    const nextErrors: Record<string, string> = {};

    if (!form.businessName.trim()) nextErrors.businessName = "Business name is required";
    if (!form.ownerName.trim()) nextErrors.ownerName = "Owner name is required";
    if (!/^(\+234|0)[789][01]\d{8}$/.test(form.phone)) {
      nextErrors.phone = "Enter a valid Nigerian phone number";
    }
    if (!form.location.trim()) nextErrors.location = "Location is required";
    if (form.acceptingDays.length === 0) nextErrors.acceptingDays = "Select at least one day";
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(form.cutoffTime)) {
      nextErrors.cutoffTime = "Use HH:mm format";
    }
    if (!form.doesNotWashHoodie && money(form.hoodieMin) > money(form.hoodieMax)) {
      nextErrors.hoodieMax = "Maximum must be higher than minimum";
    }
    if (!form.doesNotWashBedsheet && money(form.bedsheetMin) > money(form.bedsheetMax)) {
      nextErrors.bedsheetMax = "Maximum must be higher than minimum";
    }
    if (!form.doesNotWashDuvet && money(form.duvetMin) > money(form.duvetMax)) {
      nextErrors.duvetMax = "Maximum must be higher than minimum";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!validate() || !user) return;

    setIsSubmitting(true);
    try {
      const logo = logoFile && !uploadedLogo ? await uploadLogo() : uploadedLogo;
      if (logoFile && !logo) return;

      const response = await fetch("/api/dry-cleaners", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          businessName: form.businessName,
          ownerName: form.ownerName,
          phone: form.phone,
          location: form.location,
          businessLogo: logo?.secure_url || null,
          businessLogoPublicId: logo?.public_id || null,
          pricing: {
            shirt: money(form.shirt),
            trouser: money(form.trouser),
            hoodieMin: money(form.hoodieMin),
            hoodieMax: money(form.hoodieMax),
            bedsheetMin: money(form.bedsheetMin),
            bedsheetMax: money(form.bedsheetMax),
            duvetMin: money(form.duvetMin),
            duvetMax: money(form.duvetMax),
            underwear: money(form.underwear),
            shoes: money(form.shoes),
            doesNotWashShirt: form.doesNotWashShirt,
            doesNotWashTrouser: form.doesNotWashTrouser,
            doesNotWashHoodie: form.doesNotWashHoodie,
            doesNotWashBedsheet: form.doesNotWashBedsheet,
            doesNotWashDuvet: form.doesNotWashDuvet,
            doesNotWashUnderwear: form.doesNotWashUnderwear,
            doesNotWashShoes: form.doesNotWashShoes,
          },
          availability: {
            acceptingDays: form.acceptingDays,
            cutoffTime: form.cutoffTime,
            expectedDeliveryDays: Number(form.expectedDeliveryDays),
            temporarilyClosed: form.temporarilyClosed,
          },
        }),
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        toast.error(payload.error || "Failed to submit dry cleaner application");
        return;
      }

      setSubmitted(true);
    } catch {
      toast.error("An error occurred. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-600">Loading...</div>;
  }

  if (!user) return null;

  if (submitted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="max-w-md rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-2xl font-bold text-slate-950">Application submitted</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Your dry cleaner registration is pending review. Admin or COO approval is required before it appears as an active provider.
          </p>
          <button
            type="button"
            className="mt-6 rounded-lg bg-slate-950 px-5 py-3 text-sm font-semibold text-white"
            onClick={() => router.push("/")}
          >
            Back to home
          </button>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 text-slate-950">
      <form onSubmit={submit} className="mx-auto max-w-3xl space-y-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-blue-600">Dry Cleaner Signup</p>
          <h1 className="mt-2 text-3xl font-bold tracking-normal">Register your laundry business</h1>
          <p className="mt-2 text-sm text-slate-600">
            Set the prices, accepted days, cutoff time, and expected delivery period customers should see after approval.
          </p>
        </div>

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold">Business Details</h2>
          <div className="mt-4 flex items-center gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <button
              type="button"
              onClick={() => logoInputRef.current?.click()}
              className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-dashed border-slate-300 bg-white text-sm font-semibold text-slate-500"
            >
              {logoPreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoPreview} alt="Business logo preview" className="h-full w-full object-cover" />
              ) : (
                "Logo"
              )}
            </button>
            <div>
              <p className="text-sm font-semibold text-slate-900">Business Logo</p>
              <p className="mt-1 text-xs text-slate-500">Optional image, max 5MB.</p>
              <button
                type="button"
                onClick={() => logoInputRef.current?.click()}
                className="mt-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
              >
                {logoPreview ? "Change logo" : "Upload logo"}
              </button>
              <input
                ref={logoInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleLogoSelect}
              />
            </div>
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <Field label="Business Name" value={form.businessName} error={errors.businessName} onChange={(value) => setField("businessName", value)} />
            <Field label="Owner Name" value={form.ownerName} error={errors.ownerName} onChange={(value) => setField("ownerName", value)} />
            <Field label="Phone" value={form.phone} error={errors.phone} onChange={(value) => setField("phone", value)} placeholder="08012345678" />
            <Field label="Location" value={form.location} error={errors.location} onChange={(value) => setField("location", value)} placeholder="Hall C" />
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold">Pricing</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <PricingItem
              label="Shirt"
              accepted={!form.doesNotWashShirt}
              onAcceptedChange={(accepted) => setField("doesNotWashShirt", !accepted)}
              fields={[
                { label: "Price", value: form.shirt, onChange: (value) => setField("shirt", value) },
              ]}
            />
            <PricingItem
              label="Trouser"
              accepted={!form.doesNotWashTrouser}
              onAcceptedChange={(accepted) => setField("doesNotWashTrouser", !accepted)}
              fields={[
                { label: "Price", value: form.trouser, onChange: (value) => setField("trouser", value) },
              ]}
            />
            <PricingItem
              label="Hoodie"
              accepted={!form.doesNotWashHoodie}
              onAcceptedChange={(accepted) => setField("doesNotWashHoodie", !accepted)}
              fields={[
                { label: "Min", value: form.hoodieMin, onChange: (value) => setField("hoodieMin", value) },
                { label: "Max", value: form.hoodieMax, error: errors.hoodieMax, onChange: (value) => setField("hoodieMax", value) },
              ]}
            />
            <PricingItem
              label="Bedsheet"
              accepted={!form.doesNotWashBedsheet}
              onAcceptedChange={(accepted) => setField("doesNotWashBedsheet", !accepted)}
              fields={[
                { label: "Min", value: form.bedsheetMin, onChange: (value) => setField("bedsheetMin", value) },
                { label: "Max", value: form.bedsheetMax, error: errors.bedsheetMax, onChange: (value) => setField("bedsheetMax", value) },
              ]}
            />
            <PricingItem
              label="Duvet"
              accepted={!form.doesNotWashDuvet}
              onAcceptedChange={(accepted) => setField("doesNotWashDuvet", !accepted)}
              fields={[
                { label: "Min", value: form.duvetMin, onChange: (value) => setField("duvetMin", value) },
                { label: "Max", value: form.duvetMax, error: errors.duvetMax, onChange: (value) => setField("duvetMax", value) },
              ]}
            />
            <PricingItem
              label="Underwear"
              accepted={!form.doesNotWashUnderwear}
              onAcceptedChange={(accepted) => setField("doesNotWashUnderwear", !accepted)}
              fields={[
                { label: "Price", value: form.underwear, onChange: (value) => setField("underwear", value) },
              ]}
            />
            <PricingItem
              label="Shoes"
              accepted={!form.doesNotWashShoes}
              onAcceptedChange={(accepted) => setField("doesNotWashShoes", !accepted)}
              fields={[
                { label: "Price", value: form.shoes, onChange: (value) => setField("shoes", value) },
              ]}
            />
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold">Availability</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {DAYS.map((day) => (
              <button
                key={day}
                type="button"
                onClick={() => toggleDay(day)}
                className={`rounded-lg border px-3 py-2 text-sm font-medium capitalize ${
                  form.acceptingDays.includes(day)
                    ? "border-blue-600 bg-blue-600 text-white"
                    : "border-slate-200 bg-white text-slate-600"
                }`}
              >
                {day.slice(0, 3)}
              </button>
            ))}
          </div>
          {errors.acceptingDays ? <p className="mt-2 text-xs text-red-600">{errors.acceptingDays}</p> : null}
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <Field label="Cutoff Time" type="time" value={form.cutoffTime} error={errors.cutoffTime} onChange={(value) => setField("cutoffTime", value)} />
            <Field label="Expected Delivery Days" type="number" value={form.expectedDeliveryDays} onChange={(value) => setField("expectedDeliveryDays", value)} />
          </div>
          <label className="mt-4 flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={form.temporarilyClosed}
              onChange={(event) => setField("temporarilyClosed", event.target.checked)}
            />
            Temporarily closed for accepting clothes
          </label>
        </section>

        <button
          type="submit"
          disabled={isSubmitting || isUploadingLogo}
          className="w-full rounded-xl bg-blue-600 px-5 py-4 text-sm font-bold text-white disabled:opacity-50"
        >
          {isSubmitting || isUploadingLogo ? "Submitting..." : "Submit Application"}
        </button>
      </form>
    </main>
  );
}

type PricingItemField = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
};

function PricingItem({
  label,
  accepted,
  onAcceptedChange,
  fields,
}: {
  label: string;
  accepted: boolean;
  onAcceptedChange: (accepted: boolean) => void;
  fields: PricingItemField[];
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <label className="flex items-center gap-3 text-sm font-semibold text-slate-800">
        <input
          type="checkbox"
          checked={accepted}
          onChange={(event) => onAcceptedChange(event.target.checked)}
        />
        <span className={accepted ? "" : "text-slate-400 line-through"}>{label}</span>
      </label>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {fields.map((field) => (
          <Field
            key={field.label}
            label={field.label}
            type="number"
            value={field.value}
            error={field.error}
            disabled={!accepted}
            muted={!accepted}
            onChange={field.onChange}
          />
        ))}
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  error,
  placeholder,
  type = "text",
  disabled = false,
  muted = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  placeholder?: string;
  type?: string;
  disabled?: boolean;
  muted?: boolean;
}) {
  return (
    <label className={`block text-sm font-medium ${muted ? "text-slate-400" : "text-slate-700"}`}>
      {label}
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        min={type === "number" ? 0 : undefined}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 h-11 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-blue-500 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
      />
      {error ? <span className="mt-1 block text-xs text-red-600">{error}</span> : null}
    </label>
  );
}
