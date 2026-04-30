"use client";

import { useEffect, useMemo, useState } from "react";
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
  };
  operations: {
    totalOrders: number;
    previousOrders: number;
    completedOrders: number;
    pendingOrders: number;
    activeOrders: number;
    declinedTasks: number;
    activeTaskers: number;
    completionRate: number;
    averageResponseMinutes: number;
    reviews: number;
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

function RankedList({ data, emptyLabel }: { data: CountDatum[]; emptyLabel: string }) {
  if (!data.length) return <EmptyState label={emptyLabel} />;

  const max = Math.max(...data.map((item) => item.count), 1);

  return (
    <div className="space-y-4">
      {data.map((item) => (
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
  return (
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
          <CardDescription>Where work is sitting right now.</CardDescription>
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
      <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 md:px-8 md:py-8">
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

        {section}
      </div>
    </div>
  );
}
