"use client";

import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";
import { useRouter } from "next/navigation";

export default function DashboardNotifications() {
  const [hasNotification, setHasNotification] = useState(false);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    async function fetchOrders() {
      setLoading(true);
      try {
        const res = await fetch("/api/orders");
        if (!res.ok) throw new Error("Failed to fetch orders");
        const orders = await res.json();
        // Notification: unpaid, accepted (has taskerId)
        const hasUnpaidAccepted = orders.some(
          (order: { hasPaid: boolean; taskerId?: string }) => order.hasPaid === false && !!order.taskerId
        );
        setHasNotification(hasUnpaidAccepted);
      } catch {
        setHasNotification(false);
      } finally {
        setLoading(false);
      }
    }
    fetchOrders();
  }, []);

  return (
    <div className="flex flex-col items-center justify-center h-full p-8">
      <AlertCircle className="w-12 h-12 text-indigo-600 mb-4" />
      <h2 className="text-xl font-bold mb-2">Notifications</h2>
      {loading ? (
        <p>Loading...</p>
      ) : hasNotification ? (
        <div className="bg-yellow-100 border border-yellow-300 text-yellow-800 rounded-lg p-4 flex flex-col items-center">
          <p className="mb-2 font-medium">A tasker has accepted your task!</p>
          <p className="mb-4">Please make payment to proceed with your order.</p>
          <Button onClick={() => router.push("/dashboard/tasks")}>Go to My Tasks</Button>
        </div>
      ) : (
        <p className="text-slate-500">No notifications at this time.</p>
      )}
    </div>
  );
}
