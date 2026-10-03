"use client";
import { useEffect, useState, type FormEvent } from "react";
import Image from "next/image";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  BUSINESS_CATEGORIES,
  MAX_BUSINESS_IMAGE_BYTES,
} from "@/lib/business-directory-policy";
export default function BusinessSubmissionForm({
  open,
  onOpenChange,
  onListed,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onListed: () => void;
}) {
  const [busy, setBusy] = useState(false),
    [preview, setPreview] = useState(""),
    [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<{
    message: string;
    done?: boolean;
    url?: string;
  } | null>(null);
  useEffect(() => {
    if (!file) {
      setPreview("");
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setResult(null);
    try {
      const response = await fetch("/api/businesses", {
        method: "POST",
        body: form,
      });
      const data = await response.json();
      if (response.status === 201) {
        setResult({ message: "Your business is now listed 🎉", done: true });
        onListed();
      } else
        setResult({
          message: [
            data.error || "Unable to submit. Please try again.",
            data.reason,
          ]
            .filter(Boolean)
            .join(" "),
          ...(typeof data.existingBusiness?.slug === "string"
            ? {
                url: `/businesses?listing=${encodeURIComponent(data.existingBusiness.slug)}`,
              }
            : {}),
        });
    } catch {
      setResult({
        message: "Unable to submit your listing. Please try again.",
      });
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!busy) {
          onOpenChange(value);
          if (!value) {
            setResult(null);
            setFile(null);
          }
        }
      }}
    >
      <DialogContent
        className="max-h-[90dvh] overflow-y-auto rounded-3xl bg-white p-6 text-slate-950 sm:max-w-2xl"
        showCloseButton={!busy}
      >
        <DialogTitle className="text-2xl font-bold">
          List your business
        </DialogTitle>
        <DialogDescription>
          Free for the WDU community. Your contact details will be public when
          listed. Listings publish automatically after validation and checks for
          fraud and sexual content. Your picture represents your business, logo or products.
        </DialogDescription>
        {result && (
          <div
            role="status"
            className="rounded-2xl bg-indigo-50 p-4 text-sm text-indigo-900"
          >
            {result.message}
            {result.url && (
              <a href={result.url} className="mt-3 block font-bold underline">
                View existing listing
              </a>
            )}
          </div>
        )}
        {result?.done ? (
          <Button
            onClick={() => {
              onOpenChange(false);
              setResult(null);
              setFile(null);
            }}
          >
            View directory
          </Button>
        ) : (
          <form onSubmit={submit}>
            <fieldset disabled={busy} className="space-y-5 disabled:opacity-60">
              <div className="grid gap-4 sm:grid-cols-2">
                {[
                  { name: "businessName", label: "Business name", max: 80 },
                  { name: "ownerName", label: "Owner / contact name", max: 80 },
                ].map((f) => (
                  <label
                    key={f.name}
                    className="space-y-2 text-sm font-semibold"
                  >
                    <span>{f.label}</span>
                    <Input
                      name={f.name}
                      required
                      minLength={2}
                      maxLength={f.max}
                    />
                  </label>
                ))}
              </div>
              <label className="block space-y-2 text-sm font-semibold">
                <span>What does your business do?</span>
                <Textarea
                  name="description"
                  required
                  minLength={15}
                  maxLength={400}
                  rows={3}
                />
              </label>
              <label className="block space-y-2 text-sm font-semibold">
                <span>What do you sell or offer?</span>
                <Textarea
                  name="productsServices"
                  required
                  maxLength={1000}
                  placeholder="One item per line, or separated by commas. Up to 12 items."
                  rows={3}
                />
              </label>
              <label className="block space-y-2 text-sm font-semibold">
                <span>Category</span>
                <select
                  name="category"
                  defaultValue="Other"
                  className="h-11 w-full rounded-xl border bg-white px-3"
                >
                  {BUSINESS_CATEGORIES.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                {[
                  {
                    name: "phone",
                    label: "Phone number",
                    max: 30,
                    type: "tel",
                    required: true,
                  },
                  {
                    name: "whatsapp",
                    label: "WhatsApp number",
                    max: 30,
                    type: "tel",
                    required: true,
                  },
                  {
                    name: "instagram",
                    label: "Instagram (optional)",
                    max: 160,
                    type: "text",
                  },
                  {
                    name: "email",
                    label: "Email (optional)",
                    max: 254,
                    type: "email",
                  },
                  {
                    name: "location",
                    label: "Campus / location (optional)",
                    max: 120,
                    type: "text",
                  },
                ].map((f) => (
                  <label
                    key={f.name}
                    className="space-y-2 text-sm font-semibold"
                  >
                    <span>{f.label}</span>
                    <Input
                      name={f.name}
                      type={f.type}
                      maxLength={f.max}
                      required={f.required}
                    />
                  </label>
                ))}
              </div>
              <div className="hidden" aria-hidden="true">
                <label>
                  Website
                  <Input name="website" tabIndex={-1} autoComplete="off" />
                </label>
              </div>
              <label className="block space-y-2 text-sm font-semibold">
                <span>Business image / logo / product photo</span>
                <Input
                  name="image"
                  type="file"
                  required
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => {
                    const chosen = e.target.files?.[0];
                    if (
                      chosen &&
                      (chosen.size > MAX_BUSINESS_IMAGE_BYTES ||
                        !["image/jpeg", "image/png", "image/webp"].includes(
                          chosen.type,
                        ))
                    ) {
                      e.target.value = "";
                      setFile(null);
                      setResult({
                        message: "Choose a JPEG, PNG or WebP image up to 2 MB.",
                      });
                    } else {
                      setFile(chosen ?? null);
                      setResult(null);
                    }
                  }}
                />
                <span className="block text-xs font-normal text-slate-500">
                  One JPEG, PNG or WebP, up to 2 MB. Your image and business
                  details must pass automatic checks before publication.
                </span>
              </label>
              {preview && (
                <Image
                  unoptimized
                  src={preview}
                  width={160}
                  height={120}
                  alt="Your business image preview"
                  className="h-28 w-40 rounded-2xl object-cover"
                />
              )}
              <Button
                type="submit"
                className="h-12 w-full rounded-full bg-indigo-600 text-white hover:bg-indigo-700"
              >
                {busy ? "Reviewing your listing…" : "Submit listing"}
              </Button>
            </fieldset>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
