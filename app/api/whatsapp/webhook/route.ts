import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { getSiteUrl } from '@/lib/site';
import { splitServiceFee } from '@/lib/order-finance';
import { notifyAdminsOfOrderEvent } from '@/lib/order-alerts';
import { calculateOrderPricing } from '@/lib/pricing';
import {
  formatPushTaskType,
  sendPushNotification,
} from '@/lib/push-notifications';
import { emitOrderUpdated } from '@/lib/socket';
import {
  findLinkedWhatsAppUser,
  getOrCreatePendingWhatsAppRegistration,
  type LinkedWhatsAppUser,
} from '@/lib/whatsapp/registration';
import { sendWhatsAppText } from '@/lib/whatsapp/send-message';
import { Order } from '@/models/order';
import { WhatsAppProcessedMessage } from '@/models/whatsapp-processed-message';
import {
  IWhatsAppSession,
  WhatsAppSession,
  WhatsAppSessionStep,
} from '@/models/whatsapp-session';

export const runtime = 'nodejs';

type IncomingWhatsAppText = {
  phone: string;
  text: string;
  messageId: string;
  name?: string;
};

type AuthenticatedWhatsAppUser = LinkedWhatsAppUser;

type WhatsAppWebhookPayload = {
  entry?: Array<{
    changes?: Array<{
      value?: {
        contacts?: Array<{
          profile?: {
            name?: string;
          };
          wa_id?: string;
        }>;
        messages?: Array<{
          from?: string;
          id?: string;
          type?: string;
          text?: {
            body?: string;
          };
        }>;
      };
    }>;
  }>;
};

function normalizeInput(value: string) {
  return value.trim().toLowerCase();
}

async function findAuthenticatedWhatsAppUser(phone: string): Promise<AuthenticatedWhatsAppUser | null> {
  return findLinkedWhatsAppUser(phone);
}

async function authenticationPrompt(phone: string, name?: string) {
  const registration = await getOrCreatePendingWhatsAppRegistration(phone, name);
  const link = `${getSiteUrl()}/dashboard/whatsapp/register?token=${registration.token}`;

  return `Please register this WhatsApp number for the SwiftDU bot first.

Open this link:
${link}

You must already have a SwiftDU website account. Log in on the website, link this WhatsApp number, then reply MENU here.`;
}

function getMissingEnv(names: string[]) {
  return names.filter((name) => !process.env[name]?.trim());
}

function extractTextMessage(payload: WhatsAppWebhookPayload): IncomingWhatsAppText | null {
  for (const entry of payload.entry || []) {
    for (const change of entry.changes || []) {
      const value = change.value;
      const message = value?.messages?.find(
        (item) => item.type === 'text' && item.text?.body && item.from && item.id
      );

      if (!message?.from || !message.id || !message.text?.body) {
        continue;
      }

      return {
        phone: message.from,
        text: message.text.body,
        messageId: message.id,
        name: value?.contacts?.find((contact) => contact.wa_id === message.from)?.profile?.name,
      };
    }
  }

  return null;
}

function mainMenuMessage() {
  return `Welcome to SwiftDU 👋

Choose an option
A. Order food
B. Track order
C. Cancel order
D. Speak to support

Reply with A, B, C, or D.`;
}

function storeMenuMessage() {
  return `Select store
A. Cafeteria
B. Restaurant
C. Supermarket
D. Other

Reply with A, B, C, or D.`;
}

function descriptionPrompt() {
  return `What do you want to order

Example
Rice and chicken
Drink
Snacks`;
}

function pricePrompt() {
  return `Enter the food budget only.

Do not forget to calculate the takeaway amount for your budget.

You can only order for one person at a time using this WhatsApp bot.

Example
1500`;
}

function locationPrompt() {
  return `Where should we deliver it

Example
Hostel B, Room 12`;
}

function formatCurrency(value: number) {
  return `₦${value.toLocaleString('en-NG')}`;
}

function confirmationMessage(session: IWhatsAppSession) {
  const itemPrice = Number(session.data.price || 0);
  const pricing = calculateOrderPricing({
    amount: itemPrice,
    taskType: 'restaurant',
    restaurantPeopleCount: 1,
  });

  return `Confirm your order

Store ${session.data.store || 'Not provided'}
Items ${session.data.description || 'Not provided'}
Items price ${formatCurrency(itemPrice)}
Service fee ${formatCurrency(pricing.serviceFee)}
Total ${formatCurrency(pricing.totalAmount)}

Delivery location ${session.data.location || 'Not provided'}

Reply YES to confirm or NO to cancel.`;
}

function mapMainMenuSelection(input: string) {
  if (['a', 'order', 'order food', 'food'].includes(input)) return 'A';
  if (['b', 'track', 'track order', 'status', 'order status'].includes(input)) return 'B';
  if (['c', 'cancel order'].includes(input)) return 'C';
  if (['d', 'support', 'speak to support', 'help', 'complaint'].includes(input)) return 'D';
  return null;
}

function mapStoreSelection(input: string) {
  const stores: Record<string, string> = {
    a: 'Cafeteria',
    cafeteria: 'Cafeteria',
    b: 'Restaurant',
    restaurant: 'Restaurant',
    c: 'Supermarket',
    supermarket: 'Supermarket',
    d: 'Other',
    other: 'Other',
  };

  return stores[input] || null;
}

function isGreeting(input: string) {
  return ['hi', 'hello', 'start', 'menu'].includes(input);
}

async function setSessionMenu(session: IWhatsAppSession, messageId: string, name?: string) {
  session.name = name || session.name;
  session.step = 'MENU';
  session.data = {};
  session.lastMessageId = messageId;
  await session.save();
}

async function getOrCreateSession(message: IncomingWhatsAppText) {
  const session = await WhatsAppSession.findOneAndUpdate(
    { phone: message.phone },
    {
      $setOnInsert: {
        phone: message.phone,
        step: 'MENU' satisfies WhatsAppSessionStep,
        data: {},
      },
      $set: {
        name: message.name,
      },
    },
    { upsert: true, new: true }
  );

  return session;
}

async function notifyWhatsAppOrderCreated(
  order: Awaited<ReturnType<typeof createWhatsAppOrder>>,
  user: AuthenticatedWhatsAppUser
) {
  emitOrderUpdated(order);

  const taskerPushResult = await sendPushNotification({
    audience: { roles: ['tasker'] },
    title: 'New Task Available',
    body: `${formatPushTaskType(order.taskType)} in ${order.location} - NGN ${Number(order.totalAmount || 0).toLocaleString()}`,
    url: '/available-tasks',
    tag: `new-task-${order._id.toString()}`,
  });

  if (
    taskerPushResult.skipped ||
    taskerPushResult.deliveredCount + (taskerPushResult.expiredCount || 0) <
      taskerPushResult.recipientCount
  ) {
    console.warn('[WhatsApp Order Tasker Push Notification]:', taskerPushResult);
  }

  try {
    const adminAlertResult = await notifyAdminsOfOrderEvent({
      event: 'created',
      order,
      actorName: user.name || null,
      actorEmail: user.email || null,
      actorRole: 'customer',
    });

    if (
      adminAlertResult.skipped ||
      adminAlertResult.deliveredCount < adminAlertResult.recipientCount
    ) {
      console.warn('[WhatsApp Order Admin Notification]:', adminAlertResult);
    }
  } catch (notificationError) {
    console.error('[WhatsApp Order Admin Notification Error]:', notificationError);
  }
}

async function createWhatsAppOrder(
  session: IWhatsAppSession,
  phone: string,
  user: AuthenticatedWhatsAppUser,
  name?: string
) {
  const itemPrice = Number(session.data.price || 0);
  const pricing = calculateOrderPricing({
    amount: itemPrice,
    taskType: 'restaurant',
    restaurantPeopleCount: 1,
  });
  const settlement = splitServiceFee(pricing.serviceFee);

  const order = new Order({
    userId: user.id,
    source: 'whatsapp',
    customerPhone: phone,
    customerName: user.name || name || session.name || undefined,
    taskType: 'restaurant',
    description: session.data.description,
    amount: itemPrice,
    itemPrice,
    commission: settlement.serviceFee,
    platformFee: settlement.platformFee,
    taskerFee: settlement.taskerFee,
    serviceFee: settlement.serviceFee,
    pricingModel: pricing.pricingModel,
    totalAmount: pricing.totalAmount,
    location: session.data.location,
    deliveryLocation: session.data.location,
    store: session.data.store,
    restaurantPeopleCount: 1,
    status: 'pending',
    bookedAt: new Date(),
    paymentProvider: 'manual_transfer',
    paymentStatus: 'unpaid',
    hasPaid: false,
    taskerHasPaid: false,
    settlementStatus: 'not_due',
  });

  await order.save();
  return order;
}

async function trackLatestOrder(phone: string) {
  const order = await Order.findOne({ customerPhone: phone, source: 'whatsapp' })
    .sort({ createdAt: -1 })
    .lean();

  if (!order) {
    return 'No recent order was found for this WhatsApp number.';
  }

  return `Latest order

Items ${order.description || 'Not provided'}
Status ${String(order.status).replace('_', ' ')}
Payment ${String(order.paymentStatus || 'unpaid').replace('_', ' ')}
Total ${formatCurrency(Number(order.totalAmount || order.amount || 0))}`;
}

async function cancelLatestOrder(phone: string) {
  const order = await Order.findOneAndUpdate(
    {
      customerPhone: phone,
      source: 'whatsapp',
      status: 'pending',
      paymentStatus: 'unpaid',
    },
    {
      $set: {
        status: 'cancelled',
        paymentStatus: 'cancelled',
        cancelledAt: new Date(),
      },
    },
    { sort: { createdAt: -1 }, new: true }
  );

  if (!order) {
    return 'There is no active cancellable order for this WhatsApp number.';
  }

  return `Your latest pending order has been cancelled.

Choose an option
A. Order food
B. Track order
C. Cancel order
D. Speak to support`;
}

async function handleMessage(session: IWhatsAppSession, message: IncomingWhatsAppText) {
  const input = normalizeInput(message.text);
  const authenticatedUser = await findAuthenticatedWhatsAppUser(message.phone);

  if (isGreeting(input)) {
    await setSessionMenu(session, message.messageId, message.name);
    if (!authenticatedUser) {
      return authenticationPrompt(message.phone, message.name);
    }
    return mainMenuMessage();
  }

  if (input === 'cancel') {
    await setSessionMenu(session, message.messageId, message.name);
    if (!authenticatedUser) {
      return authenticationPrompt(message.phone, message.name);
    }
    return `Order cancelled.

${mainMenuMessage()}`;
  }

  if (!authenticatedUser) {
    await setSessionMenu(session, message.messageId, message.name);
    return authenticationPrompt(message.phone, message.name);
  }

  session.name = message.name || session.name;
  session.lastMessageId = message.messageId;

  if (session.step === 'SUPPORT') {
    await session.save();
    return 'Your message has been received. A support person will attend to you soon.';
  }

  if (session.step === 'MENU') {
    const selection = mapMainMenuSelection(input);

    if (selection === 'A') {
      session.step = 'SELECT_STORE';
      session.data = {};
      await session.save();
      return storeMenuMessage();
    }

    if (selection === 'B') {
      await session.save();
      return trackLatestOrder(message.phone);
    }

    if (selection === 'C') {
      await session.save();
      return cancelLatestOrder(message.phone);
    }

    if (selection === 'D') {
      session.step = 'SUPPORT';
      await session.save();
      return 'A support person will attend to you soon. Please type your complaint clearly.';
    }

    await session.save();
    return mainMenuMessage();
  }

  if (session.step === 'SELECT_STORE') {
    const store = mapStoreSelection(input);

    if (!store) {
      await session.save();
      return storeMenuMessage();
    }

    session.step = 'ENTER_DESCRIPTION';
    session.data = { ...session.data, store };
    await session.save();
    return descriptionPrompt();
  }

  if (session.step === 'ENTER_DESCRIPTION') {
    session.step = 'ENTER_PRICE';
    session.data = { ...session.data, description: message.text.trim() };
    await session.save();
    return pricePrompt();
  }

  if (session.step === 'ENTER_PRICE') {
    const price = Number(input.replace(/,/g, ''));

    if (!Number.isFinite(price) || price <= 0) {
      await session.save();
      return `Please enter a valid positive number for the item price.

${pricePrompt()}`;
    }

    session.step = 'ENTER_LOCATION';
    session.data = { ...session.data, price };
    await session.save();
    return locationPrompt();
  }

  if (session.step === 'ENTER_LOCATION') {
    session.step = 'CONFIRM_ORDER';
    session.data = { ...session.data, location: message.text.trim() };
    await session.save();
    return confirmationMessage(session);
  }

  if (session.step === 'CONFIRM_ORDER') {
    if (['yes', 'y'].includes(input)) {
      try {
        const order = await createWhatsAppOrder(
          session,
          message.phone,
          authenticatedUser,
          message.name
        );
        await notifyWhatsAppOrderCreated(order, authenticatedUser);
      const items = session.data.description || 'Not provided';
      const total = Number(order.totalAmount || 0);
      await setSessionMenu(session, message.messageId, message.name);

      return `Your order has been created ✅

Order summary
Items ${items}
Total ${formatCurrency(total)}

Please wait while we process your order.`;
      } catch (error) {
        console.error('[WhatsApp Order Create Error]:', error);
        await session.save();
        return `Sorry, we could not create your order right now.

Please reply YES to try again or MENU to restart.`;
      }
    }

    if (['no', 'n'].includes(input)) {
      await setSessionMenu(session, message.messageId, message.name);
      return `Order cancelled.

Choose an option
A. Order food
B. Track order
C. Cancel order
D. Speak to support`;
    }

    await session.save();
    return confirmationMessage(session);
  }

  await setSessionMenu(session, message.messageId, message.name);
  return mainMenuMessage();
}

export async function GET(request: NextRequest) {
  const mode = request.nextUrl.searchParams.get('hub.mode');
  const verifyToken = request.nextUrl.searchParams.get('hub.verify_token');
  const challenge = request.nextUrl.searchParams.get('hub.challenge');
  const expectedToken = process.env.WHATSAPP_VERIFY_TOKEN;

  if (mode === 'subscribe' && verifyToken && verifyToken === expectedToken && challenge) {
    return new NextResponse(challenge, { status: 200 });
  }

  return new NextResponse('Forbidden', { status: 403 });
}

export async function POST(request: NextRequest) {
  try {
    const missingEnv = getMissingEnv([
      'WHATSAPP_ACCESS_TOKEN',
      'WHATSAPP_PHONE_NUMBER_ID',
      'WHATSAPP_VERIFY_TOKEN',
      'WHATSAPP_APP_SECRET',
    ]);

    if (missingEnv.length > 0) {
      console.error('[WhatsApp Webhook Error]: Missing env vars:', missingEnv.join(', '));
      return NextResponse.json({ error: 'WhatsApp configuration is missing.' }, { status: 500 });
    }

    // TODO: Verify Meta X-Hub-Signature-256 with WHATSAPP_APP_SECRET before processing.
    await connectDB();

    const payload = (await request.json()) as WhatsAppWebhookPayload;
    const message = extractTextMessage(payload);

    if (!message) {
      return NextResponse.json({ ok: true });
    }

    try {
      await WhatsAppProcessedMessage.create({
        messageId: message.messageId,
        phone: message.phone,
      });
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 11000
      ) {
        return NextResponse.json({ ok: true, duplicate: true });
      }

      throw error;
    }

    const session = await getOrCreateSession(message);
    const reply = await handleMessage(session, message);

    await sendWhatsAppText(message.phone, reply);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[WhatsApp Webhook Error]:', error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
