import { Suspense, createElement, type ReactElement } from "react";
import { Resend, type Tag } from "resend";

import {
  getEmailFromAddress,
  getEmailFromName,
  getEmailReplyTo,
} from "@/lib/email-config";
import { sendWhatsAppAdminAlert } from "@/lib/whatsapp";

const resend = new Resend(process.env.RESEND_API_KEY);

const EMAIL_ADDRESS_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface SendTransactionalEmailInput {
  to: string | string[];
  subject: string;
  react: ReactElement;
  replyTo?: string;
  tags?: Tag[];
  headers?: Record<string, string>;
}

function getRecipientSummary(to: string | string[]) {
  if (Array.isArray(to)) {
    return to.length <= 3 ? to.join(", ") : `${to.length} recipients`;
  }

  return to;
}

async function notifyEmailFailureViaWhatsApp(
  input: SendTransactionalEmailInput,
  error: Error
) {
  const emailType =
    input.tags?.find((tag) => tag.name === "email_type")?.value || "transactional";

  try {
    await sendWhatsAppAdminAlert({
      dedupeKey: ["email-failure", emailType, input.subject, error.message].join("|"),
      message: [
        "SwiftDU email delivery failed.",
        `Type: ${emailType}`,
        `Subject: ${input.subject}`,
        `To: ${getRecipientSummary(input.to)}`,
        `Error: ${error.message}`,
      ].join("\n"),
    });
  } catch (whatsAppError) {
    console.error("[Email Failure WhatsApp Fallback Error]:", whatsAppError);
  }
}

function getEmailConfig() {
  const fromName = getEmailFromName();
  const fromAddress = getEmailFromAddress();
  const replyTo = getEmailReplyTo();

  if (!process.env.RESEND_API_KEY?.trim()) {
    throw new Error("RESEND_API_KEY is missing.");
  }

  if (!fromName || !fromAddress) {
    throw new Error("Email sender configuration is missing.");
  }

  if (!EMAIL_ADDRESS_PATTERN.test(fromAddress)) {
    throw new Error("The configured support email address must be valid.");
  }

  if (replyTo && !EMAIL_ADDRESS_PATTERN.test(replyTo)) {
    throw new Error("The configured reply-to email address must be valid.");
  }

  return {
    from: `${fromName} <${fromAddress}>`,
    replyTo,
  };
}

export async function sendTransactionalEmail(
  input: SendTransactionalEmailInput
) {
  try {
    const { from, replyTo: defaultReplyTo } = getEmailConfig();
    const html = await renderEmailHtml(input.react);
    const replyTo = input.replyTo?.trim().toLowerCase() || defaultReplyTo;

    if (replyTo && !EMAIL_ADDRESS_PATTERN.test(replyTo)) {
      throw new Error("replyTo must be a valid email address.");
    }

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
  } catch (error) {
    const resolvedError =
      error instanceof Error ? error : new Error("Failed to send email.");

    await notifyEmailFailureViaWhatsApp(input, resolvedError);
    throw resolvedError;
  }
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
