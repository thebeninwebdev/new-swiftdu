"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { getPostAuthRedirect } from "@/lib/profile-completion";
import { toast } from "sonner";
import { ShieldCheck, ArrowRight, RotateCcw } from "lucide-react";

export default function VerifyCodesPage() {
  const router = useRouter();
  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [isVerifying, setIsVerifying] = useState(false);
  const [useBackup, setUseBackup] = useState(false);
  const [backupCode, setBackupCode] = useState("");
  const [shake, setShake] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Auto-focus first input on mount
  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  // ── OTP input handlers ─────────────────────────────────────────────────────
  const handleDigitChange = (index: number, value: string) => {
    // Allow paste of full code
    if (value.length === 6 && /^\d{6}$/.test(value)) {
      const digits = value.split("");
      setCode(digits);
      inputRefs.current[5]?.focus();
      return;
    }

    const digit = value.replace(/\D/g, "").slice(-1);
    const next = [...code];
    next[index] = digit;
    setCode(next);
    if (digit && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
    if (e.key === "Enter") handleVerify();
  };

  const triggerShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 500);
  };

  // ── Verify TOTP ────────────────────────────────────────────────────────────
  const handleVerify = async () => {
    const fullCode = useBackup ? backupCode.trim() : code.join("");

    if (!useBackup && fullCode.length < 6) {
      triggerShake();
      toast.error("Please enter all 6 digits");
      return;
    }
    if (useBackup && !fullCode) {
      triggerShake();
      toast.error("Please enter your backup code");
      return;
    }

    setIsVerifying(true);

    const { error } = useBackup
      ? await authClient.twoFactor.verifyBackupCode({ code: fullCode })
      : await authClient.twoFactor.verifyTotp({ code: fullCode });

    setIsVerifying(false);

    if (error) {
      triggerShake();
      toast.error(error.message ?? "Invalid code — please try again");
      setCode(["", "", "", "", "", ""]);
      setBackupCode("");
      inputRefs.current[0]?.focus();
      return;
    }

    toast.success("Verified! Welcome to SwiftDu.");
    const { data } = await authClient.getSession();
    router.push(getPostAuthRedirect(data?.user));
  };

  return (
    <div className="min-h-screen bg-[#0A0A0F] flex items-center justify-center p-4 overflow-hidden">
      {/* Background grid */}
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />

      {/* Glow */}
      <div
        className="pointer-events-none fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-150 h-150 rounded-full opacity-20"
        style={{
          background: "radial-gradient(circle, #6366f1 0%, transparent 70%)",
          filter: "blur(60px)",
        }}
      />

      <div className="relative z-10 w-full max-w-sm animate-fade-in">
        {/* Card */}
        <div
          className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-8 shadow-2xl"
          style={{ boxShadow: "0 0 0 1px rgba(255,255,255,0.05), 0 32px 64px rgba(0,0,0,0.5)" }}
        >
          {/* Icon */}
          <div className="flex justify-center mb-6">
            <div className="w-14 h-14 rounded-2xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center">
              <ShieldCheck className="w-7 h-7 text-indigo-400" />
            </div>
          </div>

          {/* Heading */}
          <div className="text-center mb-8">
            <h1
              className="text-2xl font-semibold text-white mb-2 tracking-tight"
              style={{ fontFamily: "'DM Sans', sans-serif" }}
            >
              Two-step verification
            </h1>
            <p className="text-sm text-white/50 leading-relaxed">
              {useBackup
                ? "Enter one of your saved backup codes to continue."
                : "Open your authenticator app and enter the 6-digit code."}
            </p>
          </div>

          {/* OTP inputs */}
          {!useBackup ? (
            <div
              className={`flex gap-2 justify-center mb-6 ${shake ? "animate-shake" : ""}`}
            >
              {code.map((digit, i) => (
                <input
                  key={i}
                  ref={(el) => { inputRefs.current[i] = el; }}
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={digit}
                  onChange={(e) => handleDigitChange(i, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(i, e)}
                  onFocus={(e) => e.target.select()}
                  className="w-11 h-14 rounded-xl border border-white/10 bg-white/5 text-white text-center text-xl font-mono font-semibold
                    focus:outline-none focus:border-indigo-500 focus:bg-indigo-500/10 focus:ring-2 focus:ring-indigo-500/20
                    transition-all duration-150 caret-indigo-400"
                />
              ))}
            </div>
          ) : (
            <div className={`mb-6 ${shake ? "animate-shake" : ""}`}>
              <input
                type="text"
                placeholder="xxxxxxxx-xxxx"
                value={backupCode}
                onChange={(e) => setBackupCode(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleVerify()}
                autoFocus
                className="w-full px-4 py-3 rounded-xl border border-white/10 bg-white/5 text-white text-center
                  font-mono tracking-widest placeholder:text-white/20
                  focus:outline-none focus:border-indigo-500 focus:bg-indigo-500/10 focus:ring-2 focus:ring-indigo-500/20
                  transition-all duration-150"
              />
            </div>
          )}

          {/* Verify button */}
          <button
            onClick={handleVerify}
            disabled={isVerifying}
            className="w-full h-12 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed
              text-white font-medium text-sm flex items-center justify-center gap-2
              transition-all duration-150 active:scale-[0.98]"
          >
            {isVerifying ? (
              <span className="flex items-center gap-2">
                <RotateCcw className="w-4 h-4 animate-spin" />
                Verifying…
              </span>
            ) : (
              <span className="flex items-center gap-2">
                Continue
                <ArrowRight className="w-4 h-4" />
              </span>
            )}
          </button>

          {/* Toggle backup / TOTP */}
          <div className="mt-5 text-center">
            <button
              onClick={() => {
                setUseBackup(!useBackup);
                setCode(["", "", "", "", "", ""]);
                setBackupCode("");
              }}
              className="text-xs text-white/40 hover:text-white/70 transition-colors duration-150 underline underline-offset-4"
            >
              {useBackup
                ? "Use authenticator app instead"
                : "Lost access to your app? Use a backup code"}
            </button>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-white/25 mt-6">
          SwiftDu · Secured with 2FA
        </p>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&display=swap');

        @keyframes fade-in {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
          animation: fade-in 0.4s cubic-bezier(0.16, 1, 0.3, 1) both;
        }

        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20%       { transform: translateX(-6px); }
          40%       { transform: translateX(6px); }
          60%       { transform: translateX(-4px); }
          80%       { transform: translateX(4px); }
        }
        .animate-shake {
          animation: shake 0.45s cubic-bezier(0.36, 0.07, 0.19, 0.97) both;
        }
      `}</style>
    </div>
  );
}
