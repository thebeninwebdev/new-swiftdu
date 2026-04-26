This is the SwiftDU Next.js application.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Twilio WhatsApp Alerts

Order admin alerts support email plus WhatsApp notifications through Twilio. New bookings and booking cancellations will send a WhatsApp alert to the configured admin number directly from the app server.

Add these environment variables:

```bash
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_WHATSAPP_FROM=+14155238886
WHATSAPP_ALERT_RECIPIENTS=2349014116505
```

You can also use `TWILIO_WHATSAPP_TO` instead of `WHATSAPP_ALERT_RECIPIENTS`, and `TWILIO_MESSAGING_SERVICE_SID` instead of `TWILIO_WHATSAPP_FROM` if you prefer a messaging service.

For Google sign-in, make sure your Google OAuth app allows this redirect URI:

```bash
http://localhost:3000/api/auth/callback/google
```

In production, add the matching deployed callback URL too, for example `https://your-domain.com/api/auth/callback/google`.

If you are using the Twilio WhatsApp sandbox, the recipient number must join the sandbox first. For a production WhatsApp sender, Twilio and Meta may require an approved sender or template before business-initiated messages can be delivered reliably.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
