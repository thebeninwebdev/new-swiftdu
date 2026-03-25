import { createAuthClient } from "better-auth/react";
import {inferAdditionalFields, twoFactorClient} from "better-auth/client/plugins"

export const authClient = createAuthClient({
  baseURL: process.env.BASE_URL || "http://localhost:3000",
  plugins: [
    inferAdditionalFields({
      user: {
        role: {
            type: 'string',
            required: false,
            defaultValue: 'string',
            input: false,
        },
        phone: {
            type: "string",
            required: true,
        },
        location: {
            type: "string",
            required: true,
        }
}
    }),
    twoFactorClient(),
  ]
});