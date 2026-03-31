"use client";


import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";


type Order = {
  _id: string;
  platformFee: number;
  description: string;
};

export default function TaskerPaymentPage() {
  const router = useRouter();
  const { id } = useParams();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    async function fetchOrder() {
      setLoading(true);
      try {
        const res = await fetch(`/api/orders/${id}`);
        if (!res.ok) throw new Error("Order not found");
        const data = await res.json();
        setOrder(data.order || data);
      } catch (e) {
        toast.error("Failed to fetch order");
        router.push("/tasker-dashboard");
      } finally {
        setLoading(false);
      }
    }
    if (id) fetchOrder();
  }, [id, router]);


  // Replace with actual user email if available
  const userEmail = typeof window !== 'undefined' ? (window.localStorage.getItem('user_email') || 'user@swifdu.com') : 'user@swifdu.com';

  async function handlePay() {
    if (!order) return;
    setPaying(true);
    const { default: PaystackPop } = await import("@paystack/inline-js");
    const paystack = new PaystackPop();
    paystack.newTransaction({
      key: process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY || "pk_test_xxxx", // Set your public key in .env
      email: userEmail,
      amount: order.platformFee * 100, // Paystack expects amount in kobo
      currency: "NGN",
      onSuccess: async (transaction: { reference: string }) => {
        // Mark as paid in backend
        try {
          const res = await fetch(`/api/orders/${id}/pay-platform-fee`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ reference: transaction.reference }),
          });
          if (!res.ok) throw new Error("Payment failed");
          toast.success("Platform fee paid successfully!");
          router.push("/tasker-dashboard");
        } catch (e) {
          toast.error("Payment verification failed");
        } finally {
          setPaying(false);
        }
      },
      onCancel: () => {
        setPaying(false);
        toast("Payment cancelled");
      },
    });
  }

  if (loading) return <div className="p-8 text-center">Loading...</div>;
  if (!order) return <div className="p-8 text-center">Order not found.</div>;

  return (
    <div className="max-w-md mx-auto mt-16 bg-white dark:bg-slate-900 rounded-2xl shadow-lg p-8">
      <h1 className="text-2xl font-bold mb-4">Pay Platform Fee</h1>
      <p className="mb-2">Order ID: <span className="font-mono">{order._id}</span></p>
      <p className="mb-2">Task: <span className="font-semibold">{order.description}</span></p>
      <p className="mb-2">Platform Fee Due: <span className="font-bold text-indigo-600">₦{order.platformFee}</span></p>
      <div className="mt-6">
        <Button onClick={handlePay} disabled={paying} className="w-full h-12 text-lg">
          {paying ? "Processing..." : `Pay ₦${order.platformFee}`}
        </Button>
      </div>
      <p className="mt-4 text-sm text-slate-500">You must pay the platform fee within 24 hours or your account will be suspended.</p>
    </div>
  );
}
