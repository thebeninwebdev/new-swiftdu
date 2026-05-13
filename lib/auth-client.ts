import { createAuthClient } from "better-auth/react";
import {inferAdditionalFields, twoFactorClient} from "better-auth/client/plugins"
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
        taskerId: {
          type: "string",
          required: false,
        },
        excoRole: {
          type: "string",
          required: false,
          input: false,
        },
}
    }),
    passkeyClient(),
    twoFactorClient(),
  ]
});
