import { NextRequest, NextResponse } from 'next/server'
import { testBotConnection, sendTelegramMessage, getChatInfo, getTelegramTrainingOrdersChatId } from '@/lib/telegram'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')
    const useDefaultChat = searchParams.get('channel') === 'default'
    const chatId = useDefaultChat ? undefined : getTelegramTrainingOrdersChatId()

    if (action === 'test_bot') {
      const botWorking = await testBotConnection()
      return NextResponse.json({ success: botWorking, message: botWorking ? 'Bot is working' : 'Bot connection failed' })
    }

    if (action === 'get_chat_info') {
      const chatInfo = await getChatInfo(chatId)
      return NextResponse.json(chatInfo || { error: 'Chat info not available' })
    }

    if (action === 'test_message') {
      if (!chatId && !useDefaultChat) {
        return NextResponse.json({ error: 'TELEGRAM_TRAINING_ORDERS_CHAT_ID is not configured' }, { status: 503 })
      }
      const success = await sendTelegramMessage('🧪 <b>SwiftDU training Telegram test</b>\nThis is a test message.', chatId)
      return NextResponse.json({ success, channel: useDefaultChat ? 'default' : 'training' })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('Test API error:', error)
    return NextResponse.json({ error: 'Test failed' }, { status: 500 })
  }
}
