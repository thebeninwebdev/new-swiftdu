interface WhatsAppTextPayload {
  messaging_product: 'whatsapp';
  to: string;
  type: 'text';
  text: {
    body: string;
  };
}

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

function requireWhatsAppSendEnv() {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN?.trim();
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim();

  if (!accessToken || !phoneNumberId) {
    throw new Error('WhatsApp send environment variables are missing.');
  }

  return { accessToken, phoneNumberId };
}

async function sendWhatsAppPayload(payload: WhatsAppMessagePayload, logLabel: string) {
  try {
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

export async function sendWhatsAppText(to: string, body: string) {
  const payload: WhatsAppTextPayload = {
    messaging_product: 'whatsapp',
    to,
    type: 'text',
    text: { body },
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
      action: {
        button: buttonText,
        sections,
      },
    },
  };

  await sendWhatsAppPayload(payload, 'WhatsApp List Message Send Error');
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
