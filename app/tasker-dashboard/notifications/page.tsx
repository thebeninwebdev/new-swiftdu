"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";

interface UnpaidOrder {
  _id: string;
  platformFee: number;
  description: string;
}

export default function TaskerNotificationsPage() {
  const [orders, setOrders] = useState<UnpaidOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchUnpaid() {
      setLoading(true);
      const res = await fetch("/api/taskers/unpaid-platform-fees");
      if (res.ok) {
        const data = await res.json();
        setOrders(data.orders || []);
      }
      setLoading(false);
    }
    fetchUnpaid();
  }, []);

  return (
    <div className="max-w-2xl mx-auto mt-12 p-6 bg-white dark:bg-slate-900 rounded-2xl shadow-lg">
      <h1 className="text-2xl font-bold mb-6 flex items-center gap-2">
        <Bell className="h-6 w-6 text-yellow-500" />
        Unpaid Platform Fee Notifications
      </h1>
      {loading ? (
        <div>Loading...</div>
      ) : orders.length === 0 ? (
        <div className="text-green-600 font-medium">No unpaid platform fees. You&apos;re all set!</div>
      ) : (
        <ul className="space-y-6">
          {orders.map(order => (
            <li key={order._id} className="bg-yellow-50 dark:bg-yellow-900/40 border border-yellow-300 dark:border-yellow-700 rounded-lg p-4 flex flex-col gap-2">
              <div>
                <span className="font-semibold">Task:</span> {order.description}
              </div>
              <div>
                <span className="font-semibold">Platform Fee Due:</span> <span className="text-indigo-600 font-bold">₦{order.platformFee}</span>
              </div>
              <div className="text-sm text-yellow-900 dark:text-yellow-100">
                You must pay the platform fee within 24hrs or your account will be suspended.
              </div>
              <div>
                <Link href={`/tasker-dashboard/payment/${order._id}`}>
                  <Button className="mt-2">Pay Now</Button>
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
