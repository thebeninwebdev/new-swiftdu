import { Types } from "mongoose";

import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { User } from "@/models/user";
import {
  EXCO_DASHBOARD_PATHS,
  EXCO_ROLE_LABELS,
  EXCO_ROLES,
  getExcoDashboardPath,
  normalizeExcoRole,
  type ExcoRole,
} from "@/lib/exco-constants";

export {
  EXCO_DASHBOARD_PATHS,
  EXCO_ROLE_LABELS,
  EXCO_ROLES,
  getExcoDashboardPath,
  normalizeExcoRole,
  type ExcoRole,
};

export interface ExcoAccess {
  isAuthenticated: boolean;
  userId?: string;
  userRole?: string;
  taskerId?: string;
  excoRole: ExcoRole | null;
}

export async function getExcoAccess(headers: Headers): Promise<ExcoAccess> {
  const session = await auth.api.getSession({ headers });

  if (!session?.user) {
    return {
      isAuthenticated: false,
      excoRole: null,
    };
  }

  const sessionUser = session.user as {
    id?: string;
    role?: string;
    taskerId?: string;
    excoRole?: string | null;
  };

  let dbUser:
    | {
        role?: string;
        taskerId?: string;
        excoRole?: string | null;
      }
    | null = null;

  if (sessionUser.id && Types.ObjectId.isValid(sessionUser.id)) {
    await connectDB();
    dbUser = await User.findById(sessionUser.id)
      .select("role taskerId excoRole")
      .lean<{
        role?: string;
        taskerId?: string;
        excoRole?: string | null;
      }>();
  }

  return {
    isAuthenticated: true,
    userId: sessionUser.id,
    userRole: dbUser?.role ?? sessionUser.role,
    taskerId: dbUser?.taskerId ?? sessionUser.taskerId,
    excoRole: normalizeExcoRole(dbUser?.excoRole ?? sessionUser.excoRole),
  };
}

export async function hasExcoRole(headers: Headers, requiredRole: ExcoRole) {
  const access = await getExcoAccess(headers);
  return access.isAuthenticated && access.excoRole === requiredRole;
}
