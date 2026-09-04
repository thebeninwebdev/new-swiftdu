import { createAuthClient } from "better-auth/react";
import {inferAdditionalFields, magicLinkClient, twoFactorClient} from "better-auth/client/plugins"
import { passkeyClient } from "@better-auth/passkey/client";

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000",
  plugins: [
    inferAdditionalFields({
      user: {
        role: {
            type: 'string',
            required: false,
            defaultValue: 'user',
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
        excoRole: {
          type: "string",
          required: false,
          input: false,
        },
}
    }),
    passkeyClient(),
    magicLinkClient(),
    twoFactorClient(),
  ]
});
