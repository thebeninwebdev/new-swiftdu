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

## WhatsApp Alerts

Order admin alerts now support both email and WhatsApp notifications. New bookings and booking cancellations will send a WhatsApp alert to the configured admin number when the WhatsApp worker is available.

Set these environment variables for the worker:

```bash
WHATSAPP_WEB_ENABLED=true
WHATSAPP_ALERT_RECIPIENTS=2349014116505
WHATSAPP_WEB_HEADLESS=true
WHATSAPP_WEB_SESSION_NAME=swiftdu-admin-alerts
```

Leave `WHATSAPP_WEB_CHROME_PATH` unset to use the default Chrome or Chromium executable.

Start the worker with:

```bash
npm run whatsapp:worker
```

Important: `whatsapp-web.js` needs a long-lived Node.js process plus writable session storage. Because this app is hosted on Vercel, the WhatsApp worker cannot stay authenticated inside Vercel Functions. Keep the web app on Vercel if you like, but run the WhatsApp worker on a persistent Node host such as a VPS, Railway, or Render service. The first worker start will print a QR code in the server logs so you can link your WhatsApp account.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
