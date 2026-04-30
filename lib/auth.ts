import { betterAuth, type BetterAuthPlugin } from "better-auth";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import clientPromise, { connectDB } from "./db";
import { User } from "@/models/user";
import { twoFactor } from "better-auth/plugins";

const client = await clientPromise;
const db = client.db();
const googleClientId =
  process.env.GOOGLE_CLIENT_ID?.trim() ||
  process.env.AUTH_GOOGLE_ID?.trim() ||
  "";
const googleClientSecret =
  process.env.GOOGLE_CLIENT_SECRET?.trim() ||
  process.env.AUTH_GOOGLE_SECRET?.trim() ||
  "";

const suspendedUserGuard = (): BetterAuthPlugin => ({
  id: "suspended-user-guard",
  hooks: {
    before: [
      {
        matcher: (ctx) => ctx.path === "/sign-in/email",
        handler: createAuthMiddleware(async (ctx) => {
          const email =
            typeof ctx.body?.email === "string"
              ? ctx.body.email.trim().toLowerCase()
              : "";

          if (!email) {
            return;
          }

          await connectDB();

          const user = await User.findOne({ email })
            .select("isSuspended")
            .lean();

          if (user?.isSuspended) {
            throw APIError.from("FORBIDDEN", {
              code: "USER_SUSPENDED",
              message:
                "Your account has been suspended. Please contact support.",
            });
          }
        }),
      },
    ],
  },
});

export const auth = betterAuth({
  appName: "SwiftDU",
  emailVerification: {
    sendVerificationEmail: async ({ user, url }) => {
      const [{ default: verifyEmail }, { sendTransactionalEmail }] =
        await Promise.all([
          import("@/emails/verifyEmail"),
          import("./email"),
        ]);

      await sendTransactionalEmail({
        to: user.email,
        subject: "Verify your email address",
        react: verifyEmail({ url, name: user.name }),
        tags: [
          { name: "email_type", value: "verification" },
          { name: "auth_flow", value: "signup" },
        ],
      });
    },
    sendOnSignUp: false,
  },
  database: mongodbAdapter(db),
  emailAndPassword: {
    enabled: true,
    sendResetPassword: async ({ user, url }) => {
      const [{ default: resetEmail }, { sendTransactionalEmail }] =
        await Promise.all([
          import("@/emails/resetEmail"),
          import("./email"),
        ]);

      await sendTransactionalEmail({
        to: user.email,
        subject: "Reset your password",
        react: resetEmail({ url, email: user.email }),
        tags: [
          { name: "email_type", value: "password_reset" },
          { name: "auth_flow", value: "password_reset" },
        ],
      });
    },
    requireEmailVerification: true,
  },
  socialProviders:
    googleClientId && googleClientSecret
      ? {
          google: {
            clientId: googleClientId,
            clientSecret: googleClientSecret,
          },
        }
      : {},
  account: {
    accountLinking: {
      trustedProviders: ["google"],
    },
  },
  user: {
    additionalFields: {
      role: {
        type: ["user", "tasker", "admin"],
        required: false,
        defaultValue: "user",
        input: false,
      },
      phone: {
        type: "string",
        required: false,
      },
      location: {
        type: "string",
        required: false,
      },
      taskerId: {
        type: "string",
        required: false,
      },
      excoRole: {
        type: "string",
        required: false,
        input: false,
      },
    },
  },
  databaseHooks: {
    session: {
      create: {
        before: async (session) => {
          await connectDB();

          const user = await User.findById(session.userId)
            .select("isSuspended")
            .lean();

          if (user?.isSuspended) {
            throw APIError.from("FORBIDDEN", {
              code: "USER_SUSPENDED",
              message:
                "Your account has been suspended. Please contact support.",
            });
          }
        },
      },
    },
  },
  plugins: [
    twoFactor(),
    suspendedUserGuard(),
  ],
});

export type Auth = typeof auth;
