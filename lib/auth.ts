import { betterAuth, type BetterAuthPlugin } from "better-auth";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import clientPromise, { connectDB } from "./db";
import verifyEmail from "@/emails/verifyEmail";
import resetEmail from "@/emails/resetEmail";
import { User } from "@/models/user";
import { Resend } from "resend";
import { twoFactor } from "better-auth/plugins";

const resend = new Resend(process.env.RESEND_API_KEY as string);

const client = await clientPromise;
const db = client.db();

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
    sendVerificationEmail: async ({user, url}) => {
      resend.emails.send({
        from: `${process.env.EMAIL_FROM_NAME} <${process.env.EMAIL_FROM_ADDRESS}>`,
        to: user.email,
        subject: 'Verify your email address',
        react: verifyEmail({ url, name:user.name })
      })
    },
    sendOnSignUp: true
  },
  database: mongodbAdapter(db),
  emailAndPassword: { 
    enabled: true, 
    sendResetPassword: async ({user, url} ) => {
      resend.emails.send({
        from: `${process.env.EMAIL_FROM_NAME} <${process.env.EMAIL_FROM_ADDRESS}>`,
        to: user.email,
        subject: 'Reset your password',
        react: resetEmail({ url, email:user.email })
      })
    },
    requireEmailVerification: true,
  },
  user: {
    additionalFields: {
      role: {
        type: ["user","tasker", "admin",],
        required: false,
        defaultValue: "user",
        input: false,
      },
      phone: {
        type: "string",
        required: true,
      },
      location: {
        type: "string",
        required: true,
      },
      taskerId: {
        type: "string",
        required: false,
      }
    }
  },
  plugins:[
    twoFactor(),
    suspendedUserGuard(),
  ]
});

export type Auth = typeof auth;
