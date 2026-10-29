interface WhatsAppTextPayload {
  messaging_product: 'whatsapp';
  to: string;
  type: 'text';
  text: {
    body: string;
  };
}

import { connectDB } from '@/lib/db';
import { WhatsAppSession } from '@/models/whatsapp-session';
import { isWithinWhatsAppCustomerServiceWindow } from './window';

const WHATSAPP_MESSAGE_FOOTER = 'Sammy from SwiftDU';

export type WhatsAppListSection = {
  title?: string;
  rows: Array<{
    id: string;
    title: string;
    description?: string;
  }>;
};

export type WhatsAppReplyButton = {
  id: string;
  title: string;
};

interface WhatsAppListPayload {
  messaging_product: 'whatsapp';
  to: string;
  type: 'interactive';
  interactive: {
    type: 'list';
    body: {
      text: string;
    };
    footer?: {
      text: string;
    };
    action: {
      button: string;
      sections: WhatsAppListSection[];
    };
  };
}

interface WhatsAppReplyButtonsPayload {
  messaging_product: 'whatsapp';
  to: string;
  type: 'interactive';
  interactive: {
    type: 'button';
    body: {
      text: string;
    };
    footer?: {
      text: string;
    };
    action: {
      buttons: Array<{
        type: 'reply';
        reply: WhatsAppReplyButton;
      }>;
    };
  };
}

type WhatsAppMessagePayload =
  | WhatsAppTextPayload
  | WhatsAppListPayload
  | WhatsAppReplyButtonsPayload;

type WhatsAppTemplatePayload = {
  messaging_product: 'whatsapp';
  to: string;
  type: 'template';
  template: { name: string; language: { code: string }; components?: unknown[] };
};

interface WhatsAppReadPayload {
  messaging_product: 'whatsapp';
  status: 'read';
  message_id: string;
  typing_indicator?: {
    type: 'text';
  };
}

function requireWhatsAppSendEnv() {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN?.trim();
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim();

  if (!accessToken || !phoneNumberId) {
    throw new Error('WhatsApp send environment variables are missing.');
  }

  return { accessToken, phoneNumberId };
}

async function sendWhatsAppPayload(payload: WhatsAppMessagePayload | WhatsAppTemplatePayload, logLabel: string, bypassWindow = false) {
  try {
    if (!bypassWindow) {
      await connectDB();
      const session = await WhatsAppSession.findOne({ phone: payload.to }).select('lastCustomerMessageAt').lean();
      if (!isWithinWhatsAppCustomerServiceWindow(session?.lastCustomerMessageAt)) {
        console.warn('[WhatsApp Compliance] Free-form message suppressed outside 24-hour window.');
        return;
      }
    }
    const { accessToken, phoneNumberId } = requireWhatsAppSendEnv();

    const response = await fetch(
      `https://graph.facebook.com/v20.0/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      }
    );

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`WhatsApp send failed with ${response.status}: ${errorBody}`);
    }
  } catch (error) {
    console.error(`[${logLabel}]:`, error);
    throw error;
  }
}

export async function sendWhatsAppTemplate(input: {
  to: string;
  templateName?: string;
  languageCode?: string;
  components?: unknown[];
}) {
  const name = input.templateName?.trim() || process.env.WHATSAPP_TEMPLATE_NAME?.trim();
  const languageCode = input.languageCode?.trim() || process.env.WHATSAPP_TEMPLATE_LANGUAGE_CODE?.trim() || 'en_US';
  if (!name) {
    console.warn('[WhatsApp Compliance] No approved template configured; message suppressed outside 24-hour window.');
    return;
  }
  await sendWhatsAppPayload({
    messaging_product: 'whatsapp',
    to: input.to,
    type: 'template',
    template: { name, language: { code: languageCode }, components: input.components },
  }, 'WhatsApp Template Send Error', true);
}

function withWhatsAppFooter(body: string) {
  return `${body}\n\n${WHATSAPP_MESSAGE_FOOTER}`;
}

export async function sendWhatsAppText(to: string, body: string) {
  const payload: WhatsAppTextPayload = {
    messaging_product: 'whatsapp',
    to,
    type: 'text',
    text: { body: withWhatsAppFooter(body) },
  };

  await sendWhatsAppPayload(payload, 'WhatsApp Text Send Error');
}

export async function sendWhatsAppListMessage({
  to,
  body,
  buttonText,
  sections,
}: {
  to: string;
  body: string;
  buttonText: string;
  sections: WhatsAppListSection[];
}) {
  const payload: WhatsAppListPayload = {
    messaging_product: 'whatsapp',
    to,
    type: 'interactive',
    interactive: {
      type: 'list',
      body: { text: body },
      footer: { text: WHATSAPP_MESSAGE_FOOTER },
      action: {
        button: buttonText,
        sections,
      },
    },
  };

  await sendWhatsAppPayload(payload, 'WhatsApp List Message Send Error');
}

export async function sendWhatsAppWelcomeMenu(to: string, name?: string | null) {
  await sendWhatsAppListMessage({
    to,
    body: `Hello${name ? ` ${name}` : ''}\nHow may I assist you today?`,
    buttonText: 'Choose option',
    sections: [
      {
        rows: [
          { id: 'ORDER_FOOD', title: 'Order food' },
          { id: 'TRACK_ORDER', title: 'Track order' },
          { id: 'CANCEL_ORDER', title: 'Cancel order' },
          { id: 'SUPPORT', title: 'Speak to support' },
          { id: 'GET_WEBSITE_LINK', title: 'Get website link' },
        ],
      },
    ],
  });
}

export async function sendWhatsAppReplyButtons({
  to,
  body,
  buttons,
}: {
  to: string;
  body: string;
  buttons: WhatsAppReplyButton[];
}) {
  const payload: WhatsAppReplyButtonsPayload = {
    messaging_product: 'whatsapp',
    to,
    type: 'interactive',
    interactive: {
      type: 'button',
      body: { text: body },
      footer: { text: WHATSAPP_MESSAGE_FOOTER },
      action: {
        buttons: buttons.map((button) => ({
          type: 'reply',
          reply: button,
        })),
      },
    },
  };

  await sendWhatsAppPayload(payload, 'WhatsApp Reply Buttons Send Error');
}

export async function markWhatsAppMessageRead(messageId: string, showTyping = true) {
  try {
    const { accessToken, phoneNumberId } = requireWhatsAppSendEnv();
    const payload: WhatsAppReadPayload = {
      messaging_product: 'whatsapp',
      status: 'read',
      message_id: messageId,
      ...(showTyping ? { typing_indicator: { type: 'text' as const } } : {}),
    };

    const response = await fetch(
      `https://graph.facebook.com/v20.0/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      }
    );

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`WhatsApp read receipt failed with ${response.status}: ${errorBody}`);
    }
  } catch (error) {
    console.error('[WhatsApp Read Receipt / Typing Indicator Error]:', error);
  }
}
