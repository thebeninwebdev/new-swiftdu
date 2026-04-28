interface TelegramMessage {
  chat_id: string;
  text: string;
  parse_mode?: 'HTML' | 'Markdown' | 'MarkdownV2';
}

interface TelegramSendMessageResponse {
  ok: boolean;
  result?: {
    message_id: number;
    chat: {
      id: number;
      type: string;
      username?: string;
    };
    date: number;
    text: string;
  };
  description?: string;
}

function getTelegramBotToken() {
  return (
    process.env.TELEGRAM_BOT_TOKEN?.trim() ||
    process.env.TELEGRAM_BOT_API_TOKEN?.trim()
  );
}

function getTelegramChatId() {
  return (
    process.env.TELEGRAM_CHANNEL_ID?.trim() ||
    process.env.TELEGRAM_CHAT_ID?.trim()
  );
}

export async function sendTelegramMessage(
  text: string,
  chatId?: string
): Promise<boolean> {
  const botToken = getTelegramBotToken();
  const targetChatId = chatId || getTelegramChatId();

  if (!botToken) {
    console.error('[Telegram] bot token not configured');
    return false;
  }

  if (!targetChatId) {
    console.error('[Telegram] chat id not configured');
    return false;
  }

  try {
    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;

    const message: TelegramMessage = {
      chat_id: targetChatId,
      text,
      parse_mode: 'HTML',
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });

    const data: TelegramSendMessageResponse = await response.json();

    if (!data.ok) {
      console.error('Telegram API error:', data.description);
      console.error('Failed to send message to:', targetChatId);
      console.error('Full response:', JSON.stringify(data, null, 2));
      return false;
    }

    console.log('Telegram message sent successfully to:', targetChatId);
    return true;
  } catch (error) {
    console.error('Error sending Telegram message:', error);
    return false;
  }
}

export async function getChatInfo(chatId?: string) {
  const botToken = getTelegramBotToken();
  const targetChatId = chatId || getTelegramChatId();

  if (!botToken || !targetChatId) {
    return null;
  }

  try {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/getChat?chat_id=${targetChatId}`);
    const data = await response.json();

    if (data.ok) {
      return data.result;
    } else {
      console.error('Failed to get chat info:', data.description);
      return null;
    }
  } catch (error) {
    console.error('Error getting chat info:', error);
    return null;
  }
}

export async function testBotConnection(): Promise<boolean> {
  const botToken = getTelegramBotToken();

  if (!botToken) {
    console.error('Telegram bot token not configured');
    return false;
  }

  try {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/getMe`);
    const data = await response.json();

    if (data.ok) {
      console.log('Bot connection successful:', data.result.username);
      return true;
    } else {
      console.error('Bot connection failed:', data.description);
      return false;
    }
  } catch (error) {
    console.error('Error testing bot connection:', error);
    return false;
  }
}