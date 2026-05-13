"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ProfileTab } from "@/components/profile-tab";
import { PasswordTab } from "@/components/password-tab";
import { TransactionTab } from "@/components/transaction-tab";
import { TwoFATab } from "@/components/two-fa-tab";
import { ProfileCompletionCard } from "@/components/profile-completion-card";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { User, Lock, History, Shield } from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
  { id: "profile", label: "Profile", icon: User, color: "text-blue-500", bg: "bg-blue-500/10" },
  { id: "password", label: "Password", icon: Lock, color: "text-amber-500", bg: "bg-amber-500/10" },
  { id: "history", label: "History", icon: History, color: "text-emerald-500", bg: "bg-emerald-500/10" },
  { id: "2fa", label: "2FA", icon: Shield, color: "text-rose-500", bg: "bg-rose-500/10" },
];

export default function AccountPage() {
  const [activeTab, setActiveTab] = useState("profile");

  const activeTabData = tabs.find((t) => t.id === activeTab);

  return (
    <div className="min-h-screen bg-background px-4 py-6 md:py-12 md:px-8">
      <div className="mx-auto w-full max-w-3xl">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="mb-6 md:mb-8"
        >
          <h1 className="text-2xl md:text-4xl font-bold tracking-tight">
            Account Settings
          </h1>
          <p className="text-muted-foreground mt-1.5 md:mt-2 text-sm md:text-base">
            Manage your profile, security, and payment settings
          </p>
        </motion.div>

        <ProfileCompletionCard />

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex w-full flex-col gap-0">
          {/* Tab Navigation - Separate from content, horizontal scroll only here */}
          <div className="relative mb-6 w-full flex-none md:mb-8">
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide -mx-4 px-4 md:mx-0 md:px-0 md:overflow-visible md:pb-0">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;

                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      "relative flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-300 shrink-0 select-none active:scale-95",
                      "border border-transparent",
                      isActive
                        ? "bg-card shadow-md border-border/50 text-foreground"
                        : "bg-transparent text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                    )}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="activeTabIndicator"
                        className={cn("w-2 h-2 rounded-full", tab.bg.replace("/10", ""))}
                        transition={{ type: "spring", stiffness: 400, damping: 30 }}
                      />
                    )}
                    {!isActive && (
                      <Icon className={cn("w-4 h-4 transition-colors", tab.color)} />
                    )}
                    <span>{tab.label}</span>

                    {isActive && (
                      <motion.div
                        layoutId="activeTabBg"
                        className={cn(
                          "absolute inset-0 rounded-xl opacity-10 -z-10",
                          tab.bg.replace("/10", "/20")
                        )}
                        transition={{ type: "spring", stiffness: 400, damping: 30 }}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Tab Content - Completely separate, full width, no horizontal scroll */}
          <div className="relative min-h-[400px] w-full flex-none">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{
                  duration: 0.2,
                  ease: [0.25, 0.46, 0.45, 0.94],
                }}
                className="w-full"
              >
                <TabsContent value={activeTab} className="mt-0 block w-full flex-none">
                  <div className="bg-card rounded-2xl border border-border/50 shadow-sm p-4 md:p-6 w-full">
                    {/* Mobile Context Header */}
                    <div className="flex items-center gap-3 mb-5 md:hidden">
                      <div className={cn("p-2 rounded-lg", activeTabData?.bg)}>
                        {activeTabData && (
                          <activeTabData.icon
                            className={cn("w-5 h-5", activeTabData.color)}
                          />
                        )}
                      </div>
                      <div>
                        <h2 className="font-semibold text-lg">
                          {activeTabData?.label}
                        </h2>
                        <p className="text-xs text-muted-foreground">
                          {activeTab === "profile" && "Update your personal details"}
                          {activeTab === "password" && "Change your security credentials"}
                          {activeTab === "history" && "View your recent activity"}
                          {activeTab === "2fa" && "Secure your account"}
                        </p>
                      </div>
                    </div>

                    {activeTab === "profile" && <ProfileTab />}
                    {activeTab === "password" && <PasswordTab />}
                    {activeTab === "history" && <TransactionTab />}
                    {activeTab === "2fa" && <TwoFATab />}
                  </div>
                </TabsContent>
              </motion.div>
            </AnimatePresence>
          </div>
        </Tabs>
      </div>
    </div>
  );
}
