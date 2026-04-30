export const EXCO_ROLES = ["CFO", "CMO", "COO", "CTO"] as const;

export type ExcoRole = (typeof EXCO_ROLES)[number];

export const EXCO_DASHBOARD_PATHS: Record<ExcoRole, string> = {
  CFO: "/cfo-dashboard",
  CMO: "/cmo-dashboard",
  COO: "/coo-dashboard",
  CTO: "/cto-dashboard",
};

export const EXCO_ROLE_LABELS: Record<ExcoRole, string> = {
  CFO: "Chief Financial Officer",
  CMO: "Chief Marketing Officer",
  COO: "Chief Operations Officer",
  CTO: "Chief Technological Officer",
};

const ROLE_ALIASES: Record<string, ExcoRole> = {
  CFO: "CFO",
  CHIEFFINANCIALOFFICER: "CFO",
  FINANCE: "CFO",
  FINANCIAL: "CFO",
  CMO: "CMO",
  CHIEFMARKETINGOFFICER: "CMO",
  CHIEFMARKETTINGOFFICER: "CMO",
  MARKETING: "CMO",
  MARKETTING: "CMO",
  COO: "COO",
  CHIEFOPERATIONSOFFICER: "COO",
  OPERATIONS: "COO",
  OPERATION: "COO",
  CTO: "CTO",
  CHIEFTECHNOLOGICALOFFICER: "CTO",
  CHIEFTECHNOLOGYOFFICER: "CTO",
  TECHNOLOGY: "CTO",
  TECHNOLOGICAL: "CTO",
};

export function normalizeExcoRole(value?: string | null): ExcoRole | null {
  if (!value) return null;

  const normalized = value.trim().toUpperCase().replace(/[\s_-]/g, "");
  return ROLE_ALIASES[normalized] ?? null;
}

export function getExcoDashboardPath(role?: string | null) {
  const excoRole = normalizeExcoRole(role);
  return excoRole ? EXCO_DASHBOARD_PATHS[excoRole] : null;
}
