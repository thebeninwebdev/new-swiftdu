import { betterAuth } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import clientPromise from "./db";
import verifyEmail from "@/emails/verifyEmail";
import resetEmail from "@/emails/resetEmail";
import { Resend } from "resend";
import { twoFactor } from "better-auth/plugins";

const resend = new Resend(process.env.RESEND_API_KEY as string);

const client = await clientPromise;
const db = client.db();

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
    twoFactor()
  ]
});

export type Auth = typeof auth;