"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { createAvatar } from "@dicebear/core";
import * as adventurerNeutral from "@dicebear/adventurer-neutral";
import { Camera, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel, FieldError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";

type Gender = "" | "male" | "female" | "other" | "prefer_not_to_say";

interface ProfileForm {
  name: string;
  email: string;
  phone: string;
  location: string;
  profileImage: string;
  profileImagePublicId: string;
  gender: Gender;
  dateOfBirth: string;
}

interface ProfileResponse {
  user: ProfileForm & { id: string };
}

interface CloudinaryResult {
  secure_url: string;
  public_id: string;
}

interface PasskeySummary {
  id: string;
  name?: string;
  createdAt?: string | Date;
}

const EMPTY_FORM: ProfileForm = {
  name: "",
  email: "",
  phone: "",
  location: "",
  profileImage: "",
  profileImagePublicId: "",
  gender: "",
  dateOfBirth: "",
};

const genderLabels: Record<Exclude<Gender, "">, string> = {
  male: "Male",
  female: "Female",
  other: "Other",
  prefer_not_to_say: "Prefer not to say",
};

function displayValue(value?: string | null) {
  return value?.trim() || "Not set";
}

function formatDate(value?: string) {
  if (!value) return "Not set";

  return new Intl.DateTimeFormat("en-NG", {
    dateStyle: "medium",
  }).format(new Date(`${value}T00:00:00.000Z`));
}

export function ProfileTab() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isPasskeyLoading, setIsPasskeyLoading] = useState(true);
  const [isPasskeySaving, setIsPasskeySaving] = useState(false);
  const [passkeys, setPasskeys] = useState<PasskeySummary[]>([]);
  const [formData, setFormData] = useState<ProfileForm>(EMPTY_FORM);
  const [savedFormData, setSavedFormData] = useState<ProfileForm>(EMPTY_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const fallbackAvatar = useMemo(
    () =>
      createAvatar(adventurerNeutral, {
        seed: [formData.email, formData.name].filter(Boolean).join(":") || "swiftdu-user",
        size: 160,
        radius: 50,
        backgroundColor: ["e0f2fe", "eef2ff", "ecfeff"],
        backgroundType: ["gradientLinear"],
      }).toDataUri(),
    [formData.email, formData.name]
  );
  const avatarSrc = formData.profileImage || fallbackAvatar;

  useEffect(() => {
    async function loadProfile() {
      setIsLoading(true);

      try {
        const response = await fetch("/api/users/me/profile", { cache: "no-store" });
        if (!response.ok) throw new Error("Failed to load profile");

        const payload = (await response.json()) as ProfileResponse;
        const nextForm = {
          ...EMPTY_FORM,
          ...payload.user,
          gender: (payload.user.gender || "") as Gender,
        };
        setFormData(nextForm);
        setSavedFormData(nextForm);
      } catch {
        toast.error("Failed to load profile");
      } finally {
        setIsLoading(false);
      }
    }

    void loadProfile();
  }, []);

  const loadPasskeys = async () => {
    setIsPasskeyLoading(true);

    try {
      const response = await fetch("/api/auth/passkey/list-user-passkeys", {
        cache: "no-store",
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to load passkeys");
      }

      const data = (await response.json()) as PasskeySummary[];
      setPasskeys(Array.isArray(data) ? data : []);
    } catch {
      setPasskeys([]);
    } finally {
      setIsPasskeyLoading(false);
    }
  };

  useEffect(() => {
    void loadPasskeys();
  }, []);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = "Name is required";
    }

    if (!formData.email.trim()) {
      newErrors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = "Please enter a valid email";
    }

    if (formData.dateOfBirth) {
      const date = new Date(`${formData.dateOfBirth}T00:00:00.000Z`);
      if (Number.isNaN(date.getTime()) || date > new Date()) {
        newErrors.dateOfBirth = "Enter a valid date of birth";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const saveProfile = async (payload: Partial<ProfileForm>) => {
    const response = await fetch("/api/users/me/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Failed to save profile");
    }

    const nextForm = {
      ...EMPTY_FORM,
      ...data.user,
      gender: (data.user.gender || "") as Gender,
    };
    setFormData(nextForm);
    setSavedFormData(nextForm);
    window.dispatchEvent(new Event("swiftdu-profile-updated"));
  };

  const handleSave = async () => {
    if (!validateForm()) return;

    setIsSaving(true);
    try {
      await saveProfile({
        name: formData.name,
        phone: formData.phone,
        location: formData.location,
        gender: formData.gender,
        dateOfBirth: formData.dateOfBirth,
      });
      setIsEditing(false);
      toast.success("Profile updated successfully");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update profile");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setFormData(savedFormData);
    setIsEditing(false);
    setErrors({});
  };

  const uploadToCloudinary = async (file: File): Promise<CloudinaryResult> => {
    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;

    if (!cloudName) {
      throw new Error("Image uploads are not configured.");
    }

    const body = new FormData();
    body.append("file", file);
    body.append(
      "upload_preset",
      process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET || "tasker_profiles"
    );

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
      { method: "POST", body }
    );

    if (!response.ok) {
      throw new Error("Image upload failed.");
    }

    const data = await response.json();
    return {
      secure_url: data.secure_url,
      public_id: data.public_id,
    };
  };

  const handleImageSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please select a valid image file");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be under 5MB");
      return;
    }

    setIsUploadingImage(true);

    try {
      const upload = await uploadToCloudinary(file);
      await saveProfile({
        profileImage: upload.secure_url,
        profileImagePublicId: upload.public_id,
      });
      toast.success("Profile picture updated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Image upload failed");
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleEnablePasskey = async () => {
    if (!window.PublicKeyCredential) {
      toast.error("This device does not support biometric passkeys.");
      return;
    }

    setIsPasskeySaving(true);

    try {
      const { error } = await authClient.passkey.addPasskey({
        name: "Fingerprint / Face ID",
        authenticatorAttachment: "platform",
      });

      if (error) {
        throw new Error(error.message || "Could not enable biometric sign-in");
      }

      toast.success("Fingerprint / Face ID sign-in enabled");
      await loadPasskeys();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not enable biometric sign-in"
      );
    } finally {
      setIsPasskeySaving(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          Loading profile...
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile Information</CardTitle>
        <CardDescription>Manage your personal information</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="group relative h-28 w-28 overflow-hidden rounded-full border-4 border-white bg-slate-100 shadow-lg outline-none ring-1 ring-slate-200 transition hover:scale-[1.01] focus-visible:ring-2 focus-visible:ring-indigo-500 dark:border-slate-900 dark:bg-slate-800 dark:ring-slate-700"
            aria-label="Upload profile picture"
          >
            <Image
              src={avatarSrc}
              alt="Profile picture"
              width={112}
              height={112}
              unoptimized
              className="h-full w-full object-cover"
            />
            <span className="absolute inset-0 flex items-center justify-center bg-slate-950/45 text-white opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100">
              {isUploadingImage ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : (
                <Camera className="h-6 w-6" />
              )}
            </span>
          </button>
          <div>
            <p className="font-medium text-foreground">
              {formData.profileImage ? "Profile photo set" : "Using generated avatar"}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Click the picture to upload a profile photo.
            </p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleImageSelect}
            disabled={isUploadingImage}
          />
        </div>

        <FieldGroup>
          <Field>
            <FieldLabel>Full Name</FieldLabel>
            {isEditing ? (
              <>
                <Input
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  placeholder="Enter your full name"
                  disabled={isSaving}
                />
                {errors.name && <FieldError>{errors.name}</FieldError>}
              </>
            ) : (
              <div className="text-sm text-foreground">{displayValue(formData.name)}</div>
            )}
          </Field>

          <Field>
            <FieldLabel>Email Address</FieldLabel>
            {isEditing ? (
              <>
                <Input
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  placeholder="Enter your email"
                  disabled
                />
                {errors.email && <FieldError>{errors.email}</FieldError>}
                <p className="mt-1 text-xs text-muted-foreground">
                  Email changes are not supported here. Contact support if needed.
                </p>
              </>
            ) : (
              <div className="text-sm text-foreground">{displayValue(formData.email)}</div>
            )}
          </Field>

          <Field>
            <FieldLabel>Phone Number</FieldLabel>
            {isEditing ? (
              <Input
                name="phone"
                value={formData.phone}
                onChange={handleInputChange}
                placeholder="Enter your phone number"
                disabled={isSaving}
              />
            ) : (
              <div className="text-sm text-foreground">{displayValue(formData.phone)}</div>
            )}
          </Field>

          <Field>
            <FieldLabel>Location</FieldLabel>
            {isEditing ? (
              <Input
                name="location"
                value={formData.location}
                onChange={handleInputChange}
                placeholder="Enter your location"
                disabled={isSaving}
              />
            ) : (
              <div className="text-sm text-foreground">{displayValue(formData.location)}</div>
            )}
          </Field>

          <Field>
            <FieldLabel>Gender</FieldLabel>
            {isEditing ? (
              <select
                name="gender"
                value={formData.gender}
                onChange={handleInputChange}
                disabled={isSaving}
                className="h-10 rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <option value="">Select gender</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
                <option value="prefer_not_to_say">Prefer not to say</option>
              </select>
            ) : (
              <div className="text-sm text-foreground">
                {formData.gender ? genderLabels[formData.gender] : "Not set"}
              </div>
            )}
          </Field>

          <Field>
            <FieldLabel>Date of Birth</FieldLabel>
            {isEditing ? (
              <>
                <Input
                  name="dateOfBirth"
                  type="date"
                  value={formData.dateOfBirth}
                  onChange={handleInputChange}
                  disabled={isSaving}
                />
                {errors.dateOfBirth && <FieldError>{errors.dateOfBirth}</FieldError>}
              </>
            ) : (
              <div className="text-sm text-foreground">{formatDate(formData.dateOfBirth)}</div>
            )}
          </Field>
        </FieldGroup>

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/40">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-medium text-foreground">Fingerprint / Face ID</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {isPasskeyLoading
                  ? "Checking biometric sign-in..."
                  : passkeys.length > 0
                    ? "Enabled on this account"
                    : "Not enabled"}
              </p>
            </div>
            <Button
              type="button"
              variant={passkeys.length > 0 ? "outline" : "default"}
              onClick={handleEnablePasskey}
              disabled={isPasskeyLoading || isPasskeySaving}
            >
              {isPasskeySaving
                ? "Enabling..."
                : passkeys.length > 0
                  ? "Add another device"
                  : "Enable"}
            </Button>
          </div>
          {passkeys.length > 0 && (
            <div className="mt-3 space-y-2">
              {passkeys.map((passkey) => (
                <div
                  key={passkey.id}
                  className="flex items-center justify-between rounded-md bg-white px-3 py-2 text-sm ring-1 ring-slate-200 dark:bg-slate-950 dark:ring-slate-800"
                >
                  <span className="font-medium text-foreground">
                    {passkey.name || "Biometric passkey"}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {passkey.createdAt
                      ? new Intl.DateTimeFormat("en-NG", {
                          dateStyle: "medium",
                        }).format(new Date(passkey.createdAt))
                      : "Enabled"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex gap-3">
          {!isEditing ? (
            <Button onClick={() => setIsEditing(true)} className="w-full">
              Edit Profile
            </Button>
          ) : (
            <>
              <Button onClick={handleSave} disabled={isSaving} className="flex-1">
                {isSaving ? "Saving..." : "Save Changes"}
              </Button>
              <Button onClick={handleCancel} variant="outline" disabled={isSaving} className="flex-1">
                Cancel
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
