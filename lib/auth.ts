import { betterAuth, type BetterAuthPlugin } from "better-auth";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import { connectDB, getMongoDb } from "./db";
import { User } from "@/models/user";
import { emailOTP, twoFactor } from "better-auth/plugins";
import { passkey } from "@better-auth/passkey";
import { magicLink } from "better-auth/plugins";
import { AuthEmailRateLimit } from "@/models/auth-email-rate-limit";
import { AUTH_SESSION_SETTINGS, getAuthCookieAttributes, getCrossSubdomainCookieConfig } from "@/lib/auth-session-config";
import { getAuthBaseUrl, getTrustedOrigins } from "@/lib/site";
import { reconcileTaskerIdentityForUser } from "@/lib/tasker-onboarding";

const db = new Proxy({} as import("mongodb").Db, {
  get(_target, prop) {
    const realDb = getMongoDb();
    const value = Reflect.get(realDb, prop);
    return typeof value === "function" ? value.bind(realDb) : value;
  },
});

const authBaseUrl = getAuthBaseUrl();
const trustedOrigins = getTrustedOrigins();
const appURL = new URL(authBaseUrl);
// Share the production session between apex and www SwiftDU hosts.
const crossSubdomainCookieConfig = getCrossSubdomainCookieConfig(appURL.origin);

if (process.env.VERCEL_ENV === "preview") {
  console.info("[auth:preview-config]", {
    vercelEnv: process.env.VERCEL_ENV,
    vercelUrl: process.env.VERCEL_URL,
    vercelBranchUrl: process.env.VERCEL_BRANCH_URL,
    authBaseUrl,
    trustedOrigins,
  });
}
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
        matcher: (ctx) =>
          ctx.path === "/sign-in/email" || ctx.path === "/sign-in/magic-link" ||
          ctx.path === "/sign-in/email-otp" || ctx.path === "/email-otp/send-verification-otp",
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

const authEmailRequestGuard = (): BetterAuthPlugin => ({
  id: "auth-email-request-guard",
  hooks: {
    before: [{
      matcher: (ctx) => ctx.path === "/sign-in/magic-link" ||
        (ctx.path === "/email-otp/send-verification-otp" && ctx.body?.type === "sign-in"),
      handler: createAuthMiddleware(async (ctx) => {
        const email = typeof ctx.body?.email === "string" ? ctx.body.email.trim().toLowerCase() : "";
        if (!email) return;
        if (email.endsWith('@customer.swiftdu.invalid')) {
          throw APIError.from('BAD_REQUEST', { code: 'PROVISIONAL_EMAIL', message: 'Add and verify a real email address before signing in.' });
        }

        await connectDB();
        const now = new Date();
        const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);
        const cooldownAgo = new Date(now.getTime() - 60 * 1000);
        const existing = await AuthEmailRateLimit.findOne({ email }).lean();

        if (existing?.lastSentAt && existing.lastSentAt > cooldownAgo) {
          throw APIError.from("TOO_MANY_REQUESTS", { code: "MAGIC_LINK_COOLDOWN", message: "Please wait 60 seconds before requesting another link." });
        }
        if (existing?.windowStartedAt && existing.windowStartedAt > hourAgo && existing.sendCount >= 5) {
          throw APIError.from("TOO_MANY_REQUESTS", { code: "MAGIC_LINK_HOURLY_LIMIT", message: "Too many sign-in links requested. Please try again later." });
        }

        if (!existing || existing.windowStartedAt <= hourAgo) {
          await AuthEmailRateLimit.findOneAndUpdate(
            { email },
            { $set: { windowStartedAt: now, lastSentAt: now, sendCount: 1, expiresAt: new Date(now.getTime() + 2 * 60 * 60 * 1000) } },
            { upsert: true }
          );
        } else {
          await AuthEmailRateLimit.updateOne({ email }, { $set: { lastSentAt: now, expiresAt: new Date(now.getTime() + 2 * 60 * 60 * 1000) }, $inc: { sendCount: 1 } });
        }
      }),
    }],
  },
});

const requiredSignupDetailsGuard = (): BetterAuthPlugin => ({
  id: "required-signup-details-guard",
  hooks: {
    before: [
      {
        matcher: (ctx) => ctx.path === "/sign-up/email",
        handler: createAuthMiddleware(async (ctx) => {
          const phone =
            typeof ctx.body?.phone === "string" ? ctx.body.phone.trim() : "";
          const location =
            typeof ctx.body?.location === "string"
              ? ctx.body.location.trim()
              : "";

          if (!phone) {
            throw APIError.from("BAD_REQUEST", {
              code: "PHONE_REQUIRED",
              message: "Phone number is required.",
            });
          }

          if (!location) {
            throw APIError.from("BAD_REQUEST", {
              code: "LOCATION_REQUIRED",
              message: "Location is required.",
            });
          }
        }),
      },
    ],
  },
});

export const auth = betterAuth({
  appName: "SwiftDU",
  baseURL: appURL.origin,
  trustedOrigins,
  session: AUTH_SESSION_SETTINGS,
  advanced: {
    defaultCookieAttributes: getAuthCookieAttributes(),
    ...(crossSubdomainCookieConfig
      ? { crossSubDomainCookies: crossSubdomainCookieConfig }
      : {}),
  },
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
      defaultLocation: { type: "string", required: false },
      profileImage: {
        type: "string",
        required: false,
      },
      profileImagePublicId: {
        type: "string",
        required: false,
      },
      gender: {
        type: "string",
        required: false,
      },
      dateOfBirth: {
        type: "date",
        required: false,
      },
      birthdayDay: { type: "number", required: false },
      birthdayMonth: { type: "number", required: false },
      taskerId: {
        type: "string",
        required: false,
        input: false,
      },
      isExco: {
        type: "boolean",
        required: false,
        defaultValue: false,
        input: false,
      },
      testOrderMode: {
        type: "boolean",
        required: false,
        defaultValue: false,
        input: false,
      },
      excoRole: {
        type: "string",
        required: false,
        input: false,
      },
    },
  },
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          // A logged-out Tasker applicant can create their SwiftDU account
          // later. Link only a safely identifiable existing application.
          try {
            await reconcileTaskerIdentityForUser(user.id);
          } catch (error) {
            console.warn('[auth] tasker identity reconciliation requires review', error);
          }
        },
      },
    },
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
        after: async (session) => {
          // Covers existing accounts signing in after an application was made.
          try {
            await reconcileTaskerIdentityForUser(session.userId);
          } catch (error) {
            console.warn('[auth] tasker identity reconciliation requires review', error);
          }
        },
      },
    },
  },
  plugins: [
    emailOTP({
      expiresIn: 5 * 60,
      allowedAttempts: 5,
      storeOTP: "hashed",
      rateLimit: { window: 60, max: 5 },
      sendVerificationOTP: async ({ email, otp, type }) => {
        if (type !== "sign-in") return;
        if (process.env.NODE_ENV === "test") {
          const capture = (globalThis as { __captureSwiftDUEmailOtp?: (otp: string) => void }).__captureSwiftDUEmailOtp;
          if (capture) {
            capture(otp);
            return;
          }
        }
        if (process.env.AUTH_SEND_REAL_EMAILS === "false") {
          if (process.env.NODE_ENV === "production") throw new Error("AUTH_SEND_REAL_EMAILS=false is not allowed in production.");
          console.info("[email-otp:development]", { email, deliverySuppressed: true });
          return;
        }
        const [{ default: EmailOtpEmail }, { sendTransactionalEmail }] = await Promise.all([
          import("@/emails/emailOtpEmail"),
          import("./email"),
        ]);
        await sendTransactionalEmail({
          to: email,
          subject: "Your SwiftDU sign-in code",
          react: EmailOtpEmail({ otp }),
          tags: [{ name: "email_type", value: "email_otp" }, { name: "auth_flow", value: "sign_in" }],
        });
      },
    }),
    magicLink({
      expiresIn: 15 * 60,
      storeToken: "hashed",
      rateLimit: { window: 60, max: 5 },
      sendMagicLink: async ({ email, url }) => {
        if (process.env.NODE_ENV === "test") {
          const capture = (globalThis as { __captureSwiftDUMagicLink?: (url: string) => void }).__captureSwiftDUMagicLink;
          if (capture) {
            capture(url);
            return;
          }
        }
        if (process.env.AUTH_SEND_REAL_EMAILS === "false") {
          if (process.env.NODE_ENV === "production") throw new Error("AUTH_SEND_REAL_EMAILS=false is not allowed in production.");
          console.info("[magic-link:development]", { email, deliverySuppressed: true });
          return;
        }
        const [{ default: MagicLinkEmail }, { sendTransactionalEmail }] = await Promise.all([
          import("@/emails/magicLinkEmail"),
          import("./email"),
        ]);
        await sendTransactionalEmail({
          to: email,
          subject: "Your secure SwiftDU sign-in link",
          react: MagicLinkEmail({ url }),
          tags: [{ name: "email_type", value: "magic_link" }, { name: "auth_flow", value: "sign_in" }],
        });
      },
    }),
    passkey({
      rpID: appURL.hostname,
      rpName: "SwiftDU",
      origin: appURL.origin,
    }),
    twoFactor(),
    suspendedUserGuard(),
    authEmailRequestGuard(),
    requiredSignupDetailsGuard(),
  ],
});

export type Auth = typeof auth;
