"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Field, FieldGroup, FieldLabel, FieldError } from "@/components/ui/field";
import { authClient } from "@/lib/auth-client";

interface PasswordForm {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export function PasswordTab() {
  const [formData, setFormData] = useState<PasswordForm>({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.currentPassword)
      newErrors.currentPassword = "Current password is required";

    if (!formData.newPassword)
      newErrors.newPassword = "New password is required";
    else if (formData.newPassword.length < 8)
      newErrors.newPassword = "Password must be at least 8 characters";

    if (formData.newPassword !== formData.confirmPassword)
      newErrors.confirmPassword = "Passwords do not match";

    if (formData.currentPassword && formData.currentPassword === formData.newPassword)
      newErrors.newPassword = "New password must be different from current password";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsLoading(true);
    const { error } = await authClient.changePassword({
      currentPassword: formData.currentPassword,
      newPassword: formData.newPassword,
      revokeOtherSessions: true, // sign out other devices on password change
    });
    setIsLoading(false);

    if (error) {
      // Surface wrong-current-password specifically; fall back to the API message
      if (error.status === 400 || error.code === "INVALID_PASSWORD") {
        setErrors({ currentPassword: "Current password is incorrect" });
      } else {
        toast.error(error.message ?? "Failed to update password");
      }
      return;
    }

    setFormData({ currentPassword: "", newPassword: "", confirmPassword: "" });
    toast.success("Password updated successfully", {
      description: "All other sessions have been signed out.",
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Change Password</CardTitle>
        <CardDescription>Update your password to keep your account secure</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <FieldGroup>
            <Field>
              <FieldLabel>Current Password</FieldLabel>
              <Input
                name="currentPassword"
                type="password"
                value={formData.currentPassword}
                onChange={handleInputChange}
                placeholder="Enter your current password"
                disabled={isLoading}
              />
              {errors.currentPassword && (
                <FieldError>{errors.currentPassword}</FieldError>
              )}
            </Field>

            <Field>
              <FieldLabel>New Password</FieldLabel>
              <Input
                name="newPassword"
                type="password"
                value={formData.newPassword}
                onChange={handleInputChange}
                placeholder="Enter your new password"
                disabled={isLoading}
              />
              {errors.newPassword && <FieldError>{errors.newPassword}</FieldError>}
              <p className="text-xs text-muted-foreground mt-1">
                Must be at least 8 characters long
              </p>
            </Field>

            <Field>
              <FieldLabel>Confirm New Password</FieldLabel>
              <Input
                name="confirmPassword"
                type="password"
                value={formData.confirmPassword}
                onChange={handleInputChange}
                placeholder="Confirm your new password"
                disabled={isLoading}
              />
              {errors.confirmPassword && (
                <FieldError>{errors.confirmPassword}</FieldError>
              )}
            </Field>
          </FieldGroup>

          <Button type="submit" disabled={isLoading} className="w-full">
            {isLoading ? "Updating..." : "Update Password"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}