import { createAuthClient } from "better-auth/react";
import {inferAdditionalFields, twoFactorClient} from "better-auth/client/plugins"

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
    twoFactorClient(),
  ]
});
