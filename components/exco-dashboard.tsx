"use client";

import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Activity,
  ArrowLeft,
  BadgeDollarSign,
  BarChart3,
  BriefcaseBusiness,
  CheckCircle2,
  Cpu,
  LineChart,
  Loader2,
  Megaphone,
  MessageCircle,
  PlusCircle,
  ShieldAlert,
  TrendingUp,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { EXCO_ROLE_LABELS, type ExcoRole } from "@/lib/exco-constants";

type CountDatum = {
  label: string;
  count: number;
};

type CardDatum = {
  label: string;
  value: number;
  format: "number" | "currency" | "percent" | "minutes";
  description: string;
};

type InsightDatum = {
  label: string;
  value: string | number;
  format: "number" | "currency" | "percent" | "minutes" | "text";
  description: string;
  severity: "good" | "warning" | "critical" | "info";
};

type DashboardData = {
  role: ExcoRole;
  range: {
    days: number;
    since: string;
    key?: string;
    label?: string;
  };
  cards: CardDatum[];
  insights: InsightDatum[];
  finance: {
    currentMoney: {
      totalAmount: number;
      amount: number;
      serviceFee: number;
      platformFee: number;
      paystackSettlementFee: number;
      netPlatformProfit: number;
      approvedExpenditures: number;
      businessProfit: number;
      taskerFee: number;
      waterFee: number;
    };
    completedMoney: {
      totalAmount: number;
      amount: number;
      serviceFee: number;
      platformFee: number;
      paystackSettlementFee: number;
      netPlatformProfit: number;
      approvedExpenditures: number;
      businessProfit: number;
      taskerFee: number;
      waterFee: number;
    };
    previousMoney: {
      totalAmount: number;
      platformFee: number;
      paystackSettlementFee?: number;
      netPlatformProfit?: number;
    };
    outstandingPlatformFees: number;
    unsettledTaskers: Array<{
      taskerId: string;
      taskerName: string;
      taskerEmail: string;
      taskerPhone: string;
      isSettlementSuspended: boolean;
      totalOutstanding: number;
      taskCount: number;
      overdueCount: number;
      oldestDueAt: string | null;
      latestCompletedAt: string | null;
      tasks: Array<{
        orderId: string;
        description: string;
        taskType: string;
        platformFee: number;
        settlementStatus: string;
        settlementDueAt: string | null;
        completedAt: string | null;
      }>;
    }>;
    activeFinanceTasks: Array<{
      orderId: string;
      taskerId: string;
      taskerName: string;
      taskerEmail: string;
      taskerPhone: string;
      taskType: string;
      description: string;
      location: string;
      status: string;
      platformFee: number;
      totalAmount: number;
      acceptedAt: string | null;
      paidAt: string | null;
      bookedAt: string | null;
    }>;
    cancelledFinanceOrders: Array<{
      orderId: string;
      taskType: string;
      description: string;
      location: string;
      userId: string;
      userName: string;
      userEmail: string;
      taskerId: string;
      taskerName: string;
      amount: number;
      platformFee: number;
      totalAmount: number;
      cancelledAt: string | null;
      bookedAt: string | null;
    }>;
  };
  operations: {
    totalOrders: number;
    previousOrders: number;
    completedOrders: number;
    pendingOrders: number;
    activeOrders: number;
    cancelledOrders: number;
    declinedTasks: number;
    activeTaskers: number;
    completionRate: number;
    averageResponseMinutes: number;
    reviews: number;
    recentActivity: Array<{
      id: string;
      type: "order" | "tasker" | "review" | "cancelled" | "declined";
      message: string;
      timestamp: string;
      status?: string;
    }>;
  };
  technology: {
    paymentFailures: number;
    suspendedTaskers: number;
    deviceBreakdown: CountDatum[];
    browserBreakdown: CountDatum[];
  };
  marketing: {
    totalUsers: number;
    newUsers: number;
    conversionRate: number;
    conversionsTotal: number;
    analytics: {
      totalPageViews: number;
      uniqueVisitors: number;
      bounceRate: number;
      topPages: CountDatum[];
      topReferralSources: CountDatum[];
      topCountries: CountDatum[];
      deviceBreakdown: CountDatum[];
      browserBreakdown: CountDatum[];
      conversionEvents: CountDatum[];
      trafficChart: Array<{
        date: string;
        pageViews: number;
        uniqueVisitors: number;
      }>;
    };
  };
  charts: {
    orderTrend: Array<{
      date: string;
      orders: number;
      completed: number;
      revenue: number;
    }>;
    statusBreakdown: CountDatum[];
    categoryBreakdown: CountDatum[];
    locationDemand: CountDatum[];
    settlementBreakdown: CountDatum[];
    paymentBreakdown: CountDatum[];
  };
};

type ExpenditureApprovalRole = "CFO" | "CMO" | "COO" | "CTO" | "CEO";

type ExpenditureItem = {
  id: string;
  title: string;
  amount: number;
  category: string;
  notes: string;
  status: "pending" | "approved";
  requiredApprovals: ExpenditureApprovalRole[];
  approvals: Array<{
    role: ExpenditureApprovalRole;
    approvedByName?: string;
    approvedAt: string;
  }>;
  pendingApprovals: ExpenditureApprovalRole[];
  createdByName: string;
  approvedAt: string | null;
  createdAt: string | null;
};

const ROLE_CONFIG = {
  CFO: {
    title: "Finance Dashboard",
    kicker: "CFO workspace",
    description: "Revenue, fees, settlements, payment risk, and finance follow-up priorities.",
    icon: BadgeDollarSign,
    accent: "text-emerald-600",
    badge: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  CMO: {
    title: "Marketing Dashboard",
    kicker: "CMO workspace",
    description: "Traffic analytics, acquisition sources, conversion events, and demand signals.",
    icon: Megaphone,
    accent: "text-rose-600",
    badge: "bg-rose-50 text-rose-700 border-rose-200",
  },
  COO: {
    title: "Operations Dashboard",
    kicker: "COO workspace",
    description: "Order throughput, fulfillment pace, tasker coverage, and service bottlenecks.",
    icon: BriefcaseBusiness,
    accent: "text-blue-600",
    badge: "bg-blue-50 text-blue-700 border-blue-200",
  },
  CTO: {
    title: "Technology Dashboard",
    kicker: "CTO workspace",
    description: "Product health signals, traffic load, payment failures, device mix, and risk queues.",
    icon: Cpu,
    accent: "text-violet-600",
    badge: "bg-violet-50 text-violet-700 border-violet-200",
  },
} satisfies Record<ExcoRole, {
  title: string;
  kicker: string;
  description: string;
  icon: typeof Activity;
  accent: string;
  badge: string;
}>;

const CFO_PAGE_SIZE = 5;
const CMO_RANGE_OPTIONS = [
  { value: "24h", label: "Last 24 hours" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "3mo", label: "Last 3 months" },
  { value: "12mo", label: "Last 12 months" },
  { value: "24mo", label: "Last 24 months" },
] as const;

function usePagedItems<T>(items: T[], pageSize = CFO_PAGE_SIZE) {
  const [page, setPage] = useState(1);
  const pageCount = Math.max(Math.ceil(items.length / pageSize), 1);
  const safePage = Math.min(page, pageCount);

  const pageItems = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, safePage, pageSize]);

  return {
    page: safePage,
    pageCount,
    pageItems,
    setPage,
    startItem: items.length === 0 ? 0 : (safePage - 1) * pageSize + 1,
    endItem: Math.min(safePage * pageSize, items.length),
    totalItems: items.length,
  };
}

function formatValue(value: string | number, format: InsightDatum["format"]) {
  if (format === "text") return String(value);

  const numericValue = typeof value === "number" ? value : Number(value);

  if (format === "currency") {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
      maximumFractionDigits: 0,
    }).format(numericValue);
  }

  if (format === "percent") return `${numericValue.toLocaleString()}%`;
  if (format === "minutes") return `${numericValue.toLocaleString()} min`;
  return new Intl.NumberFormat("en").format(numericValue);
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-950/50 dark:text-slate-400">
      {label}
    </div>
  );
}

function PaginationControls({
  page,
  pageCount,
  startItem,
  endItem,
  totalItems,
  onPageChange,
}: {
  page: number;
  pageCount: number;
  startItem: number;
  endItem: number;
  totalItems: number;
  onPageChange: (page: number) => void;
}) {
  if (totalItems <= CFO_PAGE_SIZE) return null;

  return (
    <div className="mt-4 flex flex-col gap-3 border-t border-slate-100 pt-4 text-sm dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-slate-500 dark:text-slate-400">
        Showing {startItem}-{endItem} of {totalItems}
      </p>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          Previous
        </Button>
        <span className="rounded-md bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 dark:bg-slate-900 dark:text-slate-300">
          Page {page} of {pageCount}
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={page >= pageCount}
          onClick={() => onPageChange(page + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}

function MetricCard({ item }: { item: CardDatum }) {
  return (
    <Card className="border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
      <CardHeader className="space-y-2">
        <CardDescription>{item.label}</CardDescription>
        <CardTitle className="text-2xl font-bold">
          {formatValue(item.value, item.format)}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-slate-500 dark:text-slate-400">{item.description}</p>
      </CardContent>
    </Card>
  );
}

type ExcoTasker = {
  id: string;
  name: string;
  email: string;
  phone: string;
  location: string;
  bankDetails: {
    bankName: string;
    accountNumber: string;
    accountName: string;
  };
  isVerified: boolean;
  isRejected: boolean;
  isSettlementSuspended: boolean;
  completedTasks: number;
  rating: number;
};

type ExcoDryCleaner = {
  id: string;
  businessName: string;
  ownerName: string;
  email: string;
  phone: string;
  location: string;
  businessLogo?: string;
  status: "pending" | "approved" | "rejected";
  pricing: {
    shirt: number;
    trouser: number;
    hoodieMin: number;
    hoodieMax: number;
    bedsheetMin: number;
    bedsheetMax: number;
    duvetMin?: number;
    duvetMax?: number;
    underwear?: number;
    shoes?: number;
    doesNotWashShirt?: boolean;
    doesNotWashTrouser?: boolean;
    doesNotWashHoodie?: boolean;
    doesNotWashBedsheet?: boolean;
    doesNotWashDuvet?: boolean;
    doesNotWashUnderwear?: boolean;
    doesNotWashShoes?: boolean;
  };
  availability: {
    acceptingDays: string[];
    expectedDeliveryDays: number;
    cutoffTime: string;
    temporarilyClosed: boolean;
  };
  notes: string;
  createdAt: string;
};

type ExcoReview = {
  id: string;
  rating: number;
  comment: string;
  userName: string;
  userEmail: string;
  taskerName: string;
  createdAt: string;
};

type ExcoUser = {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  emailVerified: boolean;
  isSuspended: boolean;
  serviceFeeDiscountEnabled: boolean;
  serviceFeeDiscountGrantedByName: string;
  serviceFeeDiscountGrantedByPhone: string;
  serviceFeeDiscountRemainingOrders: number;
  dateOfBirth: string | null;
  orderCount: number;
  createdAt: string;
};

const hasActiveServiceFeeDiscount = (user: ExcoUser) =>
  Boolean(
    user.serviceFeeDiscountEnabled &&
      Number(user.serviceFeeDiscountRemainingOrders || 0) > 0
  );

type ExcoOrder = {
  id: string;
  taskType: string;
  description: string;
  location: string;
  status: string;
  totalAmount: number;
  taskerId: string;
  taskerName: string;
  taskerEmail: string;
  taskerPhone: string;
  userName: string;
  userEmail: string;
  acceptedAt: string | null;
  createdAt: string | null;
};

type ExcoFailedSettlement = {
  id: string;
  orderDescription: string;
  taskType: string;
  location: string;
  amount: number;
  store: string;
  status: string;
  customerName: string;
  customerEmail: string;
  taskerId: string;
  taskerName: string;
  taskerEmail: string;
  taskerPhone: string;
  acceptedAt: string | null;
  createdAt: string | null;
  description: string;
  settlementFailureReason: string;
  paymentStatus: string;
  settlementStatus: string;
};

type ExcoSupportTicket = {
  id: string;
  title: string;
  description: string;
  category: string;
  priority: string;
  status: string;
  taskerName: string;
  taskerEmail: string;
  taskerPhone: string;
  createdAt: string;
};

function useManagementResource<T>(resource: string, enabled: boolean) {
  const [items, setItems] = useState<T[]>([]);
  const [isLoading, setIsLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!enabled) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/exco/management?resource=${resource}`, {
        cache: "no-store",
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || "Unable to load management data.");
      }

      setItems((payload.items || []) as T[]);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load management data.");
    } finally {
      setIsLoading(false);
    }
  }, [enabled, resource]);

  useEffect(() => {
    void load();
  }, [load]);

  return { items, isLoading, error, reload: load };
}

async function patchManagement(resource: string, body: Record<string, unknown>) {
  const response = await fetch(`/api/exco/management?resource=${resource}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.error || "Action failed.");
  }
}

function dryCleanerPriceLabel(doesNotWash: boolean | undefined, value: string) {
  return doesNotWash === true ? `Not accepted - ${value}` : value;
}

function ManagementShell({
  title,
  description,
  isLoading,
  error,
  emptyLabel,
  hasItems,
  children,
}: {
  title: string;
  description: string;
  isLoading: boolean;
  error: string | null;
  emptyLabel: string;
  hasItems: boolean;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <EmptyState label="Loading..." />
        ) : error ? (
          <EmptyState label={error} />
        ) : !hasItems ? (
          <EmptyState label={emptyLabel} />
        ) : (
          children
        )}
      </CardContent>
    </Card>
  );
}

function ExcoManagementPanels({ role }: { role: ExcoRole }) {
  if (role === "COO") {
    return (
      <div className="space-y-4">
        <AssignedTasksPanel canCancel />
        <TaskerManagementPanel canModerate />
        <DryCleanerManagementPanel canModerate />
        <UserManagementPanel title="User Management" allowSuspension={false} />
        <ReviewsPanel />
      </div>
    );
  }

  if (role === "CFO") {
    return (
      <div className="space-y-4">
        <UserManagementPanel title="Customer Discounts" allowSuspension={false} />
        <TaskerManagementPanel canModerate={false} />
      </div>
    );
  }

  if (role === "CTO") {
    return (
      <div className="space-y-4">
        <FailedSettlementsPanel />
        <AssignedTasksPanel canCancel={false} />
        <TaskerManagementPanel canModerate={false} />
        <UserManagementPanel title="User Management" allowSuspension />
        <SupportTicketsPanel />
      </div>
    );
  }

  if (role === "CMO") {
    return (
      <div className="space-y-4">
        <UserManagementPanel title="Audience Birthdays & Ages" allowSuspension={false} />
      </div>
    );
  }

  return null;
}

function DryCleanerManagementPanel({ canModerate }: { canModerate: boolean }) {
  const { items, isLoading, error, reload } = useManagementResource<ExcoDryCleaner>("dry-cleaners", true);
  const paged = usePagedItems(items);
  const [actionId, setActionId] = useState<string | null>(null);

  const runAction = async (id: string, action: "approve" | "reject" | "close" | "reopen") => {
    setActionId(`${id}-${action}`);
    try {
      await patchManagement("dry-cleaners", { id, action });
      await reload();
    } finally {
      setActionId(null);
    }
  };

  return (
    <ManagementShell
      title="Dry Cleaner Management"
      description="Approve laundry providers and monitor their prices, accepting days, and delivery timeline."
      isLoading={isLoading}
      error={error}
      emptyLabel="No dry cleaners found"
      hasItems={items.length > 0}
    >
      <div className="space-y-3">
        {paged.pageItems.map((dryCleaner) => (
          <div key={dryCleaner.id} className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex items-start gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50 text-sm font-bold text-slate-500 dark:border-slate-800 dark:bg-slate-900">
                  {dryCleaner.businessLogo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={dryCleaner.businessLogo} alt={`${dryCleaner.businessName} logo`} className="h-full w-full object-cover" />
                  ) : (
                    dryCleaner.businessName.charAt(0).toUpperCase()
                  )}
                </div>
                <div>
                  <p className="font-semibold text-slate-950 dark:text-white">{dryCleaner.businessName}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {dryCleaner.ownerName} - {dryCleaner.email} - {dryCleaner.phone}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">{dryCleaner.location}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Badge variant="outline">{dryCleaner.status}</Badge>
                    {dryCleaner.availability.temporarilyClosed ? <Badge variant="destructive">closed</Badge> : null}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-end">
                {canModerate && dryCleaner.status !== "approved" ? (
                  <Button size="sm" onClick={() => runAction(dryCleaner.id, "approve")} disabled={Boolean(actionId)}>
                    Approve
                  </Button>
                ) : null}
                {canModerate && dryCleaner.status !== "rejected" ? (
                  <Button size="sm" variant="outline" onClick={() => runAction(dryCleaner.id, "reject")} disabled={Boolean(actionId)}>
                    Reject
                  </Button>
                ) : null}
                {canModerate && dryCleaner.status === "approved" ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => runAction(dryCleaner.id, dryCleaner.availability.temporarilyClosed ? "reopen" : "close")}
                    disabled={Boolean(actionId)}
                  >
                    {dryCleaner.availability.temporarilyClosed ? "Reopen" : "Close"}
                  </Button>
                ) : null}
              </div>
            </div>
            <div className="mt-3 grid gap-2 md:grid-cols-3">
              <div className="rounded-md bg-slate-50 p-2 text-xs text-slate-600 dark:bg-slate-900 dark:text-slate-300">
                Shirt: {dryCleanerPriceLabel(dryCleaner.pricing.doesNotWashShirt, `NGN ${dryCleaner.pricing.shirt.toLocaleString()}`)}
              </div>
              <div className="rounded-md bg-slate-50 p-2 text-xs text-slate-600 dark:bg-slate-900 dark:text-slate-300">
                Trouser: {dryCleanerPriceLabel(dryCleaner.pricing.doesNotWashTrouser, `NGN ${dryCleaner.pricing.trouser.toLocaleString()}`)}
              </div>
              <div className="rounded-md bg-slate-50 p-2 text-xs text-slate-600 dark:bg-slate-900 dark:text-slate-300">
                Hoodie/Joggers: {dryCleanerPriceLabel(dryCleaner.pricing.doesNotWashHoodie, `NGN ${dryCleaner.pricing.hoodieMin.toLocaleString()}-${dryCleaner.pricing.hoodieMax.toLocaleString()}`)}
              </div>
              <div className="rounded-md bg-slate-50 p-2 text-xs text-slate-600 dark:bg-slate-900 dark:text-slate-300">
                Bedsheet: {dryCleanerPriceLabel(dryCleaner.pricing.doesNotWashBedsheet, `NGN ${dryCleaner.pricing.bedsheetMin.toLocaleString()}-${dryCleaner.pricing.bedsheetMax.toLocaleString()}`)}
              </div>
              <div className="rounded-md bg-slate-50 p-2 text-xs text-slate-600 dark:bg-slate-900 dark:text-slate-300">
                Duvet: {dryCleanerPriceLabel(dryCleaner.pricing.doesNotWashDuvet !== false, `NGN ${(dryCleaner.pricing.duvetMin || 2000).toLocaleString()}-${(dryCleaner.pricing.duvetMax || 2500).toLocaleString()}`)}
              </div>
              <div className="rounded-md bg-slate-50 p-2 text-xs text-slate-600 dark:bg-slate-900 dark:text-slate-300">
                Underwear: {dryCleanerPriceLabel(dryCleaner.pricing.doesNotWashUnderwear !== false, `NGN ${(dryCleaner.pricing.underwear || 500).toLocaleString()}`)}
              </div>
              <div className="rounded-md bg-slate-50 p-2 text-xs text-slate-600 dark:bg-slate-900 dark:text-slate-300">
                Shoes: {dryCleanerPriceLabel(dryCleaner.pricing.doesNotWashShoes !== false, `NGN ${(dryCleaner.pricing.shoes || 500).toLocaleString()}`)}
              </div>
              <div className="rounded-md bg-slate-50 p-2 text-xs capitalize text-slate-600 dark:bg-slate-900 dark:text-slate-300 md:col-span-2">
                Accepts: {dryCleaner.availability.acceptingDays.join(", ")}
              </div>
              <div className="rounded-md bg-slate-50 p-2 text-xs text-slate-600 dark:bg-slate-900 dark:text-slate-300">
                Delivery: {dryCleaner.availability.expectedDeliveryDays} day(s), cutoff {dryCleaner.availability.cutoffTime}
              </div>
            </div>
          </div>
        ))}
      </div>
      <PaginationControls {...paged} onPageChange={paged.setPage} />
    </ManagementShell>
  );
}

function TaskerManagementPanel({ canModerate }: { canModerate: boolean }) {
  const { items, isLoading, error, reload } = useManagementResource<ExcoTasker>("taskers", true);
  const paged = usePagedItems(items);
  const [actionId, setActionId] = useState<string | null>(null);
  const [bankEdits, setBankEdits] = useState<Record<string, ExcoTasker["bankDetails"]>>({});

  const runAction = async (id: string, action: "approve" | "reject" | "suspend" | "activate") => {
    setActionId(`${id}-${action}`);
    try {
      await patchManagement("taskers", { id, action });
      await reload();
    } finally {
      setActionId(null);
    }
  };

  const saveBankDetails = async (tasker: ExcoTasker) => {
    setActionId(`${tasker.id}-bank`);
    try {
      await patchManagement("taskers", {
        id: tasker.id,
        bankDetails: bankEdits[tasker.id] ?? tasker.bankDetails,
      });
      await reload();
    } finally {
      setActionId(null);
    }
  };

  return (
    <ManagementShell
      title="Tasker Management"
      description={
        canModerate
          ? "Approve, reject, suspend, restore, or update tasker bank details."
          : "Review taskers and update their bank details."
      }
      isLoading={isLoading}
      error={error}
      emptyLabel="No taskers found"
      hasItems={items.length > 0}
    >
      <div className="space-y-3">
        {paged.pageItems.map((tasker) => (
          <div key={tasker.id} className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="font-semibold text-slate-950 dark:text-white">{tasker.name}</p>
                <p className="mt-1 text-xs text-slate-500">{tasker.email} - {tasker.phone}</p>
                <p className="mt-1 text-xs text-slate-500">{tasker.location}</p>
                <div className="mt-3 grid gap-2 md:grid-cols-4">
                  <input
                    value={(bankEdits[tasker.id] ?? tasker.bankDetails).bankName}
                    onChange={(event) =>
                      setBankEdits((previous) => ({
                        ...previous,
                        [tasker.id]: {
                          ...(previous[tasker.id] ?? tasker.bankDetails),
                          bankName: event.target.value,
                        },
                      }))
                    }
                    className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm dark:border-slate-800 dark:bg-slate-950"
                    placeholder="Bank name"
                  />
                  <input
                    value={(bankEdits[tasker.id] ?? tasker.bankDetails).accountNumber}
                    onChange={(event) =>
                      setBankEdits((previous) => ({
                        ...previous,
                        [tasker.id]: {
                          ...(previous[tasker.id] ?? tasker.bankDetails),
                          accountNumber: event.target.value.replace(/\D/g, "").slice(0, 10),
                        },
                      }))
                    }
                    className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm dark:border-slate-800 dark:bg-slate-950"
                    placeholder="Account number"
                  />
                  <input
                    value={(bankEdits[tasker.id] ?? tasker.bankDetails).accountName}
                    onChange={(event) =>
                      setBankEdits((previous) => ({
                        ...previous,
                        [tasker.id]: {
                          ...(previous[tasker.id] ?? tasker.bankDetails),
                          accountName: event.target.value,
                        },
                      }))
                    }
                    className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm dark:border-slate-800 dark:bg-slate-950"
                    placeholder="Account name"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={Boolean(actionId)}
                    onClick={() => saveBankDetails(tasker)}
                  >
                    {actionId === `${tasker.id}-bank` ? "Saving..." : "Save Bank"}
                  </Button>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Badge variant="outline">{tasker.isVerified ? "approved" : tasker.isRejected ? "rejected" : "pending"}</Badge>
                  {tasker.isSettlementSuspended ? <Badge variant="destructive">suspended</Badge> : null}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-end">
                {canModerate && !tasker.isVerified ? (
                  <Button size="sm" onClick={() => runAction(tasker.id, "approve")} disabled={Boolean(actionId)}>
                    Approve
                  </Button>
                ) : null}
                {canModerate && !tasker.isRejected ? (
                  <Button size="sm" variant="outline" onClick={() => runAction(tasker.id, "reject")} disabled={Boolean(actionId)}>
                    Reject
                  </Button>
                ) : null}
                {canModerate && tasker.isVerified ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => runAction(tasker.id, tasker.isSettlementSuspended ? "activate" : "suspend")}
                    disabled={Boolean(actionId)}
                  >
                    {tasker.isSettlementSuspended ? "Restore" : "Suspend"}
                  </Button>
                ) : null}
              </div>
            </div>
          </div>
        ))}
      </div>
      <PaginationControls {...paged} onPageChange={paged.setPage} />
    </ManagementShell>
  );
}

function FailedSettlementsPanel() {
  const { items, isLoading, error, reload } = useManagementResource<ExcoFailedSettlement>(
    "failed-settlements",
    true
  );
  const paged = usePagedItems(items);
  const [actionId, setActionId] = useState<string | null>(null);

  const verifySettlement = async (order: ExcoFailedSettlement) => {
    setActionId(order.id);
    try {
      await patchManagement("failed-settlements", {
        id: order.id,
        action: "verify-settlement",
      });
      await reload();
    } finally {
      setActionId(null);
    }
  };

  return (
    <ManagementShell
      title="Failed Tasker Settlements"
      description="Review failed settlement records and manually verify transactions whose settlement status is wrong."
      isLoading={isLoading}
      error={error}
      emptyLabel="No failed tasker settlements found"
      hasItems={items.length > 0}
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1200px] text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-xs uppercase text-slate-500 dark:border-slate-800 dark:text-slate-400">
              <th className="pb-3 pr-4 font-semibold">Order</th>
              <th className="pb-3 pr-4 font-semibold">Customer</th>
              <th className="pb-3 pr-4 font-semibold">Tasker Assigned</th>
              <th className="pb-3 pr-4 font-semibold">Task Details</th>
              <th className="pb-3 pr-4 font-semibold">Failure</th>
              <th className="pb-3 pr-4 font-semibold">Statuses</th>
              <th className="pb-3 pr-4 font-semibold">Action</th>
            </tr>
          </thead>
          <tbody>
            {paged.pageItems.map((order) => (
              <tr key={order.id} className="border-b border-slate-100 align-top dark:border-slate-900">
                <td className="py-4 pr-4">
                  <div className="max-w-[18rem] font-semibold text-slate-950 dark:text-white">
                    {order.orderDescription}
                  </div>
                  <p className="mt-1 font-mono text-xs text-slate-500">{order.id}</p>
                  <p className="mt-2 text-xs text-slate-500">
                    Created {formatDate(order.createdAt)}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Accepted {formatDate(order.acceptedAt)}
                  </p>
                </td>
                <td className="py-4 pr-4">
                  <div className="font-medium text-slate-900 dark:text-white">
                    {order.customerName}
                  </div>
                  {order.customerEmail ? (
                    <p className="mt-1 text-xs text-slate-500">{order.customerEmail}</p>
                  ) : null}
                </td>
                <td className="py-4 pr-4">
                  <div className="font-medium text-slate-900 dark:text-white">
                    {order.taskerName}
                  </div>
                  <div className="mt-1 space-y-0.5 text-xs text-slate-500">
                    {order.taskerEmail ? <p>{order.taskerEmail}</p> : null}
                    {order.taskerPhone ? <p>{order.taskerPhone}</p> : null}
                    {!order.taskerId ? <p>No tasker assigned</p> : null}
                  </div>
                </td>
                <td className="py-4 pr-4">
                  <div className="grid gap-1 text-xs text-slate-600 dark:text-slate-300">
                    <span>Type: {order.taskType}</span>
                    <span>Location: {order.location}</span>
                    <span>Amount: {formatValue(order.amount, "currency")}</span>
                    <span>Store: {order.store}</span>
                    <span>Status: {order.status.replace("_", " ")}</span>
                    <span className="max-w-[18rem]">Description: {order.description}</span>
                  </div>
                </td>
                <td className="py-4 pr-4">
                  <p className="max-w-[18rem] text-sm text-slate-700 dark:text-slate-200">
                    {order.settlementFailureReason}
                  </p>
                </td>
                <td className="py-4 pr-4">
                  <div className="space-y-2">
                    <Badge variant="outline">payment: {order.paymentStatus}</Badge>
                    <Badge
                      variant="outline"
                      className="border-amber-200 bg-amber-50 text-amber-700"
                    >
                      settlement: {order.settlementStatus}
                    </Badge>
                  </div>
                </td>
                <td className="py-4 pr-4">
                  <div className="flex flex-col gap-2">
                    <Button
                      size="sm"
                      disabled={Boolean(actionId)}
                      onClick={() => verifySettlement(order)}
                      className="gap-2"
                    >
                      {actionId === order.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4" />
                      )}
                      {actionId === order.id ? "Verifying..." : "Verify settlement"}
                    </Button>
                    <a
                      href={`https://wa.me/2349053479802?text=${encodeURIComponent(
                        `I have paid for SwiftDU settlement on order ${order.id}. Please verify it.`
                      )}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex h-7 shrink-0 items-center justify-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-[0.8rem] font-medium text-slate-900 transition hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:hover:bg-slate-900"
                    >
                      <MessageCircle className="h-3.5 w-3.5" />
                      I have paid
                    </a>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <PaginationControls {...paged} onPageChange={paged.setPage} />
    </ManagementShell>
  );
}

function AssignedTasksPanel({ canCancel }: { canCancel: boolean }) {
  const { items, isLoading, error, reload } = useManagementResource<ExcoOrder>("orders", true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [actionId, setActionId] = useState<string | null>(null);
  const filteredItems = useMemo(
    () =>
      items.filter((order) => statusFilter === "all" || order.status === statusFilter),
    [items, statusFilter]
  );
  const paged = usePagedItems(filteredItems);

  const cancelOrder = async (order: ExcoOrder) => {
    setActionId(order.id);
    try {
      await patchManagement("orders", { id: order.id, action: "cancel" });
      await reload();
    } finally {
      setActionId(null);
    }
  };

  return (
    <ManagementShell
      title="Assigned Tasks"
      description={
        canCancel
          ? "See each task's assigned tasker and cancel in-progress tasks when needed."
          : "See each task and the tasker currently assigned to it."
      }
      isLoading={isLoading}
      error={error}
      emptyLabel="No tasks found"
      hasItems={items.length > 0}
    >
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm dark:border-slate-800 dark:bg-slate-950"
        >
          <option value="all">All statuses</option>
          <option value="pending">Pending</option>
          <option value="in_progress">In progress</option>
          <option value="paid">Paid</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>
      {filteredItems.length === 0 ? <EmptyState label="No tasks match this filter" /> : null}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-xs uppercase text-slate-500 dark:border-slate-800 dark:text-slate-400">
              <th className="pb-3 pr-4 font-semibold">Task</th>
              <th className="pb-3 pr-4 font-semibold">Customer</th>
              <th className="pb-3 pr-4 font-semibold">Assigned Tasker</th>
              <th className="pb-3 pr-4 font-semibold">Status</th>
              <th className="pb-3 pr-4 font-semibold">Value</th>
              {canCancel ? <th className="pb-3 pr-4 font-semibold">Action</th> : null}
            </tr>
          </thead>
          <tbody>
            {paged.pageItems.map((order) => (
              <tr key={order.id} className="border-b border-slate-100 align-top dark:border-slate-900">
                <td className="py-4 pr-4">
                  <div className="font-semibold text-slate-950 dark:text-white">
                    {order.description}
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {order.taskType} - {order.location}
                  </p>
                </td>
                <td className="py-4 pr-4">
                  <div className="font-medium text-slate-900 dark:text-white">{order.userName}</div>
                  <p className="mt-1 text-xs text-slate-500">{order.userEmail}</p>
                </td>
                <td className="py-4 pr-4">
                  <div className="font-medium text-slate-900 dark:text-white">{order.taskerName}</div>
                  <div className="mt-1 space-y-0.5 text-xs text-slate-500">
                    {order.taskerEmail ? <p>{order.taskerEmail}</p> : null}
                    {order.taskerPhone ? <p>{order.taskerPhone}</p> : null}
                    {!order.taskerId ? <p>No tasker assigned yet</p> : null}
                  </div>
                </td>
                <td className="py-4 pr-4">
                  <Badge variant="outline">{order.status.replace("_", " ")}</Badge>
                  <p className="mt-2 text-xs text-slate-500">
                    {formatDate(order.acceptedAt || order.createdAt)}
                  </p>
                </td>
                <td className="py-4 pr-4 font-semibold">
                  {formatValue(order.totalAmount, "currency")}
                </td>
                {canCancel ? (
                  <td className="py-4 pr-4">
                    {order.status === "in_progress" ? (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={Boolean(actionId)}
                        onClick={() => cancelOrder(order)}
                      >
                        {actionId === order.id ? "Cancelling..." : "Cancel task"}
                      </Button>
                    ) : (
                      <span className="text-xs text-slate-500">No action</span>
                    )}
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <PaginationControls {...paged} onPageChange={paged.setPage} />
    </ManagementShell>
  );
}

function UserManagementPanel({
  title,
  allowSuspension,
}: {
  title: string;
  allowSuspension: boolean;
}) {
  const { items, isLoading, error, reload } = useManagementResource<ExcoUser>("users", true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();

    return items.filter((user) => {
      const matchesSearch =
        !query ||
        user.name.toLowerCase().includes(query) ||
        user.email.toLowerCase().includes(query) ||
        user.phone.toLowerCase().includes(query);
      const matchesRole = roleFilter === "all" || user.role === roleFilter;
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "verified" && user.emailVerified) ||
        (statusFilter === "unverified" && !user.emailVerified) ||
        (statusFilter === "suspended" && user.isSuspended) ||
        (statusFilter === "discounted" && hasActiveServiceFeeDiscount(user));

      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [items, roleFilter, search, statusFilter]);
  const paged = usePagedItems(filteredItems);
  const [phoneEdits, setPhoneEdits] = useState<Record<string, string>>({});
  const [actionId, setActionId] = useState<string | null>(null);

  const updateUser = async (user: ExcoUser, body: Record<string, unknown>, actionKey = "update") => {
    setActionId(`${user.id}-${actionKey}`);
    try {
      await patchManagement("users", { id: user.id, ...body });
      await reload();
    } finally {
      setActionId(null);
    }
  };

  return (
    <ManagementShell
      title={title}
      description="Search users, review account status, update phone numbers, and verify unverified accounts."
      isLoading={isLoading}
      error={error}
      emptyLabel="No users found"
      hasItems={items.length > 0}
    >
      <div className="mb-4 grid gap-2 md:grid-cols-3">
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm dark:border-slate-800 dark:bg-slate-950"
          placeholder="Search users"
        />
        <select
          value={roleFilter}
          onChange={(event) => setRoleFilter(event.target.value)}
          className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm dark:border-slate-800 dark:bg-slate-950"
        >
          <option value="all">All roles</option>
          <option value="user">Users</option>
          <option value="tasker">Taskers</option>
          <option value="admin">Admins</option>
        </select>
        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm dark:border-slate-800 dark:bg-slate-950"
        >
          <option value="all">All status</option>
          <option value="verified">Verified</option>
          <option value="unverified">Unverified</option>
          <option value="suspended">Suspended</option>
          <option value="discounted">Discounted</option>
        </select>
      </div>
      {filteredItems.length === 0 ? (
        <EmptyState label="No users match these filters" />
      ) : null}
      <div className="space-y-3">
        {paged.pageItems.map((user) => (
          <div key={user.id} className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold text-slate-950 dark:text-white">{user.name}</p>
                  <Badge variant="outline">{user.role}</Badge>
                  <Badge
                    variant={user.emailVerified ? "outline" : "secondary"}
                    className={
                      user.emailVerified
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                        : "border-amber-200 bg-amber-50 text-amber-700"
                    }
                  >
                    {user.emailVerified ? "verified" : "unverified"}
                  </Badge>
                  {user.isSuspended ? <Badge variant="destructive">suspended</Badge> : null}
                  {hasActiveServiceFeeDiscount(user) ? (
                    <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">
                      service fee discount
                      {user.serviceFeeDiscountRemainingOrders > 0
                        ? `: ${user.serviceFeeDiscountRemainingOrders} left`
                        : ""}
                    </Badge>
                  ) : null}
                </div>
                <p className="mt-2 text-xs text-slate-500">{user.email}</p>
                <div className="mt-2 grid gap-1 text-xs text-slate-500 sm:grid-cols-3">
                  <span>Joined {formatDate(user.createdAt)}</span>
                  <span>{user.phone || "No phone number"}</span>
                  <span>{user.orderCount} orders</span>
                  <span>
                    DOB {user.dateOfBirth ? formatDateOnly(user.dateOfBirth) : "Not set"}
                  </span>
                  <span>
                    Age {user.dateOfBirth ? `${calculateAge(user.dateOfBirth)} years` : "Not set"}
                  </span>
                  {hasActiveServiceFeeDiscount(user) ? (
                    <span>
                      Discount by {user.serviceFeeDiscountGrantedByName || "SwiftDU"} - {user.serviceFeeDiscountGrantedByPhone || "No phone"} - {user.serviceFeeDiscountRemainingOrders} order{user.serviceFeeDiscountRemainingOrders === 1 ? "" : "s"} left
                    </span>
                  ) : null}
                </div>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap xl:justify-end">
                <input
                  value={phoneEdits[user.id] ?? user.phone ?? ""}
                  onChange={(event) =>
                    setPhoneEdits((previous) => ({ ...previous, [user.id]: event.target.value }))
                  }
                  className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm dark:border-slate-800 dark:bg-slate-950"
                  placeholder="Phone number"
                />
                <Button
                  size="sm"
                  variant="outline"
                  disabled={Boolean(actionId)}
                  onClick={() => updateUser(user, { phone: phoneEdits[user.id] ?? user.phone }, "phone")}
                >
                  Save Phone
                </Button>
                {!user.emailVerified ? (
                  <Button
                    size="sm"
                    disabled={Boolean(actionId)}
                    onClick={() => updateUser(user, { action: "verify" }, "verify")}
                  >
                    Verify User
                  </Button>
                ) : null}
                {allowSuspension && user.role !== "admin" ? (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={Boolean(actionId)}
                    onClick={() =>
                      updateUser(
                        user,
                        { action: user.isSuspended ? "activate" : "suspend" },
                        user.isSuspended ? "activate" : "suspend"
                      )
                    }
                  >
                    {user.isSuspended ? "Activate" : "Suspend"}
                  </Button>
                ) : null}
                {user.role !== "admin" ? (
                  <Button
                    size="sm"
                    variant={hasActiveServiceFeeDiscount(user) ? "outline" : "default"}
                    disabled={Boolean(actionId)}
                    onClick={() =>
                      hasActiveServiceFeeDiscount(user)
                        ? updateUser(user, { action: "remove-discount" }, "remove-discount")
                        : (() => {
                            const value = window.prompt(
                              "How many upcoming orders should receive this discount?",
                              "2"
                            );
                            const discountOrderCount = Number(value);

                            if (!value) return;
                            if (!Number.isInteger(discountOrderCount) || discountOrderCount < 1) {
                              window.alert("Enter a whole number of orders");
                              return;
                            }

                            void updateUser(
                              user,
                              { action: "grant-discount", discountOrderCount },
                              "grant-discount"
                            );
                          })()
                    }
                  >
                    {hasActiveServiceFeeDiscount(user) ? "Remove Discount" : "Add Discount"}
                  </Button>
                ) : null}
              </div>
            </div>
          </div>
        ))}
      </div>
      <PaginationControls {...paged} onPageChange={paged.setPage} />
    </ManagementShell>
  );
}

function ReviewsPanel() {
  const { items, isLoading, error } = useManagementResource<ExcoReview>("reviews", true);
  const paged = usePagedItems(items);

  return (
    <ManagementShell
      title="Reviews"
      description="Recent customer feedback for operations quality checks."
      isLoading={isLoading}
      error={error}
      emptyLabel="No reviews found"
      hasItems={items.length > 0}
    >
      <div className="space-y-3">
        {paged.pageItems.map((review) => (
          <div key={review.id} className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="font-semibold text-slate-950 dark:text-white">{review.rating}/5 for {review.taskerName}</p>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{review.comment}</p>
                <p className="mt-2 text-xs text-slate-500">{review.userName} - {review.userEmail}</p>
              </div>
              <p className="text-xs text-slate-500">{formatDate(review.createdAt)}</p>
            </div>
          </div>
        ))}
      </div>
      <PaginationControls {...paged} onPageChange={paged.setPage} />
    </ManagementShell>
  );
}

function SupportTicketsPanel() {
  const { items, isLoading, error, reload } = useManagementResource<ExcoSupportTicket>("support", true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();

    return items.filter((ticket) => {
      const matchesSearch =
        !query ||
        ticket.title.toLowerCase().includes(query) ||
        ticket.description.toLowerCase().includes(query) ||
        ticket.taskerName.toLowerCase().includes(query) ||
        ticket.taskerEmail.toLowerCase().includes(query);
      const matchesStatus = statusFilter === "all" || ticket.status === statusFilter;
      const matchesPriority = priorityFilter === "all" || ticket.priority === priorityFilter;

      return matchesSearch && matchesStatus && matchesPriority;
    });
  }, [items, priorityFilter, search, statusFilter]);
  const paged = usePagedItems(filteredItems);
  const [actionId, setActionId] = useState<string | null>(null);

  const runAction = async (id: string, action: "start" | "resolve" | "close") => {
    setActionId(`${id}-${action}`);
    try {
      await patchManagement("support", { id, action });
      await reload();
    } finally {
      setActionId(null);
    }
  };

  return (
    <ManagementShell
      title="Support Tickets"
      description="Investigate and update support tickets directly from the CTO dashboard."
      isLoading={isLoading}
      error={error}
      emptyLabel="No support tickets found"
      hasItems={items.length > 0}
    >
      <div className="mb-4 grid gap-2 md:grid-cols-3">
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm dark:border-slate-800 dark:bg-slate-950"
          placeholder="Search tickets"
        />
        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm dark:border-slate-800 dark:bg-slate-950"
        >
          <option value="all">All status</option>
          <option value="open">Open</option>
          <option value="in-progress">In progress</option>
          <option value="resolved">Resolved</option>
          <option value="closed">Closed</option>
        </select>
        <select
          value={priorityFilter}
          onChange={(event) => setPriorityFilter(event.target.value)}
          className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm dark:border-slate-800 dark:bg-slate-950"
        >
          <option value="all">All priority</option>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>
      </div>
      {filteredItems.length === 0 ? (
        <EmptyState label="No support tickets match these filters" />
      ) : null}
      <div className="space-y-3">
        {paged.pageItems.map((ticket) => (
          <div key={ticket.id} className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">{ticket.status}</Badge>
                  <Badge variant="outline">{ticket.priority}</Badge>
                  <Badge variant="outline">{ticket.category}</Badge>
                </div>
                <p className="mt-2 font-semibold text-slate-950 dark:text-white">{ticket.title}</p>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{ticket.description}</p>
                <p className="mt-2 text-xs text-slate-500">{ticket.taskerName} - {ticket.taskerEmail}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" disabled={Boolean(actionId)} onClick={() => runAction(ticket.id, "start")}>
                  Start
                </Button>
                <Button size="sm" variant="outline" disabled={Boolean(actionId)} onClick={() => runAction(ticket.id, "resolve")}>
                  Resolve
                </Button>
                <Button size="sm" variant="outline" disabled={Boolean(actionId)} onClick={() => runAction(ticket.id, "close")}>
                  Close
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>
      <PaginationControls {...paged} onPageChange={paged.setPage} />
    </ManagementShell>
  );
}

function RankedList({ data, emptyLabel }: { data: CountDatum[]; emptyLabel: string }) {
  const paged = usePagedItems(data);

  if (!data.length) return <EmptyState label={emptyLabel} />;

  const max = Math.max(...data.map((item) => item.count), 1);

  return (
    <div>
      <div className="space-y-4">
        {paged.pageItems.map((item) => (
          <div key={item.label} className="space-y-2">
            <div className="flex items-center justify-between gap-4 text-sm">
              <span className="min-w-0 truncate font-medium text-slate-700 dark:text-slate-200">
                {item.label}
              </span>
              <span className="font-semibold text-slate-950 dark:text-white">
                {formatValue(item.count, "number")}
              </span>
            </div>
            <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800">
              <div
                className="h-2 rounded-full bg-blue-600"
                style={{ width: `${Math.max((item.count / max) * 100, 4)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
      <PaginationControls
        page={paged.page}
        pageCount={paged.pageCount}
        startItem={paged.startItem}
        endItem={paged.endItem}
        totalItems={paged.totalItems}
        onPageChange={paged.setPage}
      />
    </div>
  );
}

function OrderTrendChart({ data, role }: { data: DashboardData["charts"]["orderTrend"]; role: ExcoRole }) {
  if (!data.length) return <EmptyState label="Order trend appears after activity is recorded" />;

  return (
    <div className="h-80">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <defs>
            <linearGradient id="ordersTrend" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#2563eb" stopOpacity={0.35} />
              <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="revenueTrend" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#16a34a" stopOpacity={0.35} />
              <stop offset="95%" stopColor="#16a34a" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="date" tick={{ fontSize: 12 }} />
          <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
          <Tooltip />
          <Area type="monotone" dataKey="orders" stroke="#2563eb" fill="url(#ordersTrend)" />
          {role === "CFO" ? (
            <Area type="monotone" dataKey="revenue" stroke="#16a34a" fill="url(#revenueTrend)" />
          ) : (
            <Area type="monotone" dataKey="completed" stroke="#16a34a" fill="url(#revenueTrend)" />
          )}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function parseTrafficDate(value: string, range = "30d") {
  if (range === "24h") {
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):00$/);
    if (match) {
      return new Date(
        Number(match[1]),
        Number(match[2]) - 1,
        Number(match[3]),
        Number(match[4])
      );
    }
  }

  if (range === "12mo" || range === "24mo") {
    const match = value.match(/^(\d{4})-(\d{2})$/);
    if (match) return new Date(Number(match[1]), Number(match[2]) - 1, 1);
  }

  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));

  return null;
}

function formatTrafficTick(value: string, range = "30d") {
  const date = parseTrafficDate(value, range);
  if (!date) return value;

  if (range === "24h") {
    return date
      .toLocaleTimeString("en", { hour: "numeric", hour12: true })
      .replace(" ", "")
      .toLowerCase();
  }

  if (range === "7d") {
    return date.toLocaleDateString("en", { day: "numeric", month: "short" });
  }

  if (range === "12mo" || range === "24mo") {
    return date.toLocaleDateString("en", { month: "short", year: "2-digit" });
  }

  return date.toLocaleDateString("en", { month: "short", day: "numeric" });
}

function formatTrafficTooltipLabel(value: string, range = "30d") {
  const date = parseTrafficDate(value, range);
  if (!date) return value;

  const now = new Date();

  if (range === "24h") {
    const hours = Math.max(0, Math.round((now.getTime() - date.getTime()) / 3_600_000));
    if (hours <= 0) return "This hour";
    if (hours === 1) return "1 hour ago";
    return `${hours} hours ago`;
  }

  if (range === "12mo" || range === "24mo") {
    const months = Math.max(
      0,
      (now.getFullYear() - date.getFullYear()) * 12 + now.getMonth() - date.getMonth()
    );
    if (months <= 0) return "This month";
    if (months === 1) return "1 month ago";
    return `${months} months ago`;
  }

  const days = Math.max(
    0,
    Math.round(
      (new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() - date.getTime()) /
        86_400_000
    )
  );
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  return `${days} days ago`;
}

function getTrafficTickInterval(range: string, length: number) {
  if (range === "24h") return length > 8 ? 2 : 0;
  if (range === "7d") return 0;
  if (range === "30d") return length > 12 ? 5 : 0;
  if (range === "3mo") return length > 12 ? 13 : 0;
  return length > 12 ? 2 : 0;
}

function TrafficChart({
  data,
  range = "30d",
}: {
  data: DashboardData["marketing"]["analytics"]["trafficChart"];
  range?: string;
}) {
  if (!data.length) return <EmptyState label="Traffic trends will appear after production visits" />;

  return (
    <div className="h-80">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 12, right: 8, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="pageViewsTrend" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#111827" stopOpacity={0.28} />
              <stop offset="95%" stopColor="#111827" stopOpacity={0.03} />
            </linearGradient>
            <linearGradient id="visitorTrend" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#2563eb" stopOpacity={0.2} />
              <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            interval={getTrafficTickInterval(range, data.length)}
            tickFormatter={(value) => formatTrafficTick(String(value), range)}
          />
          <YAxis allowDecimals={false} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={36} />
          <Tooltip labelFormatter={(value) => formatTrafficTooltipLabel(String(value), range)} />
          <Area
            type="monotone"
            dataKey="pageViews"
            name="Page views"
            stroke="#111827"
            strokeWidth={2.5}
            fill="url(#pageViewsTrend)"
            activeDot={{ r: 5 }}
          />
          <Area
            type="monotone"
            dataKey="uniqueVisitors"
            name="Visitors"
            stroke="#2563eb"
            strokeWidth={2}
            fill="url(#visitorTrend)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function HorizontalBarChart({ data, emptyLabel }: { data: CountDatum[]; emptyLabel: string }) {
  if (!data.length) return <EmptyState label={emptyLabel} />;

  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 8, right: 18, bottom: 8, left: 14 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
          <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
          <YAxis
            dataKey="label"
            type="category"
            width={120}
            tick={{ fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(value) => {
              const label = String(value);
              return label.length > 18 ? `${label.slice(0, 18)}...` : label;
            }}
          />
          <Tooltip />
          <Bar dataKey="count" fill="#2563eb" radius={[0, 6, 6, 0]} barSize={18} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function InsightPanel({ insights }: { insights: InsightDatum[] }) {
  const severityClasses = {
    good: "border-emerald-200 bg-emerald-50 text-emerald-800",
    warning: "border-amber-200 bg-amber-50 text-amber-800",
    critical: "border-red-200 bg-red-50 text-red-800",
    info: "border-sky-200 bg-sky-50 text-sky-800",
  };

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {insights.map((item) => (
        <div key={item.label} className={`rounded-lg border p-4 ${severityClasses[item.severity]}`}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold">{item.label}</p>
              <p className="mt-2 text-2xl font-bold">{formatValue(item.value, item.format)}</p>
            </div>
            <ShieldAlert className="h-5 w-5 shrink-0" />
          </div>
          <p className="mt-3 text-sm opacity-85">{item.description}</p>
        </div>
      ))}
    </div>
  );
}

function FinanceSections({ data }: { data: DashboardData }) {
  const unsettledTaskers = data.finance.unsettledTaskers ?? [];
  const activeFinanceTasks = data.finance.activeFinanceTasks ?? [];
  const cancelledFinanceOrders = data.finance.cancelledFinanceOrders ?? [];

  return (
    <div className="space-y-4">
      <UnsettledTaskersTable taskers={unsettledTaskers} />
      <ActiveFinanceTasksTable tasks={activeFinanceTasks} />
      <CancelledFinanceOrdersTable orders={cancelledFinanceOrders} />

      <div className="grid gap-4 xl:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-emerald-600" />
            Order Value Trend
          </CardTitle>
          <CardDescription>Daily order count with completed revenue overlay.</CardDescription>
        </CardHeader>
        <CardContent>
          <OrderTrendChart data={data.charts.orderTrend} role="CFO" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Settlement Status</CardTitle>
          <CardDescription>Tasker settlement state across recent orders.</CardDescription>
        </CardHeader>
        <CardContent>
          <HorizontalBarChart data={data.charts.settlementBreakdown} emptyLabel="No settlements recorded yet" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Payment Status</CardTitle>
          <CardDescription>Customer payment pipeline and failed payments.</CardDescription>
        </CardHeader>
        <CardContent>
          <RankedList data={data.charts.paymentBreakdown} emptyLabel="No payment data recorded yet" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Fee Split</CardTitle>
          <CardDescription>Completed platform fees, tasker fees, and item value.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm">
          {[
            ["Item value", data.finance.completedMoney.amount],
            ["Service fees", data.finance.completedMoney.serviceFee],
            ["Platform fees", data.finance.completedMoney.platformFee],
            ["Paystack fees", data.finance.completedMoney.paystackSettlementFee],
            ["Net platform profit", data.finance.completedMoney.netPlatformProfit],
            ["Approved expenditures", data.finance.completedMoney.approvedExpenditures],
            ["Business profit", data.finance.completedMoney.businessProfit],
            ["Tasker fees", data.finance.completedMoney.taskerFee],
          ].map(([label, value]) => (
            <div key={label} className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3 dark:bg-slate-900">
              <span className="text-slate-600 dark:text-slate-300">{label}</span>
              <span className="font-semibold">{formatValue(value, "currency")}</span>
            </div>
          ))}
        </CardContent>
      </Card>
      </div>
    </div>
  );
}

function ExpenditurePanel({ role }: { role: ExcoRole }) {
  const [items, setItems] = useState<ExpenditureItem[]>([]);
  const [actorRole, setActorRole] = useState<ExpenditureApprovalRole | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: "",
    amount: "",
    category: "",
    notes: "",
  });

  const loadExpenditures = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/expenditures?limit=50", { cache: "no-store" });
      if (!response.ok) throw new Error("Unable to load expenditures.");
      const data = await response.json();
      setItems(data.items || []);
      setActorRole(data.actorRole || null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load expenditures.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadExpenditures();
  }, [loadExpenditures]);

  async function createExpenditure(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setMessage(null);

    try {
      const response = await fetch("/api/expenditures", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title,
          amount: Number(form.amount),
          category: form.category,
          notes: form.notes,
        }),
      });
      const data = await response.json();

      if (!response.ok) throw new Error(data.error || "Unable to add expenditure.");

      setForm({ title: "", amount: "", category: "", notes: "" });
      setMessage("Expenditure added. It will affect profit after all approvals.");
      await loadExpenditures();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to add expenditure.");
    } finally {
      setIsSaving(false);
    }
  }

  async function approveExpenditure(id: string) {
    setIsSaving(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/expenditures/${id}/approve`, { method: "POST" });
      const data = await response.json();

      if (!response.ok) throw new Error(data.error || "Unable to approve expenditure.");

      setMessage(data.item?.status === "approved" ? "Expenditure fully approved." : "Approval recorded.");
      await loadExpenditures();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to approve expenditure.");
    } finally {
      setIsSaving(false);
    }
  }

  const pendingItems = items.filter((item) => item.status === "pending");
  const approvedItems = items.filter((item) => item.status === "approved").slice(0, 5);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Business Expenditures</CardTitle>
        <CardDescription>
          Expenses reduce profit only after CFO, CMO, COO, CTO, and CEO approvals.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {role === "CFO" ? (
          <form onSubmit={createExpenditure} className="grid gap-3 rounded-lg border border-slate-200 p-4 dark:border-slate-800 md:grid-cols-2">
            <Input
              value={form.title}
              onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
              placeholder="Hosting cost"
              required
            />
            <Input
              value={form.amount}
              onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))}
              placeholder="Amount"
              type="number"
              min="1"
              required
            />
            <Input
              value={form.category}
              onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))}
              placeholder="Category"
              required
            />
            <Textarea
              value={form.notes}
              onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
              placeholder="Optional notes"
              className="md:col-span-2"
            />
            <Button type="submit" disabled={isSaving} className="md:col-span-2">
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />}
              Add expenditure
            </Button>
          </form>
        ) : null}

        {message ? <p className="text-sm text-slate-600 dark:text-slate-300">{message}</p> : null}

        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading expenditures...
          </div>
        ) : pendingItems.length === 0 ? (
          <EmptyState label="No expenditures waiting for approval" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase text-slate-500 dark:border-slate-800">
                  <th className="pb-3 pr-4 font-semibold">Expense</th>
                  <th className="pb-3 pr-4 font-semibold">Amount</th>
                  <th className="pb-3 pr-4 font-semibold">Approved</th>
                  <th className="pb-3 pr-4 font-semibold">Waiting On</th>
                  <th className="pb-3 pr-4 font-semibold">Action</th>
                </tr>
              </thead>
              <tbody>
                {pendingItems.map((item) => {
                  const hasApproved = actorRole
                    ? item.approvals.some((approval) => approval.role === actorRole)
                    : false;
                  const canApprove = Boolean(actorRole && item.pendingApprovals.includes(actorRole));

                  return (
                    <tr key={item.id} className="border-b border-slate-100 align-top dark:border-slate-900">
                      <td className="py-4 pr-4">
                        <div className="font-semibold">{item.title}</div>
                        <p className="mt-1 text-xs text-slate-500">
                          {item.category} - added by {item.createdByName || "CFO"}
                        </p>
                        {item.notes ? <p className="mt-2 text-xs text-slate-500">{item.notes}</p> : null}
                      </td>
                      <td className="py-4 pr-4 font-semibold">{formatValue(item.amount, "currency")}</td>
                      <td className="py-4 pr-4">
                        <div className="flex flex-wrap gap-1">
                          {item.approvals.map((approval) => (
                            <Badge key={approval.role} variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
                              {approval.role}
                            </Badge>
                          ))}
                        </div>
                      </td>
                      <td className="py-4 pr-4">
                        <div className="flex flex-wrap gap-1">
                          {item.pendingApprovals.map((approvalRole) => (
                            <Badge key={approvalRole} variant="outline">
                              {approvalRole}
                            </Badge>
                          ))}
                        </div>
                      </td>
                      <td className="py-4 pr-4">
                        <Button
                          size="sm"
                          disabled={!canApprove || isSaving}
                          onClick={() => approveExpenditure(item.id)}
                        >
                          <CheckCircle2 className="mr-2 h-4 w-4" />
                          {hasApproved ? "Approved" : "Approve"}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {approvedItems.length > 0 ? (
          <div className="space-y-2">
            <p className="text-sm font-semibold">Recently approved</p>
            {approvedItems.map((item) => (
              <div key={item.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3 text-sm dark:bg-slate-900">
                <span>{item.title}</span>
                <span className="font-semibold">{formatValue(item.amount, "currency")}</span>
              </div>
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function formatDate(value: string | null) {
  if (!value) return "Not set";
  return new Intl.DateTimeFormat("en-NG", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatDateOnly(value: string | null) {
  if (!value) return "Not set";
  return new Intl.DateTimeFormat("en-NG", {
    dateStyle: "medium",
  }).format(new Date(value));
}

function calculateAge(value: string) {
  const birthDate = new Date(value);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDelta = today.getMonth() - birthDate.getMonth();

  if (monthDelta < 0 || (monthDelta === 0 && today.getDate() < birthDate.getDate())) {
    age -= 1;
  }

  return Math.max(age, 0);
}

function statusTone(status: string) {
  if (status === "overdue") return "border-red-200 bg-red-50 text-red-700";
  if (status === "failed") return "border-amber-200 bg-amber-50 text-amber-700";
  if (status === "initialized") return "border-blue-200 bg-blue-50 text-blue-700";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

function UnsettledTaskersTable({
  taskers,
}: {
  taskers: DashboardData["finance"]["unsettledTaskers"];
}) {
  const paged = usePagedItems(taskers);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Taskers Owing Platform Fees</CardTitle>
        <CardDescription>
          Completed tasks where the tasker has not settled SwiftDU&apos;s platform fee.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {taskers.length === 0 ? (
          <EmptyState label="All taskers are settled" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase text-slate-500 dark:border-slate-800 dark:text-slate-400">
                  <th className="pb-3 pr-4 font-semibold">Tasker</th>
                  <th className="pb-3 pr-4 font-semibold">Outstanding</th>
                  <th className="pb-3 pr-4 font-semibold">Tasks</th>
                  <th className="pb-3 pr-4 font-semibold">Oldest Due</th>
                  <th className="pb-3 pr-4 font-semibold">Recent Unpaid Tasks</th>
                </tr>
              </thead>
              <tbody>
                {paged.pageItems.map((tasker) => (
                  <tr key={tasker.taskerId} className="border-b border-slate-100 align-top dark:border-slate-900">
                    <td className="py-4 pr-4">
                      <div className="font-semibold text-slate-950 dark:text-white">
                        {tasker.taskerName}
                      </div>
                      <div className="mt-1 space-y-0.5 text-xs text-slate-500 dark:text-slate-400">
                        {tasker.taskerEmail ? <p>{tasker.taskerEmail}</p> : null}
                        {tasker.taskerPhone ? <p>{tasker.taskerPhone}</p> : null}
                      </div>
                      {tasker.isSettlementSuspended ? (
                        <Badge variant="outline" className="mt-2 border-red-200 bg-red-50 text-red-700">
                          Suspended
                        </Badge>
                      ) : null}
                    </td>
                    <td className="py-4 pr-4">
                      <div className="font-bold text-emerald-700 dark:text-emerald-300">
                        {formatValue(tasker.totalOutstanding, "currency")}
                      </div>
                      {tasker.overdueCount > 0 ? (
                        <p className="mt-1 text-xs font-medium text-red-600">
                          {tasker.overdueCount} overdue
                        </p>
                      ) : (
                        <p className="mt-1 text-xs text-slate-500">No overdue tasks</p>
                      )}
                    </td>
                    <td className="py-4 pr-4">
                      <span className="font-semibold">{tasker.taskCount}</span>
                      <span className="text-slate-500"> unpaid</span>
                    </td>
                    <td className="py-4 pr-4 text-slate-600 dark:text-slate-300">
                      {formatDate(tasker.oldestDueAt)}
                    </td>
                    <td className="py-4 pr-4">
                      <div className="space-y-2">
                        {tasker.tasks.map((task) => (
                          <div key={task.orderId} className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="truncate font-medium text-slate-900 dark:text-white">
                                  {task.description}
                                </p>
                                <p className="mt-1 text-xs text-slate-500">
                                  {task.taskType} - completed {formatDate(task.completedAt)}
                                </p>
                              </div>
                              <div className="shrink-0 text-right">
                                <p className="font-semibold">
                                  {formatValue(task.platformFee, "currency")}
                                </p>
                                <span className={`mt-1 inline-flex rounded-full border px-2 py-0.5 text-xs ${statusTone(task.settlementStatus)}`}>
                                  {task.settlementStatus.replace("_", " ")}
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <PaginationControls
              page={paged.page}
              pageCount={paged.pageCount}
              startItem={paged.startItem}
              endItem={paged.endItem}
              totalItems={paged.totalItems}
              onPageChange={paged.setPage}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ActiveFinanceTasksTable({
  tasks,
}: {
  tasks: DashboardData["finance"]["activeFinanceTasks"];
}) {
  const paged = usePagedItems(tasks);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tasks Still In Progress</CardTitle>
        <CardDescription>
          These assigned tasks have platform fees, but they are not settlement debts until the task is completed.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {tasks.length === 0 ? (
          <EmptyState label="No active tasker tasks with pending platform fees" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase text-slate-500 dark:border-slate-800 dark:text-slate-400">
                  <th className="pb-3 pr-4 font-semibold">Task</th>
                  <th className="pb-3 pr-4 font-semibold">Tasker</th>
                  <th className="pb-3 pr-4 font-semibold">Status</th>
                  <th className="pb-3 pr-4 font-semibold">Platform Fee</th>
                  <th className="pb-3 pr-4 font-semibold">Accepted</th>
                </tr>
              </thead>
              <tbody>
                {paged.pageItems.map((task) => (
                  <tr key={task.orderId} className="border-b border-slate-100 align-top dark:border-slate-900">
                    <td className="py-4 pr-4">
                      <div className="font-semibold text-slate-950 dark:text-white">
                        {task.description}
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        {task.taskType} - {task.location}
                      </p>
                    </td>
                    <td className="py-4 pr-4">
                      <div className="font-medium text-slate-900 dark:text-white">
                        {task.taskerName}
                      </div>
                      <div className="mt-1 space-y-0.5 text-xs text-slate-500 dark:text-slate-400">
                        {task.taskerEmail ? <p>{task.taskerEmail}</p> : null}
                        {task.taskerPhone ? <p>{task.taskerPhone}</p> : null}
                      </div>
                    </td>
                    <td className="py-4 pr-4">
                      <span className="inline-flex rounded-full border border-blue-200 bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700">
                        {task.status.replace("_", " ")}
                      </span>
                      <p className="mt-2 text-xs text-slate-500">Not due yet</p>
                    </td>
                    <td className="py-4 pr-4">
                      <div className="font-semibold">
                        {formatValue(task.platformFee, "currency")}
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        Order total {formatValue(task.totalAmount, "currency")}
                      </p>
                    </td>
                    <td className="py-4 pr-4 text-slate-600 dark:text-slate-300">
                      {formatDate(task.acceptedAt || task.paidAt || task.bookedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <PaginationControls
              page={paged.page}
              pageCount={paged.pageCount}
              startItem={paged.startItem}
              endItem={paged.endItem}
              totalItems={paged.totalItems}
              onPageChange={paged.setPage}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function CancelledFinanceOrdersTable({
  orders,
}: {
  orders: DashboardData["finance"]["cancelledFinanceOrders"];
}) {
  const paged = usePagedItems(orders);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Cancelled Orders</CardTitle>
        <CardDescription>
          These orders are shown for visibility only and are excluded from CFO totals, revenue, and settlement calculations.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {orders.length === 0 ? (
          <EmptyState label="No cancelled orders in this period" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase text-slate-500 dark:border-slate-800 dark:text-slate-400">
                  <th className="pb-3 pr-4 font-semibold">Order</th>
                  <th className="pb-3 pr-4 font-semibold">Customer</th>
                  <th className="pb-3 pr-4 font-semibold">Tasker</th>
                  <th className="pb-3 pr-4 font-semibold">Value</th>
                  <th className="pb-3 pr-4 font-semibold">Cancelled</th>
                </tr>
              </thead>
              <tbody>
                {paged.pageItems.map((order) => (
                  <tr key={order.orderId} className="border-b border-slate-100 align-top dark:border-slate-900">
                    <td className="py-4 pr-4">
                      <div className="font-semibold text-slate-950 dark:text-white">
                        {order.description}
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        {order.taskType} - {order.location}
                      </p>
                    </td>
                    <td className="py-4 pr-4">
                      <div className="font-medium text-slate-900 dark:text-white">
                        {order.userName}
                      </div>
                      {order.userEmail ? (
                        <p className="mt-1 text-xs text-slate-500">{order.userEmail}</p>
                      ) : null}
                    </td>
                    <td className="py-4 pr-4">
                      <div className="font-medium text-slate-900 dark:text-white">
                        {order.taskerName}
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        {order.taskerId ? "Assigned before cancellation" : "No tasker assigned"}
                      </p>
                    </td>
                    <td className="py-4 pr-4">
                      <div className="font-semibold">
                        {formatValue(order.totalAmount, "currency")}
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        Platform fee would have been {formatValue(order.platformFee, "currency")}
                      </p>
                    </td>
                    <td className="py-4 pr-4 text-slate-600 dark:text-slate-300">
                      {formatDate(order.cancelledAt || order.bookedAt)}
                      <Badge variant="outline" className="mt-2 block w-fit border-slate-200 bg-slate-50 text-slate-600">
                        Excluded
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <PaginationControls
              page={paged.page}
              pageCount={paged.pageCount}
              startItem={paged.startItem}
              endItem={paged.endItem}
              totalItems={paged.totalItems}
              onPageChange={paged.setPage}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function MarketingMetric({
  label,
  value,
  format = "number",
}: {
  label: string;
  value: number;
  format?: "number" | "percent";
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-3 text-3xl font-bold text-slate-950 dark:text-white md:text-4xl">
        {formatValue(value, format)}
      </p>
    </div>
  );
}

function MarketingSections({
  data,
  range,
  onRangeChange,
}: {
  data: DashboardData;
  range: string;
  onRangeChange: (range: string) => void;
}) {
  const analytics = data.marketing.analytics;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <LineChart className="h-5 w-5 text-rose-600" />
              Web Analytics
            </CardTitle>
            <CardDescription>
              Visitors, page views, and acquisition quality for {data.range.label || "the selected period"}.
            </CardDescription>
          </div>
          <select
            value={range}
            onChange={(event) => onRangeChange(event.target.value)}
            className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-800 shadow-sm outline-none transition focus:border-slate-400 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
          >
            {CMO_RANGE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-3 md:grid-cols-3">
            <MarketingMetric label="Visitors" value={analytics.uniqueVisitors} />
            <MarketingMetric label="Page Views" value={analytics.totalPageViews} />
            <MarketingMetric label="Bounce Rate" value={analytics.bounceRate || 0} format="percent" />
          </div>
          <TrafficChart data={analytics.trafficChart} range={range} />
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Top Pages</CardTitle>
            <CardDescription>Pages with the strongest visitor attention.</CardDescription>
          </CardHeader>
          <CardContent>
            <HorizontalBarChart data={analytics.topPages} emptyLabel="No page views recorded yet" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Referral Sources</CardTitle>
            <CardDescription>Channels bringing users into SwiftDU.</CardDescription>
          </CardHeader>
          <CardContent>
            <HorizontalBarChart data={analytics.topReferralSources} emptyLabel="No referral sources recorded yet" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Countries</CardTitle>
            <CardDescription>Where page views are coming from.</CardDescription>
          </CardHeader>
          <CardContent>
            <HorizontalBarChart data={analytics.topCountries} emptyLabel="No country data recorded yet" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Device Mix</CardTitle>
            <CardDescription>Devices visitors use when they reach SwiftDU.</CardDescription>
          </CardHeader>
          <CardContent>
            <HorizontalBarChart data={analytics.deviceBreakdown} emptyLabel="No device data recorded yet" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Order Demand By Category</CardTitle>
            <CardDescription>Use this to decide what campaigns should promote.</CardDescription>
          </CardHeader>
          <CardContent>
            <RankedList data={data.charts.categoryBreakdown} emptyLabel="No order category data yet" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Conversion Events</CardTitle>
            <CardDescription>Tracked actions beyond page views.</CardDescription>
          </CardHeader>
          <CardContent>
            <HorizontalBarChart data={analytics.conversionEvents} emptyLabel="No conversion events recorded yet" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function OperationsSections({ data }: { data: DashboardData }) {
  return (
    <div className="space-y-4">
      <CooRecentActivity activity={data.operations.recentActivity ?? []} />

      <div className="grid gap-4 xl:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-blue-600" />
            Fulfillment Trend
          </CardTitle>
          <CardDescription>Daily order volume and completed orders.</CardDescription>
        </CardHeader>
        <CardContent>
          <OrderTrendChart data={data.charts.orderTrend} role="COO" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Order Status Mix</CardTitle>
          <CardDescription>Where non-cancelled work is sitting right now.</CardDescription>
        </CardHeader>
        <CardContent>
          <HorizontalBarChart data={data.charts.statusBreakdown} emptyLabel="No status data recorded yet" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Location Demand</CardTitle>
          <CardDescription>Campus delivery hotspots by order count.</CardDescription>
        </CardHeader>
        <CardContent>
          <RankedList data={data.charts.locationDemand} emptyLabel="No location data recorded yet" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Task Categories</CardTitle>
          <CardDescription>Operational load by errand type.</CardDescription>
        </CardHeader>
        <CardContent>
          <RankedList data={data.charts.categoryBreakdown} emptyLabel="No category data recorded yet" />
        </CardContent>
      </Card>
      </div>
    </div>
  );
}

function CooRecentActivity({
  activity,
}: {
  activity: DashboardData["operations"]["recentActivity"];
}) {
  const paged = usePagedItems(activity);
  const toneByType = {
    order: "border-blue-200 bg-blue-50 text-blue-700",
    tasker: "border-emerald-200 bg-emerald-50 text-emerald-700",
    review: "border-amber-200 bg-amber-50 text-amber-700",
    cancelled: "border-slate-200 bg-slate-50 text-slate-700",
    declined: "border-red-200 bg-red-50 text-red-700",
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Activity</CardTitle>
        <CardDescription>Latest order, tasker, review, cancellation, and transfer issue activity.</CardDescription>
      </CardHeader>
      <CardContent>
        {activity.length === 0 ? (
          <EmptyState label="No recent activity yet" />
        ) : (
          <div>
            <div className="space-y-3">
              {paged.pageItems.map((item) => (
                <div key={item.id} className="flex flex-col gap-3 rounded-lg border border-slate-200 p-3 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className={toneByType[item.type]}>
                        {item.type}
                      </Badge>
                      {item.status ? (
                        <span className="text-xs text-slate-500">{item.status.replace("_", " ")}</span>
                      ) : null}
                    </div>
                    <p className="mt-2 text-sm font-medium text-slate-900 dark:text-white">
                      {item.message}
                    </p>
                  </div>
                  <p className="text-xs text-slate-500">{formatDate(item.timestamp)}</p>
                </div>
              ))}
            </div>
            <PaginationControls
              page={paged.page}
              pageCount={paged.pageCount}
              startItem={paged.startItem}
              endItem={paged.endItem}
              totalItems={paged.totalItems}
              onPageChange={paged.setPage}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function TechnologySections({ data }: { data: DashboardData }) {
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-violet-600" />
            Product Traffic
          </CardTitle>
          <CardDescription>Traffic volume to watch for frontend and route health.</CardDescription>
        </CardHeader>
        <CardContent>
          <TrafficChart data={data.marketing.analytics.trafficChart} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Device Mix</CardTitle>
          <CardDescription>Prioritize QA by the devices customers actually use.</CardDescription>
        </CardHeader>
        <CardContent>
          <HorizontalBarChart data={data.technology.deviceBreakdown} emptyLabel="No device data recorded yet" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Browser Breakdown</CardTitle>
          <CardDescription>Browser coverage signals for regression testing.</CardDescription>
        </CardHeader>
        <CardContent>
          <RankedList data={data.technology.browserBreakdown} emptyLabel="No browser data recorded yet" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Payment Pipeline</CardTitle>
          <CardDescription>Failures and stuck states that may require engineering follow-up.</CardDescription>
        </CardHeader>
        <CardContent>
          <RankedList data={data.charts.paymentBreakdown} emptyLabel="No payment data recorded yet" />
        </CardContent>
      </Card>
    </div>
  );
}

export default function ExcoDashboard({ role }: { role: ExcoRole }) {
  const router = useRouter();
  const config = ROLE_CONFIG[role];
  const Icon = config.icon;
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [marketingRange, setMarketingRange] = useState("7d");
  const [isCreatingTestOrder, setIsCreatingTestOrder] = useState(false);
  const [testOrderMessage, setTestOrderMessage] = useState<string | null>(null);

  useEffect(() => {
    async function loadDashboard() {
      try {
        setIsLoading(true);
        setError(null);
        const query =
          role === "CMO"
            ? `/api/exco/dashboard?role=${role}&range=${marketingRange}`
            : `/api/exco/dashboard?role=${role}&days=30`;
        const response = await fetch(query, {
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error(response.status === 403 ? "You do not have access to this dashboard." : "Unable to load dashboard.");
        }

        setData((await response.json()) as DashboardData);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Unable to load dashboard.");
      } finally {
        setIsLoading(false);
      }
    }

    void loadDashboard();
  }, [role, marketingRange]);

  const section = useMemo(() => {
    if (!data) return null;
    if (role === "CFO") return <FinanceSections data={data} />;
    if (role === "CMO") {
      return (
        <MarketingSections
          data={data}
          range={marketingRange}
          onRangeChange={setMarketingRange}
        />
      );
    }
    if (role === "COO") return <OperationsSections data={data} />;
    return <TechnologySections data={data} />;
  }, [data, marketingRange, role]);

  const createTestOrder = async () => {
    setIsCreatingTestOrder(true);
    setTestOrderMessage(null);

    try {
      const response = await fetch("/api/exco/test-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || "Unable to create test order.");
      }

      setTestOrderMessage("Test order created.");
    } catch (createError) {
      setTestOrderMessage(
        createError instanceof Error ? createError.message : "Unable to create test order."
      );
    } finally {
      setIsCreatingTestOrder(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-6 text-slate-600 dark:bg-slate-950 dark:text-slate-300">
        <div className="flex items-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading {config.title.toLowerCase()}...
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-slate-50 px-4 py-10 dark:bg-slate-950">
        <Card className="mx-auto max-w-xl">
          <CardHeader>
            <CardTitle>Dashboard unavailable</CardTitle>
            <CardDescription>{error || "Unable to load dashboard."}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" onClick={() => router.push("/dashboard")}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950 dark:bg-slate-950 dark:text-slate-50">
      <div className="mx-auto max-w-7xl space-y-6 px-4 pb-8 pt-8 md:px-8 md:pb-10 md:pt-10">
        <div className="flex flex-col gap-4 border-b border-slate-200 pb-6 dark:border-slate-800 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <Icon className={`h-6 w-6 ${config.accent}`} />
            </div>
            <div>
              <Badge variant="outline" className={config.badge}>
                {config.kicker}
              </Badge>
              <h1 className="mt-3 text-2xl font-bold tracking-normal md:text-3xl">
                {config.title}
              </h1>
              <p className="mt-2 max-w-3xl text-sm text-slate-500 dark:text-slate-400">
                {config.description}
              </p>
              <p className="mt-1 text-xs text-slate-400">
                {EXCO_ROLE_LABELS[role]} access only. Showing the last {data.range.days} days.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={createTestOrder} disabled={isCreatingTestOrder}>
              {isCreatingTestOrder ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <PlusCircle className="mr-2 h-4 w-4" />
              )}
              Create test order
            </Button>
            <Button variant="outline" onClick={() => router.push("/dashboard")}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              User Dashboard
            </Button>
            <Button onClick={() => router.push("/tasker-dashboard")}>
              Tasker Dashboard
            </Button>
          </div>
        </div>

        {testOrderMessage ? (
          <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200">
            {testOrderMessage}
          </div>
        ) : null}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {data.cards.map((item) => (
            <MetricCard key={item.label} item={item} />
          ))}
        </div>

        <InsightPanel insights={data.insights} />
        <ExcoManagementPanels role={role} />
        <ExpenditurePanel role={role} />

        {section}
      </div>
    </div>
  );
}
