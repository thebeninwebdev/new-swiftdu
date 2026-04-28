import { NextRequest, NextResponse } from 'next/server'
import { testBotConnection, sendTelegramMessage, getBotInfo, getChatInfo } from '@/lib/telegram'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')

    if (action === 'test_bot') {
      const botWorking = await testBotConnection()
      return NextResponse.json({ success: botWorking, message: botWorking ? 'Bot is working' : 'Bot connection failed' })
    }

    if (action === 'get_chat_info') {
      const chatInfo = await getChatInfo()
      return NextResponse.json(chatInfo || { error: 'Chat info not available' })
    }

    if (action === 'test_message') {
      const success = await sendTelegramMessage('Test message from SwiftDU')
      return NextResponse.json({ success, chatId: process.env.TELEGRAM_CHANNEL_ID })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('Test API error:', error)
    return NextResponse.json({ error: 'Test failed' }, { status: 500 })
  }
}