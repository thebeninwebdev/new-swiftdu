'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Copy,
  CreditCard,
  ExternalLink,
  Loader2,
  MapPin,
  Package,
  Phone,
  RefreshCw,
  Store,
  UserCheck,
} from 'lucide-react';

type PublicOrder = {
  _id: string;
  taskType: string;
  description: string;
  amount: number;
  commission: number;
  serviceFee: number;
  totalAmount: number;
  location: string;
  deliveryLocation: string;
  store: string;
  status: 'pending' | 'in_progress' | 'paid' | 'completed' | 'cancelled';
  taskerId: string | null;
  taskerName: string | null;
  acceptedAt: string | null;
  createdAt: string | null;
  hasPaid: boolean;
  isDeclinedTask: boolean;
  declinedMessage: string;
  paymentStatus: 'unpaid' | 'initialized' | 'paid' | 'failed' | 'cancelled';
  paymentFailureReason: string;
  cafeInquiry: boolean;
  cafeInquiryFeePaid: boolean;
  cafeInquiryDetailsSubmitted: boolean;
  tasker: {
    name: string;
    phone: string;
    profileImage: string | null;
    bankDetails: {
      bankName: string;
      accountName: string;
      accountNumber: string;
    };
  } | null;
};

const taskTypeLabels: Record<string, string> = {
  restaurant: 'Food order',
  printing: 'Printing',
  shopping: 'Shopping',
  water: 'Water delivery',
  copy_notes: 'Copy notes',
  others: 'Errand',
};

function formatCurrency(value: number) {
  return `NGN ${Number(value || 0).toLocaleString('en-NG')}`;
}

function formatDate(value?: string | null) {
  if (!value) {
    return 'Not available';
  }

  return new Date(value).toLocaleString('en-NG', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function getWhatsAppHref(phone: string) {
  const digits = phone.replace(/\D/g, '');
  return digits ? `https://wa.me/${digits}` : null;
}

function getStatusCopy(order: PublicOrder) {
  if (order.isDeclinedTask) {
    return {
      label: 'Payment under review',
      body:
        order.declinedMessage ||
        'The tasker could not confirm the transfer. SwiftDU support will contact you.',
      tone: 'border-rose-200 bg-rose-50 text-rose-800',
    };
  }

  if (order.status === 'cancelled') {
    return {
      label: 'Order cancelled',
      body: 'This order is no longer active.',
      tone: 'border-slate-200 bg-slate-50 text-slate-700',
    };
  }

  if (order.status === 'completed') {
    return {
      label: 'Order completed',
      body: 'Your tasker has marked this order as complete.',
      tone: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    };
  }

  if (!order.taskerId) {
    return {
      label: 'Finding a tasker',
      body: 'Your order has been posted. This page will update when a tasker accepts it.',
      tone: 'border-amber-200 bg-amber-50 text-amber-800',
    };
  }

  if (!order.hasPaid) {
    return {
      label: 'Tasker accepted',
      body: 'Make the transfer to the tasker account, then confirm payment here.',
      tone: 'border-sky-200 bg-sky-50 text-sky-800',
    };
  }

  return {
    label: 'Payment confirmed',
    body: 'Stay reachable on WhatsApp while your tasker handles the order.',
    tone: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  };
}

export default function TrackingClient({ token }: { token: string }) {
  const [order, setOrder] = useState<PublicOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const loadOrder = useCallback(
    async (showRefreshing = false) => {
      try {
        if (showRefreshing) {
          setRefreshing(true);
        }

        const response = await fetch(`/api/public/orders/${token}`, { cache: 'no-store' });
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload.error || 'Order not found.');
        }

        setOrder(payload.order);
        setError('');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load this order.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [token]
  );

  useEffect(() => {
    void loadOrder();
    const intervalId = window.setInterval(() => void loadOrder(), 12000);

    return () => window.clearInterval(intervalId);
  }, [loadOrder]);

  const status = useMemo(() => (order ? getStatusCopy(order) : null), [order]);
  const needsCafeDetails = Boolean(
    order?.cafeInquiry && order.cafeInquiryFeePaid && !order.cafeInquiryDetailsSubmitted
  );
  const transferAmount =
    order?.cafeInquiry && order.cafeInquiryFeePaid
      ? Number(order.amount || 0)
      : Number(order?.totalAmount || order?.amount || 0);
  const needsPayment = Boolean(
    order?.taskerId && !order?.hasPaid && !order?.isDeclinedTask && !needsCafeDetails
  );
  const whatsappHref = order?.tasker?.phone ? getWhatsAppHref(order.tasker.phone) : null;

  const confirmTransfer = async () => {
    if (!order) {
      return;
    }

    try {
      setConfirming(true);
      setMessage('');
      const response = await fetch(`/api/public/orders/${token}/confirm-transfer`, {
        method: 'POST',
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || 'Failed to confirm payment.');
      }

      setMessage('Payment marked as sent. Keep your WhatsApp open for the tasker.');
      await loadOrder();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to confirm payment.');
    } finally {
      setConfirming(false);
    }
  };

  const copyAccountNumber = async () => {
    const accountNumber = order?.tasker?.bankDetails.accountNumber;

    if (!accountNumber) {
      return;
    }

    await navigator.clipboard.writeText(accountNumber);
    setMessage('Account number copied.');
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-sky-50 px-4 py-10">
        <div className="mx-auto flex min-h-[70vh] max-w-xl items-center justify-center">
          <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
            <Loader2 className="h-5 w-5 animate-spin text-sky-600" />
            <p className="text-sm font-medium text-slate-700">Loading order...</p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-sky-50 px-4 py-6 text-slate-900">
      <div className="mx-auto max-w-2xl space-y-4">
        <header className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-950 text-white">
              <Package className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-sky-700">
                SwiftDU Order Tracking
              </p>
              <h1 className="truncate text-xl font-bold">Track your order</h1>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void loadOrder(true)}
            disabled={refreshing}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50 disabled:opacity-60"
            aria-label="Refresh order"
          >
            <RefreshCw className={`h-5 w-5 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </header>

        {error ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        ) : null}

        {message ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {message}
          </div>
        ) : null}

        {order && status ? (
          <>
            <section className={`rounded-xl border px-4 py-4 ${status.tone}`}>
              <div className="flex items-start gap-3">
                {order.hasPaid || order.status === 'completed' ? (
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
                ) : order.isDeclinedTask ? (
                  <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
                ) : (
                  <Loader2 className="mt-0.5 h-5 w-5 shrink-0 animate-spin" />
                )}
                <div>
                  <p className="font-semibold">{status.label}</p>
                  <p className="mt-1 text-sm leading-6">{status.body}</p>
                </div>
              </div>
            </section>

            <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 px-4 py-3">
                <p className="text-sm font-semibold">
                  {taskTypeLabels[order.taskType] || order.taskType}
                </p>
              </div>
              <div className="space-y-4 p-4">
                <div>
                  <h2 className="text-lg font-bold">
                    {order.description || taskTypeLabels[order.taskType] || 'Order details'}
                  </h2>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-600">
                    <span className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1">
                      <MapPin className="h-3.5 w-3.5" />
                      {order.deliveryLocation || order.location}
                    </span>
                    {order.store ? (
                      <span className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1">
                        <Store className="h-3.5 w-3.5" />
                        {order.store}
                      </span>
                    ) : null}
                  </div>
                </div>

                <div className="rounded-xl bg-slate-950 p-4 text-white">
                  <p className="text-xs text-slate-400">Total amount</p>
                  <p className="mt-1 text-3xl font-bold">{formatCurrency(transferAmount)}</p>
                  <div className="mt-3 flex items-center justify-between gap-3 text-xs text-slate-400">
                    <span>Order: {formatCurrency(order.amount)}</span>
                    <span>Service: {formatCurrency(order.serviceFee || order.commission)}</span>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-slate-200 px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Created
                    </p>
                    <p className="mt-1 text-sm font-medium">{formatDate(order.createdAt)}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Accepted
                    </p>
                    <p className="mt-1 text-sm font-medium">
                      {order.acceptedAt ? formatDate(order.acceptedAt) : 'Waiting for tasker'}
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {needsCafeDetails ? (
              <section className="rounded-xl border border-orange-200 bg-orange-50 p-4 shadow-sm">
                <p className="font-bold text-slate-950">Message your tasker for cafe options</p>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  Your cafe inquiry fee is marked as paid. Use WhatsApp to ask what is available, choose the food, and agree on the budget with your tasker.
                </p>
                {whatsappHref ? (
                  <a
                    href={whatsappHref}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-4 flex h-12 w-full items-center justify-center rounded-xl bg-emerald-600 px-4 text-sm font-bold text-white transition hover:bg-emerald-700"
                  >
                    Open WhatsApp with tasker
                    <ExternalLink className="ml-2 h-4 w-4" />
                  </a>
                ) : null}
              </section>
            ) : null}

            <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-700">
                  <UserCheck className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Accepted by
                  </p>
                  <p className="mt-1 text-base font-bold">
                    {order.taskerName || order.tasker?.name || 'No tasker yet'}
                  </p>
                  {order.tasker?.phone ? (
                    <a
                      href={`tel:${order.tasker.phone}`}
                      className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-sky-700"
                    >
                      <Phone className="h-4 w-4" />
                      {order.tasker.phone}
                    </a>
                  ) : null}
                </div>
                {whatsappHref && (order.hasPaid || needsCafeDetails) ? (
                  <a
                    href={whatsappHref}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-10 shrink-0 items-center justify-center rounded-xl bg-emerald-600 px-3 text-sm font-semibold text-white"
                  >
                    WhatsApp
                  </a>
                ) : null}
              </div>
            </section>

            {needsPayment ? (
              <section className="rounded-xl border border-sky-200 bg-white p-4 shadow-sm">
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-sky-50 text-sky-700">
                    <CreditCard className="h-5 w-5" />
                  </div>
                  <div>
                  <p className="font-bold">Make payment</p>
                    <p className="text-sm text-slate-500">
                      Transfer {formatCurrency(transferAmount)} to the tasker account.
                    </p>
                  </div>
                </div>

                <div className="grid gap-3">
                  <PaymentField label="Bank" value={order.tasker?.bankDetails.bankName} />
                  <PaymentField label="Account name" value={order.tasker?.bankDetails.accountName} />
                  <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-sky-700">
                      Account number
                    </p>
                    <div className="mt-2 flex items-center justify-between gap-3">
                      <p className="text-2xl font-bold tracking-wide">
                        {order.tasker?.bankDetails.accountNumber || 'Not available'}
                      </p>
                      <button
                        type="button"
                        onClick={() => void copyAccountNumber()}
                        disabled={!order.tasker?.bankDetails.accountNumber}
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-sky-700 shadow-sm disabled:opacity-50"
                        aria-label="Copy account number"
                      >
                        <Copy className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => void confirmTransfer()}
                  disabled={confirming || !order.tasker?.bankDetails.accountNumber}
                  className="mt-4 flex h-12 w-full items-center justify-center rounded-xl bg-emerald-600 px-4 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:opacity-60"
                >
                  {confirming ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Updating order...
                    </>
                  ) : (
                    "I've paid"
                  )}
                </button>
              </section>
            ) : null}

            {(order.hasPaid || needsCafeDetails) && whatsappHref ? (
              <a
                href={whatsappHref}
                target="_blank"
                rel="noreferrer"
                className="flex h-12 items-center justify-center rounded-xl bg-emerald-600 px-4 text-sm font-bold text-white"
              >
                Open WhatsApp with tasker
                <ExternalLink className="ml-2 h-4 w-4" />
              </a>
            ) : null}
          </>
        ) : null}
      </div>
    </main>
  );
}

function PaymentField({ label, value }: { label: string; value?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-bold uppercase">{value || 'Not available'}</p>
    </div>
  );
}
