import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { createOrderTrackingToken, getOrderTrackingUrl } from '@/lib/order-tracking';
import { getSiteUrl } from '@/lib/site';
import { splitServiceFee } from '@/lib/order-finance';
import { notifyAdminsOfOrderEvent } from '@/lib/order-alerts';
import { ACTIVE_ORDER_STATUSES, canCustomerCancelOrder } from '@/lib/order-status';
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
import {
  markWhatsAppMessageRead,
  sendWhatsAppListMessage,
  sendWhatsAppReplyButtons,
  sendWhatsAppText,
  type WhatsAppListSection,
  type WhatsAppReplyButton,
} from '@/lib/whatsapp/send-message';
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

type WhatsAppOutgoingReply =
  | {
      type: 'text';
      text: string;
    }
  | {
      type: 'list';
      body: string;
      buttonText: string;
      sections: WhatsAppListSection[];
    }
  | {
      type: 'buttons';
      body: string;
      buttons: WhatsAppReplyButton[];
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
          type?: 'text' | 'interactive' | string;
          text?: {
            body?: string;
          };
          interactive?: {
            type?: 'list_reply' | 'button_reply' | string;
            list_reply?: {
              id?: string;
              title?: string;
              description?: string;
            };
            button_reply?: {
              id?: string;
              title?: string;
            };
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

  return `Hi! I am Sammy, welcome to SwiftDU SmartOrder. You can make orders via whatasApp!



Open the link:
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
        (item) =>
          item.from &&
          item.id &&
          ((item.type === 'text' && item.text?.body) ||
            (item.type === 'interactive' &&
              (item.interactive?.list_reply?.id || item.interactive?.button_reply?.id)))
      );

      if (!message?.from || !message.id) {
        continue;
      }

      const text =
        message.type === 'interactive'
          ? message.interactive?.list_reply?.id || message.interactive?.button_reply?.id
          : message.text?.body;

      if (!text) {
        continue;
      }

      return {
        phone: message.from,
        text,
        messageId: message.id,
        name: value?.contacts?.find((contact) => contact.wa_id === message.from)?.profile?.name,
      };
    }
  }

  return null;
}

function textReply(text: string): WhatsAppOutgoingReply {
  return { type: 'text', text };
}

function welcomeMenuBody(name?: string) {
  return `Hello${name ? ` ${name}` : ''}
How may I assist you today?`;
}

function mainMenuReply(body = welcomeMenuBody()): WhatsAppOutgoingReply {
  return {
    type: 'list',
    body,
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
  };
}

function storeMenuReply(): WhatsAppOutgoingReply {
  return {
    type: 'list',
    body: 'Select store:',
    buttonText: 'Choose store',
    sections: [
      {
        rows: [
          { id: 'AKPAN', title: 'AKPAN' },
          { id: 'BLESS_D_FOODS', title: 'BLESS D FOODS' },
          { id: 'INDOMIE_SPOT', title: 'INDOMIE SPOT' },
          { id: 'MAMA', title: 'MAMA' },
        ],
      },
    ],
  };
}

function descriptionPrompt() {
  return `What do you want to order

Example
Jollof Rice - 500
2 Meat - 600
Sprite - 500`;
}

function orderPromptReply(): WhatsAppOutgoingReply {
  return {
    type: 'buttons',
    body: descriptionPrompt(),
    buttons: [{ id: 'ORDER_DETAILS', title: 'Order' }],
  };
}

function peopleCountPromptReply(): WhatsAppOutgoingReply {
  return {
    type: 'buttons',
    body: 'How many people are you ordering for?',
    buttons: [
      { id: 'PEOPLE_1', title: '1 person' },
      { id: 'PEOPLE_2', title: '2 persons' },
      { id: 'PEOPLE_3', title: '3 persons' },
    ],
  };
}

function pricePrompt() {
  return `Enter the food budget only.

Do not forget to calculate the takeaway amount for your budget.

Example
1500`;
}

function budgetPromptReply(): WhatsAppOutgoingReply {
  return {
    type: 'buttons',
    body: pricePrompt(),
    buttons: [{ id: 'ENTER_BUDGET', title: 'Enter budget' }],
  };
}

function locationPromptReply(): WhatsAppOutgoingReply {
  return {
    type: 'buttons',
    body: 'Where should we deliver it?',
    buttons: [
      { id: 'GIRLS_HOSTEL', title: 'Girls Hostel' },
      { id: 'AMNESTY', title: 'Amnesty' },
      { id: 'STAFF_QUARTERS', title: 'Staff Quarters' },
    ],
  };
}

function formatCurrency(value: number) {
  return `₦${value.toLocaleString('en-NG')}`;
}

function confirmationBody(session: IWhatsAppSession) {
  const itemPrice = Number(session.data.price || 0);
  const restaurantPeopleCount = Number(session.data.restaurantPeopleCount || 1);
  const pricing = calculateOrderPricing({
    amount: itemPrice,
    taskType: 'restaurant',
    restaurantPeopleCount,
  });

  return `Confirm your order

Store ${session.data.store || 'Not provided'}
People ${restaurantPeopleCount}
Items ${session.data.description || 'Not provided'}
Items price ${formatCurrency(itemPrice)}
Service fee ${formatCurrency(pricing.serviceFee)}
Total ${formatCurrency(pricing.totalAmount)}

Delivery location ${session.data.location || 'Not provided'}

Reply YES to confirm or NO to cancel.`;
}

function confirmationReply(session: IWhatsAppSession): WhatsAppOutgoingReply {
  return {
    type: 'buttons',
    body: confirmationBody(session),
    buttons: [
      { id: 'YES', title: 'Confirm order' },
      { id: 'NO', title: 'Cancel order' },
    ],
  };
}

function mapMainMenuSelection(input: string) {
  if (['a', 'order', 'order food', 'food', 'order_food'].includes(input)) return 'A';
  if (['b', 'track', 'track order', 'track my order', 'status', 'order status', 'track_order'].includes(input)) return 'B';
  if (['c', 'cancel', 'cancel order', 'cancel my order', 'cancel_order'].includes(input)) return 'C';
  if (['d', 'support', 'customer support', 'speak to support', 'help', 'complaint'].includes(input)) return 'D';
  if (
    [
      'e',
      'website',
      'website link',
      'get website link',
      'site',
      'swiftdu website',
      'get_website_link',
    ].includes(input)
  ) {
    return 'E';
  }
  return null;
}

function mapStoreSelection(input: string) {
  const stores: Record<string, string> = {
    a: 'AKPAN',
    akpan: 'AKPAN',
    b: 'BLESS D FOODS',
    bless_d_foods: 'BLESS D FOODS',
    'bless d foods': 'BLESS D FOODS',
    'bless d food': 'BLESS D FOODS',
    c: 'INDOMIE SPOT',
    indomie_spot: 'INDOMIE SPOT',
    'indomie spot': 'INDOMIE SPOT',
    d: 'MAMA',
    mama: 'MAMA',
  };

  return stores[input] || null;
}

function mapPeopleCountSelection(input: string) {
  const counts: Record<string, number> = {
    '1': 1,
    one: 1,
    '1 person': 1,
    people_1: 1,
    '2': 2,
    two: 2,
    '2 persons': 2,
    people_2: 2,
    '3': 3,
    three: 3,
    '3 persons': 3,
    people_3: 3,
  };

  return counts[input] || null;
}

function mapLocationSelection(input: string) {
  const locations: Record<string, string> = {
    girls_hostel: 'Girls Hostel',
    'girls hostel': 'Girls Hostel',
    girls: 'Girls Hostel',
    hostel: 'Girls Hostel',
    amnesty: 'Amnesty',
    staff_quarters: 'Staff Quarters',
    'staff quarters': 'Staff Quarters',
    staff: 'Staff Quarters',
  };

  return locations[input] || null;
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
  const restaurantPeopleCount = Number(session.data.restaurantPeopleCount || 1);
  const pricing = calculateOrderPricing({
    amount: itemPrice,
    taskType: 'restaurant',
    restaurantPeopleCount,
  });
  const settlement = splitServiceFee(pricing.serviceFee);

  const order = new Order({
    userId: user.id,
    trackingToken: createOrderTrackingToken(),
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
    restaurantPeopleCount,
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

async function findCurrentWhatsAppOrder(phone: string) {
  return Order.findOne({
    customerPhone: phone,
    source: 'whatsapp',
    status: { $in: ACTIVE_ORDER_STATUSES },
  })
    .sort({ createdAt: -1 });
}

function supportMessage() {
  return `SwiftDU support is available on WhatsApp:
https://wa.me/2349014116505

Tap the link above to speak with customer support.`;
}

function websiteLinkMessage() {
  return `Open SwiftDU here:
${getSiteUrl()}`;
}

async function trackCurrentOrder(phone: string) {
  const order = await findCurrentWhatsAppOrder(phone);

  if (!order) {
    return mainMenuReply('You do not have any order in progress right now.\n\nChoose an option:');
  }

  if (!order.trackingToken) {
    order.trackingToken = createOrderTrackingToken();
    await order.save();
  }

  const trackingUrl = getOrderTrackingUrl(order.trackingToken);

  return textReply(`Here is your current order link again:

Items ${order.description || 'Not provided'}
Status ${String(order.status).replace('_', ' ')}
Payment ${String(order.paymentStatus || 'unpaid').replace('_', ' ')}
Total ${formatCurrency(Number(order.totalAmount || order.amount || 0))}
${trackingUrl ? `\nTrack and pay here:\n${trackingUrl}` : ''}`);
}

async function cancelCurrentOrder(phone: string) {
  const order = await findCurrentWhatsAppOrder(phone);

  if (!order) {
    return mainMenuReply(
      'Cancellation cannot be made because you do not have any order in progress.\n\nChoose an option:'
    );
  }

  if (!canCustomerCancelOrder(order)) {
    return textReply(`Cancellation cannot be made for this order.

Your order is already in progress and payment has been made.

Track it here:
${order.trackingToken ? getOrderTrackingUrl(order.trackingToken) : 'Tracking link is not available right now.'}`);
  }

  order.status = 'cancelled';
  order.cancelledAt = new Date();
  if (!order.hasPaid) {
    order.paymentStatus = 'cancelled';
  }
  order.settlementStatus = 'not_due';
  order.settlementReference = undefined;
  order.settlementAccessCode = undefined;
  order.settlementCheckoutUrl = undefined;
  order.settlementTransactionId = undefined;
  order.settlementInitializedAt = undefined;
  order.settlementPaidAt = undefined;
  order.settlementDueAt = undefined;
  order.settlementFailureReason = undefined;

  await order.save();
  emitOrderUpdated(order);

  return mainMenuReply(
    'Your cancellation request has been received and the order has been cancelled.\n\nChoose an option:'
  );
}

async function handleMessage(
  session: IWhatsAppSession,
  message: IncomingWhatsAppText
): Promise<WhatsAppOutgoingReply> {
  const input = normalizeInput(message.text);
  const authenticatedUser = await findAuthenticatedWhatsAppUser(message.phone);

  if (isGreeting(input)) {
    await setSessionMenu(session, message.messageId, message.name);
    if (!authenticatedUser) {
      return textReply(await authenticationPrompt(message.phone, message.name));
    }
    return mainMenuReply(welcomeMenuBody(message.name || authenticatedUser.name || session.name));
  }

  if (input === 'cancel') {
    await setSessionMenu(session, message.messageId, message.name);
    if (!authenticatedUser) {
      return textReply(await authenticationPrompt(message.phone, message.name));
    }
    return mainMenuReply('Order cancelled.\n\nChoose an option:');
  }

  if (!authenticatedUser) {
    await setSessionMenu(session, message.messageId, message.name);
    return textReply(await authenticationPrompt(message.phone, message.name));
  }

  session.name = message.name || session.name;
  session.lastMessageId = message.messageId;

  if (session.step === 'SUPPORT') {
    session.step = 'MENU';
    await session.save();
    return textReply(supportMessage());
  }

  if (session.step === 'MENU') {
    const selection = mapMainMenuSelection(input);

    if (selection === 'A') {
      session.step = 'SELECT_STORE';
      session.data = {};
      await session.save();
      return storeMenuReply();
    }

    if (selection === 'B') {
      await session.save();
      return trackCurrentOrder(message.phone);
    }

    if (selection === 'C') {
      await session.save();
      return cancelCurrentOrder(message.phone);
    }

    if (selection === 'D') {
      session.step = 'MENU';
      await session.save();
      return textReply(supportMessage());
    }

    if (selection === 'E') {
      session.step = 'MENU';
      await session.save();
      return textReply(websiteLinkMessage());
    }

    await session.save();
    return mainMenuReply();
  }

  if (session.step === 'SELECT_STORE') {
    const store = mapStoreSelection(input);

    if (!store) {
      await session.save();
      return storeMenuReply();
    }

    session.step = 'ENTER_RESTAURANT_PEOPLE';
    session.data = { ...session.data, store };
    await session.save();
    return peopleCountPromptReply();
  }

  if (session.step === 'ENTER_RESTAURANT_PEOPLE') {
    const restaurantPeopleCount = mapPeopleCountSelection(input);

    if (!restaurantPeopleCount) {
      await session.save();
      return peopleCountPromptReply();
    }

    session.step = 'ENTER_DESCRIPTION';
    session.data = { ...session.data, restaurantPeopleCount };
    await session.save();
    return orderPromptReply();
  }

  if (session.step === 'ENTER_DESCRIPTION') {
    if (['order', 'order_details'].includes(input)) {
      await session.save();
      return textReply(descriptionPrompt());
    }

    session.step = 'ENTER_PRICE';
    session.data = { ...session.data, description: message.text.trim() };
    await session.save();
    return budgetPromptReply();
  }

  if (session.step === 'ENTER_PRICE') {
    if (['enter_budget', 'budget'].includes(input)) {
      await session.save();
      return textReply(pricePrompt());
    }

    const price = Number(input.replace(/,/g, ''));

    if (!Number.isFinite(price) || price <= 0) {
      await session.save();
      return textReply(`Please enter a valid positive number for the item price.

${pricePrompt()}`);
    }

    session.step = 'ENTER_LOCATION';
    session.data = { ...session.data, price };
    await session.save();
    return locationPromptReply();
  }

  if (session.step === 'ENTER_LOCATION') {
    const location = mapLocationSelection(input);

    if (!location) {
      await session.save();
      return locationPromptReply();
    }

    session.step = 'CONFIRM_ORDER';
    session.data = { ...session.data, location };
    await session.save();
    return confirmationReply(session);
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
        const trackingUrl = getOrderTrackingUrl(order.trackingToken);
        await setSessionMenu(session, message.messageId, message.name);

        return textReply(`Your order has been created

Order summary
Items ${items}
Total ${formatCurrency(total)}

Track your order and make payment here:
${trackingUrl}

Please wait while we process your order.`);
      } catch (error) {
        console.error('[WhatsApp Order Create Error]:', error);
        await session.save();
        return textReply(`Sorry, we could not create your order right now.

Please reply YES to try again or MENU to restart.`);
      }
    }

    if (['no', 'n'].includes(input)) {
      await setSessionMenu(session, message.messageId, message.name);
      return mainMenuReply('Order cancelled.\n\nChoose an option:');
    }

    await session.save();
    return confirmationReply(session);
  }

  await setSessionMenu(session, message.messageId, message.name);
  return mainMenuReply();
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

async function sendWhatsAppReply(to: string, reply: WhatsAppOutgoingReply) {
  if (reply.type === 'text') {
    await sendWhatsAppText(to, reply.text);
    return;
  }

  if (reply.type === 'list') {
    await sendWhatsAppListMessage({
      to,
      body: reply.body,
      buttonText: reply.buttonText,
      sections: reply.sections,
    });
    return;
  }

  await sendWhatsAppReplyButtons({
    to,
    body: reply.body,
    buttons: reply.buttons,
  });
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

    await markWhatsAppMessageRead(message.messageId);

    const alreadyProcessed = await WhatsAppProcessedMessage.exists({
      messageId: message.messageId,
    });

    if (alreadyProcessed) {
      return NextResponse.json({ ok: true, duplicate: true });
    }

    const session = await getOrCreateSession(message);
    const reply = await handleMessage(session, message);

    await sendWhatsAppReply(message.phone, reply);

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

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[WhatsApp Webhook Error]:', error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
