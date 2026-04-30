import { ObjectId, type Filter } from "mongodb";

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
  email?: string;
  userRole?: string;
  taskerId?: string;
  excoRole: ExcoRole | null;
}

interface UserAccessSnapshot {
  _id?: ObjectId;
  id?: string;
  email?: string;
  role?: string;
  taskerId?: string;
  excoRole?: string | null;
}

async function findUserAccessSnapshot({
  id,
  email,
}: {
  id?: string;
  email?: string | null;
}) {
  const lookup: Array<Filter<UserAccessSnapshot>> = [];

  if (id) {
    if (ObjectId.isValid(id)) {
      lookup.push({ _id: new ObjectId(id) });
    }

    lookup.push({ id });
  }

  const normalizedEmail = email?.trim().toLowerCase();
  if (normalizedEmail) {
    lookup.push({ email: normalizedEmail });
  }

  if (lookup.length === 0) return null;

  await connectDB();

  return User.collection.findOne<UserAccessSnapshot>(
    { $or: lookup },
    { projection: { role: 1, taskerId: 1, excoRole: 1 } }
  );
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
    email?: string | null;
    role?: string;
    taskerId?: string;
    excoRole?: string | null;
  };

  const dbUser = await findUserAccessSnapshot({
    id: sessionUser.id,
    email: sessionUser.email,
  });

  return {
    isAuthenticated: true,
    userId: sessionUser.id,
    email: sessionUser.email ?? undefined,
    userRole: dbUser?.role ?? sessionUser.role,
    taskerId: dbUser?.taskerId ?? sessionUser.taskerId,
    excoRole: normalizeExcoRole(dbUser?.excoRole ?? sessionUser.excoRole),
  };
}

export async function hasExcoRole(headers: Headers, requiredRole: ExcoRole) {
  const access = await getExcoAccess(headers);
  return access.isAuthenticated && access.excoRole === requiredRole;
}
