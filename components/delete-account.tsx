"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

export function DeleteAccountSection() {
  const [isLoading, setIsLoading] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");

  const handleDeleteClick = () => {
    setShowPasswordModal(true);
    setPassword("");
    setPasswordError("");
  };

  const handleVerifyPassword = () => {
    if (!password) {
      setPasswordError("Please enter your password");
      return;
    }

    // Mock password verification (in real app, this would be an API call)
    if (password === "password") {
      setPasswordError("");
      setShowPasswordModal(false);
      setShowDeleteDialog(true);
      toast("Proceed with account deletion",);
    } else {
      setPasswordError("Incorrect password. Please try again.");
    }
  };

  const handleConfirmDelete = async () => {
    setIsLoading(true);
    // Simulate API call
    setTimeout(() => {
      setIsLoading(false);
      setShowDeleteDialog(false);
      toast("Your account has been permanently deleted");
      // In a real app, redirect to home page
    }, 1000);
  };

  return (
    <>
      <Card className="border-red-200 dark:border-red-900">
        <CardHeader>
          <CardTitle className="text-red-600 dark:text-red-400">Delete Account</CardTitle>
          <CardDescription>
            Permanently delete your account and all associated data
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert className="border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950">
            <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
            <AlertDescription className="text-red-800 dark:text-red-300">
              This action cannot be undone. Please be certain.
            </AlertDescription>
          </Alert>

          <div className="space-y-2 text-sm text-muted-foreground">
            <p>When you delete your account:</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Your profile will be permanently removed</li>
              <li>All your transaction history will be deleted</li>
              <li>You won&apos;t be able to recover any data</li>
              <li>Any pending transactions will be cancelled</li>
            </ul>
          </div>

          <Button
            onClick={handleDeleteClick}
            disabled={isLoading}
            variant="destructive"
            className="w-full"
          >
            {isLoading ? "Deleting..." : "Delete Account"}
          </Button>
        </CardContent>
      </Card>

      <Dialog open={showPasswordModal} onOpenChange={setShowPasswordModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Verify Your Password</DialogTitle>
            <DialogDescription>
              Enter your password to confirm account deletion
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Password</label>
              <input
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setPasswordError("");
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleVerifyPassword();
                  }
                }}
                className="w-full px-3 py-2 border rounded-md"
              />
              {passwordError && (
                <p className="text-sm text-red-600">{passwordError}</p>
              )}
            </div>
          </div>

          <DialogFooter className="flex gap-3">
            <Button
              onClick={() => setShowPasswordModal(false)}
              disabled={isLoading}
              variant="outline"
            >
              Cancel
            </Button>
            <Button
              onClick={handleVerifyPassword}
              disabled={isLoading || !password}
              variant="destructive"
            >
              Verify Password
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogTitle>Delete Account?</AlertDialogTitle>
          <AlertDialogDescription>
            Are you absolutely sure you want to delete your account? This will permanently remove
            all your data including profile information, transaction history, and account balance.
            This action cannot be undone.
          </AlertDialogDescription>
          <div className="flex gap-3">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={isLoading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isLoading ? "Deleting..." : "Delete Account"}
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
