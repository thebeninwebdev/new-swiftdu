import { ReactElement } from 'react';

interface SendEmailParams {
  to: string | string[];
  subject: string;
  htmlContent: string;
  senderName?: string;
  senderEmail?: string;
  replyTo?: string;
  tags?: string[];
}

interface BrevoContact {
  email: string;
  firstName?: string;
  lastName?: string;
}

interface BrevoEmailParams {
  to: BrevoContact[];
  subject: string;
  htmlContent: string;
  sender?: {
    name: string;
    email: string;
  };
  replyTo?: {
    email: string;
    name?: string;
  };
  tags?: string[];
}

interface BrevoErrorResponse {
  code?: string;
  message?: string;
}

function getBrevoApiKey(): string {
  const key = process.env.BREVO_API_KEY?.trim();
  if (!key) {
    throw new Error('BREVO_API_KEY is not configured');
  }
  return key;
}

function getSenderConfig() {
  return {
    name: process.env.EMAIL_FROM_NAME?.trim() || 'SwiftDU Support',
    email: process.env.EMAIL_FROM_ADDRESS?.trim() || 'support@swiftdu.org',
  };
}

export async function sendBrevoEmail(params: SendEmailParams): Promise<string | null> {
  try {
    const apiKey = getBrevoApiKey();
    const senderConfig = getSenderConfig();

    const toEmails = Array.isArray(params.to) ? params.to : [params.to];
    const contacts: BrevoContact[] = toEmails.map((email) => ({
      email: email.toLowerCase().trim(),
    }));

    const brevoParams: BrevoEmailParams = {
      to: contacts,
      subject: params.subject,
      htmlContent: params.htmlContent,
      sender: {
        name: params.senderName || senderConfig.name,
        email: params.senderEmail || senderConfig.email,
      },
      tags: params.tags || ['transactional'],
    };

    if (params.replyTo) {
      brevoParams.replyTo = {
        email: params.replyTo,
      };
    }

    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(brevoParams),
    });

    const data = await response.json();

    if (!response.ok) {
      const errorData = data as BrevoErrorResponse;
      throw new Error(`Brevo API error: ${errorData.message || response.statusText}`);
    }

    if ((data as any)?.messageId) {
      console.log('[Brevo] Email sent successfully', {
        messageId: (data as any).messageId,
        to: params.to,
        subject: params.subject,
      });
      return (data as any).messageId;
    }

    throw new Error(`Brevo returned unexpected response: ${JSON.stringify(data)}`);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';

    console.error('[Brevo] Email send failed', {
      to: params.to,
      subject: params.subject,
      error: errorMessage,
    });

    throw error;
  }
}

export async function sendBrevoEmailWithReactComponent(params: {
  to: string | string[];
  subject: string;
  react: ReactElement;
  senderName?: string;
  senderEmail?: string;
  replyTo?: string;
  tags?: string[];
}): Promise<string | null> {
  try {
    const htmlContent = await renderEmailHtml(params.react);

    return sendBrevoEmail({
      to: params.to,
      subject: params.subject,
      htmlContent,
      senderName: params.senderName,
      senderEmail: params.senderEmail,
      replyTo: params.replyTo,
      tags: params.tags,
    });
  } catch (error) {
    console.error('[Brevo] React email render failed', error);
    throw error;
  }
}

async function renderEmailHtml(react: ReactElement): Promise<string> {
  const { Suspense, createElement } = await import('react');
  const reactDomServer = await import('react-dom/server');

  if (
    'renderToReadableStream' in reactDomServer &&
    typeof WritableStream !== 'undefined'
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

    if ('allReady' in stream && stream.allReady) {
      await stream.allReady;
    }

    const reader = stream.getReader();
    const decoder = new TextDecoder('utf-8');
    let html = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      html += decoder.decode(value, { stream: true });
    }

    html += decoder.decode();
    return `<!DOCTYPE html>${html}`;
  }

  const { Writable } = await import('node:stream');

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
              resolve(`<!DOCTYPE html>${Buffer.concat(chunks).toString('utf-8')}`);
              callback();
            },
          });

          writable.on('error', reject);
          stream.pipe(writable);
        },
        onError(error) {
          reject(error);
        },
      }
    );
  });
}
