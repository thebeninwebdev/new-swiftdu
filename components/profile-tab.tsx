"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Field, FieldGroup, FieldLabel, FieldError } from "@/components/ui/field";
import { authClient } from "@/lib/auth-client";

interface ProfileForm {
  name: string;
  email: string;
  phone: string;
  location: string;
}

const EMPTY_FORM: ProfileForm = {
  name: "",
  email: "",
  phone: "",
  location: "",
};

export function ProfileTab() {
  const { data: session, isPending } = authClient.useSession();

  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState<ProfileForm>(EMPTY_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Populate form whenever the session loads or changes
  useEffect(() => {
    if (session?.user) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFormData({
        name: session.user.name ?? "",
        email: session.user.email ?? "",
        phone: (session.user ).phone ?? "",
        location: (session.user ).location ?? "",
      });
    }
  }, [session]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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

    if (!formData.name.trim())
      newErrors.name = "Name is required";

    if (!formData.email.trim())
      newErrors.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email))
      newErrors.email = "Please enter a valid email";

    if (!formData.phone.trim())
      newErrors.phone = "Phone number is required";

    if (!formData.location.trim())
      newErrors.location = "Location is required";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) return;

    setIsSaving(true);
    const { error } = await authClient.updateUser({
      name: formData.name,
      phone: formData.phone,
      location: formData.location,
    });
    setIsSaving(false);

    if (error) {
      toast.error(error.message ?? "Failed to update profile");
      return;
    }

    setIsEditing(false);
    toast.success("Profile updated successfully");
  };

  const handleCancel = () => {
    // Reset back to whatever is currently in the session
    if (session?.user) {
      setFormData({
        name: session.user.name ?? "",
        email: session.user.email ?? "",
        phone: session.user.phone ?? "",
        location: session.user.location ?? "",
      });
    }
    setIsEditing(false);
    setErrors({});
  };

  if (isPending) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          Loading profile…
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
              <div className="text-sm text-foreground">{formData.name || "—"}</div>
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
                  // Email changes usually require re-verification — disable if so
                  disabled
                />
                {errors.email && <FieldError>{errors.email}</FieldError>}
                <p className="text-xs text-muted-foreground mt-1">
                  Email changes are not supported here. Contact support if needed.
                </p>
              </>
            ) : (
              <div className="text-sm text-foreground">{formData.email || "—"}</div>
            )}
          </Field>

          <Field>
            <FieldLabel>Phone Number</FieldLabel>
            {isEditing ? (
              <>
                <Input
                  name="phone"
                  value={formData.phone}
                  onChange={handleInputChange}
                  placeholder="Enter your phone number"
                  disabled={isSaving}
                />
                {errors.phone && <FieldError>{errors.phone}</FieldError>}
              </>
            ) : (
              <div className="text-sm text-foreground">{formData.phone || "—"}</div>
            )}
          </Field>

          <Field>
            <FieldLabel>Location</FieldLabel>
            {isEditing ? (
              <>
                <Input
                  name="location"
                  value={formData.location}
                  onChange={handleInputChange}
                  placeholder="Enter your location"
                  disabled={isSaving}
                />
                {errors.location && <FieldError>{errors.location}</FieldError>}
              </>
            ) : (
              <div className="text-sm text-foreground">{formData.location || "—"}</div>
            )}
          </Field>
        </FieldGroup>

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