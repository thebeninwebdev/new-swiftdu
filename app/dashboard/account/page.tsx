"use client";

import { useState } from "react";
import { ProfileTab } from "@/components/profile-tab";
import { PasswordTab } from "@/components/password-tab";
import { WalletTab } from "@/components/wallet-tab";
import { TransactionTab } from "@/components/transaction-tab";
import { TwoFATab } from "@/components/two-fa-tab";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { User, Lock, Wallet, History, Shield } from "lucide-react";

export default function AccountPage() {
  const [activeTab, setActiveTab] = useState("profile");

  return (
    <div className="min-h-screen bg-background px-4 py-12 md:px-8">
      <div className="mx-auto w-full max-w-3xl">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-4xl font-bold tracking-tight">Account Settings</h1>
            <p className="text-muted-foreground mt-2">
              Manage your profile, security, and payment settings
            </p>
          </div>
          {/* Tabs at the top */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full flex flex-col">
            <TabsList className="grid w-full grid-cols-3 lg:grid-cols-6 mb-8">
              <TabsTrigger value="profile" className="flex items-center gap-2">
                <User className="w-4 h-4 hidden sm:block" />
                <span className="hidden sm:inline">Profile</span>
                <span className="sm:hidden">Profile</span>
              </TabsTrigger>
              <TabsTrigger value="password" className="flex items-center gap-2">
                <Lock className="w-4 h-4 hidden sm:block" />
                <span className="hidden sm:inline">Password</span>
                <span className="sm:hidden">Password</span>
              </TabsTrigger>
              {/* <TabsTrigger value="wallet" className="flex items-center gap-2">
                <Wallet className="w-4 h-4 hidden sm:block" />
                <span className="hidden sm:inline">Wallet</span>
                <span className="sm:hidden">Wallet</span>
              </TabsTrigger> */}
              <TabsTrigger value="history" className="flex items-center gap-2">
                <History className="w-4 h-4 hidden sm:block" />
                <span className="hidden sm:inline">History</span>
                <span className="sm:hidden">History</span>
              </TabsTrigger>
              <TabsTrigger value="2fa" className="flex items-center gap-2">
                <Shield className="w-4 h-4 hidden sm:block" />
                <span className="hidden sm:inline">2FA</span>
                <span className="sm:hidden">2FA</span>
              </TabsTrigger>
            </TabsList>
            {/* Tab Contents */}
            <div className="space-y-6">
              <TabsContent value="profile" className="mt-0">
                <ProfileTab />
              </TabsContent>
              <TabsContent value="password" className="mt-0">
                <PasswordTab />
              </TabsContent>
              <TabsContent value="history" className="mt-0">
                <TransactionTab />
              </TabsContent>
              <TabsContent value="2fa" className="mt-0">
                <TwoFATab />
              </TabsContent>
            </div>
          </Tabs>
      </div>
    </div>
  );
}
