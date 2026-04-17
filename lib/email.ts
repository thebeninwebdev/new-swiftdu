import { Suspense, createElement, type ReactElement } from "react";
import { Resend, type Tag } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const EMAIL_ADDRESS_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface SendTransactionalEmailInput {
  to: string | string[];
  subject: string;
  react: ReactElement;
  tags?: Tag[];
  headers?: Record<string, string>;
}

function getEmailConfig() {
  const fromName = process.env.EMAIL_FROM_NAME?.trim();
  const fromAddress = process.env.EMAIL_FROM_ADDRESS?.trim().toLowerCase();
  const replyTo = process.env.EMAIL_REPLY_TO?.trim().toLowerCase() || fromAddress;

  if (!process.env.RESEND_API_KEY?.trim()) {
    throw new Error("RESEND_API_KEY is missing.");
  }

  if (!fromName || !fromAddress) {
    throw new Error("Email sender configuration is missing.");
  }

  if (!EMAIL_ADDRESS_PATTERN.test(fromAddress)) {
    throw new Error("EMAIL_FROM_ADDRESS must be a valid email address.");
  }

  if (replyTo && !EMAIL_ADDRESS_PATTERN.test(replyTo)) {
    throw new Error("EMAIL_REPLY_TO must be a valid email address.");
  }

  return {
    from: `${fromName} <${fromAddress}>`,
    replyTo,
  };
}

export async function sendTransactionalEmail(
  input: SendTransactionalEmailInput
) {
  const { from, replyTo } = getEmailConfig();
  const html = await renderEmailHtml(input.react);

  const response = await resend.emails.send({
    from,
    to: input.to,
    replyTo,
    subject: input.subject,
    html,
    headers: {
      "X-Auto-Response-Suppress": "OOF, AutoReply",
      "X-Entity-Ref-ID": `swiftdu-${crypto.randomUUID()}`,
      ...input.headers,
    },
    tags: [
      { name: "app", value: "swiftdu" },
      { name: "environment", value: process.env.NODE_ENV || "development" },
      ...(input.tags ?? []),
    ],
  });

  if (response.error) {
    throw new Error(response.error.message);
  }

  return response.data?.id ?? null;
}

async function renderEmailHtml(react: ReactElement) {
  const reactDomServer = await import("react-dom/server");

  if (
    "renderToReadableStream" in reactDomServer &&
    typeof WritableStream !== "undefined"
  ) {
    const suspenseWrappedEmail = createElement(
      Suspense,
      { fallback: null },
      react
    );

    const stream = await reactDomServer.renderToReadableStream(
      suspenseWrappedEmail,
      {
        onError(error) {
          throw error;
        },
      }
    );

    // Wait for all suspended work before reading the completed HTML.
    if ("allReady" in stream && stream.allReady) {
      await stream.allReady;
    }

    const reader = stream.getReader();
    const decoder = new TextDecoder("utf-8");
    let html = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      html += decoder.decode(value, { stream: true });
    }

    html += decoder.decode();
    return `<!DOCTYPE html>${html}`;
  }

  const { Writable } = await import("node:stream");

  return await new Promise<string>((resolve, reject) => {
    const chunks: Buffer[] = [];
    const suspenseWrappedEmail = createElement(
      Suspense,
      { fallback: null },
      react
    );

    const stream = reactDomServer.renderToPipeableStream(
      suspenseWrappedEmail,
      {
        onAllReady() {
          const writable = new Writable({
            write(chunk: Buffer, _encoding, callback) {
              chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
              callback();
            },
            final(callback) {
              resolve(`<!DOCTYPE html>${Buffer.concat(chunks).toString("utf-8")}`);
              callback();
            },
          });

          writable.on("error", reject);
          stream.pipe(writable);
        },
        onError(error) {
          reject(error);
        },
      }
    );
  });
}
