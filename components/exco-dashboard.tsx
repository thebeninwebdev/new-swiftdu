"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
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
  Cpu,
  LineChart,
  Loader2,
  Megaphone,
  ShieldAlert,
  TrendingUp,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
  };
  cards: CardDatum[];
  insights: InsightDatum[];
  finance: {
    currentMoney: {
      totalAmount: number;
      amount: number;
      serviceFee: number;
      platformFee: number;
      taskerFee: number;
      waterFee: number;
    };
    completedMoney: {
      totalAmount: number;
      amount: number;
      serviceFee: number;
      platformFee: number;
      taskerFee: number;
      waterFee: number;
    };
    previousMoney: {
      totalAmount: number;
      platformFee: number;
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
      topPages: CountDatum[];
      topReferralSources: CountDatum[];
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

const CHART_COLORS = ["#2563eb", "#16a34a", "#f59e0b", "#dc2626", "#7c3aed", "#0891b2"];
const CFO_PAGE_SIZE = 5;

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
  isVerified: boolean;
  isRejected: boolean;
  isPremium: boolean;
  isSettlementSuspended: boolean;
  completedTasks: number;
  rating: number;
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
  orderCount: number;
  createdAt: string;
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
        <TaskerManagementPanel />
        <UserManagementPanel title="User Phone Management" allowSuspension={false} />
        <ReviewsPanel />
      </div>
    );
  }

  if (role === "CTO") {
    return (
      <div className="space-y-4">
        <UserManagementPanel title="User Management" allowSuspension />
        <SupportTicketsPanel />
      </div>
    );
  }

  return null;
}

function TaskerManagementPanel() {
  const { items, isLoading, error, reload } = useManagementResource<ExcoTasker>("taskers", true);
  const paged = usePagedItems(items);
  const [actionId, setActionId] = useState<string | null>(null);

  const runAction = async (id: string, action: "approve" | "reject" | "suspend" | "activate") => {
    setActionId(`${id}-${action}`);
    try {
      await patchManagement("taskers", { id, action });
      await reload();
    } finally {
      setActionId(null);
    }
  };

  return (
    <ManagementShell
      title="Tasker Management"
      description="Approve, reject, suspend, or restore taskers directly from the COO dashboard."
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
                <div className="mt-2 flex flex-wrap gap-2">
                  <Badge variant="outline">{tasker.isVerified ? "approved" : tasker.isRejected ? "rejected" : "pending"}</Badge>
                  {tasker.isPremium ? <Badge variant="outline">premium</Badge> : null}
                  {tasker.isSettlementSuspended ? <Badge variant="destructive">suspended</Badge> : null}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-end">
                {!tasker.isVerified ? (
                  <Button size="sm" onClick={() => runAction(tasker.id, "approve")} disabled={Boolean(actionId)}>
                    Approve
                  </Button>
                ) : null}
                {!tasker.isRejected ? (
                  <Button size="sm" variant="outline" onClick={() => runAction(tasker.id, "reject")} disabled={Boolean(actionId)}>
                    Reject
                  </Button>
                ) : null}
                {tasker.isVerified ? (
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
        (statusFilter === "suspended" && user.isSuspended);

      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [items, roleFilter, search, statusFilter]);
  const paged = usePagedItems(filteredItems);
  const [phoneEdits, setPhoneEdits] = useState<Record<string, string>>({});
  const [actionId, setActionId] = useState<string | null>(null);

  const updateUser = async (user: ExcoUser, body: Record<string, unknown>) => {
    setActionId(user.id);
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
      description="Search users, update phone numbers, and manage account access inside this dashboard."
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
        </select>
      </div>
      {filteredItems.length === 0 ? (
        <EmptyState label="No users match these filters" />
      ) : null}
      <div className="space-y-3">
        {paged.pageItems.map((user) => (
          <div key={user.id} className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="font-semibold text-slate-950 dark:text-white">{user.name}</p>
                <p className="mt-1 text-xs text-slate-500">{user.email} - {user.role} - {user.orderCount} orders</p>
                {user.isSuspended ? <Badge variant="destructive" className="mt-2">suspended</Badge> : null}
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
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
                  disabled={actionId === user.id}
                  onClick={() => updateUser(user, { phone: phoneEdits[user.id] ?? user.phone })}
                >
                  Save Phone
                </Button>
                {allowSuspension && user.role !== "admin" ? (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={actionId === user.id}
                    onClick={() => updateUser(user, { action: user.isSuspended ? "activate" : "suspend" })}
                  >
                    {user.isSuspended ? "Activate" : "Suspend"}
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

function PieBreakdown({ data, emptyLabel }: { data: CountDatum[]; emptyLabel: string }) {
  if (!data.length) return <EmptyState label={emptyLabel} />;

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} dataKey="count" nameKey="label" innerRadius={54} outerRadius={92} paddingAngle={3}>
            {data.map((entry, index) => (
              <Cell key={entry.label} fill={CHART_COLORS[index % CHART_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip />
        </PieChart>
      </ResponsiveContainer>
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

function TrafficChart({ data }: { data: DashboardData["marketing"]["analytics"]["trafficChart"] }) {
  if (!data.length) return <EmptyState label="Traffic trends will appear after production visits" />;

  return (
    <div className="h-80">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <defs>
            <linearGradient id="pageViewsTrend" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#2563eb" stopOpacity={0.35} />
              <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="visitorTrend" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.35} />
              <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="date" tick={{ fontSize: 12 }} />
          <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
          <Tooltip />
          <Area type="monotone" dataKey="pageViews" stroke="#2563eb" fill="url(#pageViewsTrend)" />
          <Area type="monotone" dataKey="uniqueVisitors" stroke="#f59e0b" fill="url(#visitorTrend)" />
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
        <BarChart data={data} layout="vertical" margin={{ left: 14, right: 18 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} />
          <XAxis type="number" allowDecimals={false} />
          <YAxis
            dataKey="label"
            type="category"
            width={120}
            tick={{ fontSize: 12 }}
            tickFormatter={(value) => (value.length > 18 ? `${value.slice(0, 18)}...` : value)}
          />
          <Tooltip />
          <Bar dataKey="count" fill="#2563eb" radius={[0, 6, 6, 0]} />
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
          <PieBreakdown data={data.charts.settlementBreakdown} emptyLabel="No settlements recorded yet" />
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

function formatDate(value: string | null) {
  if (!value) return "Not set";
  return new Intl.DateTimeFormat("en-NG", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
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

function MarketingSections({ data }: { data: DashboardData }) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LineChart className="h-5 w-5 text-rose-600" />
            Analytics Traffic
          </CardTitle>
          <CardDescription>Page views and unique visitors from the existing analytics tracker.</CardDescription>
        </CardHeader>
        <CardContent>
          <TrafficChart data={data.marketing.analytics.trafficChart} />
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Top Pages</CardTitle>
            <CardDescription>Pages with the strongest visitor attention.</CardDescription>
          </CardHeader>
          <CardContent>
            <HorizontalBarChart data={data.marketing.analytics.topPages} emptyLabel="No page views recorded yet" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Referral Sources</CardTitle>
            <CardDescription>Channels bringing users into SwiftDU.</CardDescription>
          </CardHeader>
          <CardContent>
            <PieBreakdown data={data.marketing.analytics.topReferralSources} emptyLabel="No referral sources recorded yet" />
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
            <RankedList data={data.marketing.analytics.conversionEvents} emptyLabel="No conversion events recorded yet" />
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
          <PieBreakdown data={data.charts.statusBreakdown} emptyLabel="No status data recorded yet" />
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
          <PieBreakdown data={data.technology.deviceBreakdown} emptyLabel="No device data recorded yet" />
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

  useEffect(() => {
    async function loadDashboard() {
      try {
        const response = await fetch(`/api/exco/dashboard?role=${role}&days=30`, {
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
  }, [role]);

  const section = useMemo(() => {
    if (!data) return null;
    if (role === "CFO") return <FinanceSections data={data} />;
    if (role === "CMO") return <MarketingSections data={data} />;
    if (role === "COO") return <OperationsSections data={data} />;
    return <TechnologySections data={data} />;
  }, [data, role]);

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
            <Button variant="outline" onClick={() => router.push("/dashboard")}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              User Dashboard
            </Button>
            <Button onClick={() => router.push("/tasker-dashboard")}>
              Tasker Dashboard
            </Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {data.cards.map((item) => (
            <MetricCard key={item.label} item={item} />
          ))}
        </div>

        <InsightPanel insights={data.insights} />
        <ExcoManagementPanels role={role} />

        {section}
      </div>
    </div>
  );
}
