"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { AlertCircle, CheckCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { authClient } from "@/lib/auth-client";
import QRCode from "react-qr-code";

export function TwoFATab() {
  const { data: session } = authClient.useSession();

  // True when 2FA is currently active on the account
  const isEnabled = !!session?.user.twoFactorEnabled;

  // Modal / flow state
  const [showSetupModal, setShowSetupModal] = useState(false);
  const [step, setStep] = useState<"password" | "qr">("password");

  // Form state
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [code, setCode] = useState("");

  // Data from API
  const [totpURI, setTotpURI] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);

  // Loading states
  const [isEnabling, setIsEnabling] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isDisabling, setIsDisabling] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);

  // Disable 2FA modal
  const [showDisableModal, setShowDisableModal] = useState(false);
  const [disablePassword, setDisablePassword] = useState("");
  const [disablePasswordError, setDisablePasswordError] = useState("");

  // Backup codes modal
  const [showBackupCodesModal, setShowBackupCodesModal] = useState(false);
  const [viewBackupCodes, setViewBackupCodes] = useState<string[]>([]);
  const [backupPassword, setBackupPassword] = useState("");
  const [backupPasswordError, setBackupPasswordError] = useState("");
  const [backupStep, setBackupStep] = useState<"password" | "codes">("password");

  // ── Open setup modal ──────────────────────────────────────────────────────
  const handleOpenSetup = () => {
    setShowSetupModal(true);
    setStep("password");
    setPassword("");
    setPasswordError("");
    setCode("");
    setTotpURI("");
    setBackupCodes([]);
  };

  const handleCloseSetup = () => {
    setShowSetupModal(false);
    setStep("password");
    setPassword("");
    setPasswordError("");
    setCode("");
  };

  // ── Step 1: verify password & fetch TOTP URI ──────────────────────────────
  const handleVerifyPassword = async () => {
    if (!password) {
      setPasswordError("Please enter your password");
      return;
    }

    setIsEnabling(true);
    const { data, error } = await authClient.twoFactor.enable({
      password,
      issuer: "SwiftDu",
    });
    setIsEnabling(false);

    if (error) {
      setPasswordError(error.message ?? "Incorrect password");
      return;
    }

    if (data?.totpURI) {
      setTotpURI(data.totpURI);
      setBackupCodes(data.backupCodes ?? []);
      setStep("qr");
      toast.success("Password confirmed");
    }
  };

  // ── Step 2: verify the 6-digit TOTP code ─────────────────────────────────
  const handleVerifyCode = async () => {
    if (!code || code.length < 6) {
      toast.error("Please enter the 6-digit code from your authenticator app");
      return;
    }

    setIsVerifying(true);
    const { error } = await authClient.twoFactor.verifyTotp({ code });
    setIsVerifying(false);

    if (error) {
      toast.error(error.message ?? "Invalid code — please try again");
      return;
    }

    toast.success("Two-factor authentication enabled!", {
      description: "Your account is now protected with 2FA.",
    });
    handleCloseSetup();
    // Refresh session so isEnabled updates
    window.location.reload();
  };

  // ── Open / close disable modal ────────────────────────────────────────────
  const handleOpenDisable = () => {
    setShowDisableModal(true);
    setDisablePassword("");
    setDisablePasswordError("");
  };

  const handleCloseDisable = () => {
    setShowDisableModal(false);
    setDisablePassword("");
    setDisablePasswordError("");
  };

  // ── Disable 2FA ───────────────────────────────────────────────────────────
  const handleDisable2FA = async () => {
    if (!disablePassword) {
      setDisablePasswordError("Please enter your password");
      return;
    }

    setIsDisabling(true);
    const { error } = await authClient.twoFactor.disable({
      password: disablePassword,
    });
    setIsDisabling(false);

    if (error) {
      setDisablePasswordError(error.message ?? "Incorrect password");
      return;
    }

    toast.success("Two-factor authentication disabled");
    handleCloseDisable();
    window.location.reload();
  };

  // ── Download backup codes as .txt ─────────────────────────────────────────
  const handleDownloadCodes = (codes: string[]) => {
    const blob = new Blob([codes.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "swiftdu-backup-codes.txt";
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Open "View backup codes" modal ────────────────────────────────────────
  const handleOpenBackupCodes = () => {
    setShowBackupCodesModal(true);
    setBackupStep("password");
    setBackupPassword("");
    setBackupPasswordError("");
    setViewBackupCodes([]);
  };

  const handleCloseBackupCodes = () => {
    setShowBackupCodesModal(false);
    setBackupStep("password");
    setBackupPassword("");
    setBackupPasswordError("");
    setViewBackupCodes([]);
  };

  // ── Regenerate backup codes (password-gated) ──────────────────────────────
  const handleFetchBackupCodes = async () => {
    if (!backupPassword) {
      setBackupPasswordError("Please enter your password");
      return;
    }

    setIsRegenerating(true);
    const { data, error } = await authClient.twoFactor.generateBackupCodes({
      password: backupPassword,
    });
    setIsRegenerating(false);

    if (error) {
      setBackupPasswordError(error.message ?? "Incorrect password");
      return;
    }

    setViewBackupCodes(data?.backupCodes ?? []);
    setBackupStep("codes");
  };

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Two-Factor Authentication</CardTitle>
              <CardDescription>Add an extra layer of security to your account</CardDescription>
            </div>
            <Badge
              className={
                isEnabled
                  ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300"
                  : "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300"
              }
            >
              {isEnabled ? "Enabled" : "Disabled"}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {isEnabled ? (
            // ── 2FA is ON ──────────────────────────────────────────────────
            <div className="space-y-4">
              <Alert>
                <CheckCircle className="h-4 w-4 text-green-600" />
                <AlertDescription>
                  Two-factor authentication is currently enabled on your account.
                </AlertDescription>
              </Alert>

              <div className="p-4 bg-secondary rounded-lg space-y-2">
                <p className="text-sm font-medium">Authentication Method</p>
                <p className="text-sm text-muted-foreground">
                  Authenticator App (e.g., Google Authenticator, Authy)
                </p>
              </div>

              <div className="p-4 bg-secondary rounded-lg space-y-3">
                <div>
                  <p className="text-sm font-medium">Backup Codes</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Lost access to your authenticator app? Use a backup code to sign in and then
                    set up 2FA again.
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={handleOpenBackupCodes}>
                  View / Regenerate Backup Codes
                </Button>
              </div>

              <Button
                onClick={handleOpenDisable}
                variant="destructive"
                className="w-full"
              >
                Disable 2FA
              </Button>
            </div>
          ) : (
            // ── 2FA is OFF ─────────────────────────────────────────────────
            <div className="space-y-4">
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Two-factor authentication is not currently enabled. Enable it to add extra
                  security to your account.
                </AlertDescription>
              </Alert>

              <div className="p-4 bg-secondary rounded-lg space-y-2">
                <h4 className="font-medium">How it works</h4>
                <ul className="text-sm text-muted-foreground space-y-2">
                  <li>• You&apos;ll need an authenticator app like Google Authenticator or Authy</li>
                  <li>• After entering your password, you&apos;ll enter a code from the app</li>
                  <li>• This adds an extra layer of protection to your account</li>
                </ul>
              </div>

              <Button onClick={handleOpenSetup} className="w-full">
                Enable 2FA
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Setup Dialog ───────────────────────────────────────────────────── */}
      <Dialog open={showSetupModal} onOpenChange={handleCloseSetup}>
        <DialogContent className="sm:max-w-md max-h-[90vh] flex flex-col">

          {step === "password" ? (
            // ── Step 1: password ────────────────────────────────────────────
            <>
              <DialogHeader>
                <DialogTitle>Verify Your Password</DialogTitle>
                <DialogDescription>
                  Enter your password to begin setting up two-factor authentication.
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
                    onKeyDown={(e) => e.key === "Enter" && handleVerifyPassword()}
                    className="w-full px-3 py-2 border rounded-md"
                  />
                  {passwordError && (
                    <p className="text-sm text-red-600">{passwordError}</p>
                  )}
                </div>
              </div>

              <DialogFooter className="flex gap-3">
                <Button onClick={handleCloseSetup} variant="outline" disabled={isEnabling}>
                  Cancel
                </Button>
                <Button onClick={handleVerifyPassword} disabled={isEnabling || !password}>
                  {isEnabling ? "Verifying..." : "Continue"}
                </Button>
              </DialogFooter>
            </>
          ) : (
            // ── Step 2: scan QR + enter code ───────────────────────────────
            <>
              <DialogHeader>
                <DialogTitle>Set Up Authenticator App</DialogTitle>
                <DialogDescription>
                  Scan the QR code with your authenticator app, then enter the code it shows.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-5 py-4 overflow-y-auto flex-1 pr-1">
                {/* QR Code */}
                <div className="space-y-2">
                  <h4 className="font-medium text-sm">Step 1: Scan QR Code</h4>
                  {totpURI && (
                    <div className="flex justify-center p-3 bg-white rounded-lg border">
                      <QRCode value={totpURI} size={200} />
                    </div>
                  )}
                </div>

                {/* Backup codes */}
                {backupCodes.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="font-medium text-sm">Step 2: Save your backup codes</h4>
                    <p className="text-xs text-muted-foreground">
                      Store these somewhere safe — you can use them if you lose access to your app.
                    </p>
                    <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded border font-mono text-sm grid grid-cols-2 gap-1">
                      {backupCodes.map((c, i) => (
                        <span key={i}>{c}</span>
                      ))}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => handleDownloadCodes(backupCodes)}
                    >
                      Download Codes
                    </Button>
                  </div>
                )}

                {/* Verification code input */}
                <div className="space-y-2">
                  <h4 className="font-medium text-sm">Step 3: Enter verification code</h4>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="000000"
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                    onKeyDown={(e) => e.key === "Enter" && handleVerifyCode()}
                    className="w-full px-3 py-2 border rounded-md text-center text-2xl tracking-widest font-mono"
                  />
                </div>
              </div>

              <DialogFooter className="flex gap-3">
                <Button onClick={handleCloseSetup} variant="outline" disabled={isVerifying}>
                  Cancel
                </Button>
                <Button onClick={handleVerifyCode} disabled={isVerifying || code.length < 6}>
                  {isVerifying ? "Verifying..." : "Verify & Enable"}
                </Button>
              </DialogFooter>
            </>
          )}

        </DialogContent>
      </Dialog>

      {/* ── Disable 2FA Dialog ─────────────────────────────────────────────── */}
      <Dialog open={showDisableModal} onOpenChange={handleCloseDisable}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Disable Two-Factor Authentication</DialogTitle>
            <DialogDescription>
              Enter your password to confirm. This will remove the extra layer of security from
              your account.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Disabling 2FA will make your account less secure.
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <label className="text-sm font-medium">Password</label>
              <input
                type="password"
                placeholder="Enter your password"
                value={disablePassword}
                onChange={(e) => {
                  setDisablePassword(e.target.value);
                  setDisablePasswordError("");
                }}
                onKeyDown={(e) => e.key === "Enter" && handleDisable2FA()}
                className="w-full px-3 py-2 border rounded-md"
              />
              {disablePasswordError && (
                <p className="text-sm text-red-600">{disablePasswordError}</p>
              )}
            </div>
          </div>

          <DialogFooter className="flex gap-3">
            <Button onClick={handleCloseDisable} variant="outline" disabled={isDisabling}>
              Cancel
            </Button>
            <Button
              onClick={handleDisable2FA}
              disabled={isDisabling || !disablePassword}
              variant="destructive"
            >
              {isDisabling ? "Disabling..." : "Disable 2FA"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Backup Codes Dialog ────────────────────────────────────────────── */}
      <Dialog open={showBackupCodesModal} onOpenChange={handleCloseBackupCodes}>
        <DialogContent className="sm:max-w-md">
          {backupStep === "password" ? (
            <>
              <DialogHeader>
                <DialogTitle>View Backup Codes</DialogTitle>
                <DialogDescription>
                  Enter your password to view and regenerate your backup codes. This will
                  invalidate any previously generated codes.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Password</label>
                  <input
                    type="password"
                    placeholder="Enter your password"
                    value={backupPassword}
                    onChange={(e) => {
                      setBackupPassword(e.target.value);
                      setBackupPasswordError("");
                    }}
                    onKeyDown={(e) => e.key === "Enter" && handleFetchBackupCodes()}
                    className="w-full px-3 py-2 border rounded-md"
                  />
                  {backupPasswordError && (
                    <p className="text-sm text-red-600">{backupPasswordError}</p>
                  )}
                </div>
              </div>

              <DialogFooter className="flex gap-3">
                <Button onClick={handleCloseBackupCodes} variant="outline" disabled={isRegenerating}>
                  Cancel
                </Button>
                <Button
                  onClick={handleFetchBackupCodes}
                  disabled={isRegenerating || !backupPassword}
                >
                  {isRegenerating ? "Verifying..." : "Continue"}
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Your Backup Codes</DialogTitle>
                <DialogDescription>
                  Each code can only be used once. Store them somewhere safe — these are the only
                  copy.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded border font-mono text-sm grid grid-cols-2 gap-2">
                  {viewBackupCodes.map((c, i) => (
                    <span key={i} className="tracking-wider">{c}</span>
                  ))}
                </div>

                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    These codes have just been regenerated. Any previously saved codes are no
                    longer valid.
                  </AlertDescription>
                </Alert>
              </div>

              <DialogFooter className="flex gap-3">
                <Button variant="outline" onClick={() => handleDownloadCodes(viewBackupCodes)}>
                  Download Codes
                </Button>
                <Button onClick={handleCloseBackupCodes}>Done</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}