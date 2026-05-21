interface WhatsAppTextPayload {
  messaging_product: 'whatsapp';
  to: string;
  type: 'text';
  text: {
    body: string;
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

export async function sendWhatsAppText(to: string, body: string) {
  try {
    const { accessToken, phoneNumberId } = requireWhatsAppSendEnv();
    const payload: WhatsAppTextPayload = {
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body },
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
      console.error('[WhatsApp Send Error]:', response.status, errorBody);
    }
  } catch (error) {
    console.error('[WhatsApp Send Error]:', error);
  }
}
