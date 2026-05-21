import { randomBytes } from 'crypto';

import { User } from '@/models/user';
import { WhatsAppRegistration } from '@/models/whatsapp-registration';

export type LinkedWhatsAppUser = {
  id: string;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
};

export function normalizeWhatsAppPhone(value?: string | null) {
  return String(value || '').replace(/\D/g, '');
}

export function maskWhatsAppPhone(phone: string) {
  if (phone.length <= 4) return phone;
  return `${phone.slice(0, 3)}****${phone.slice(-4)}`;
}

export function isSameWhatsAppPhone(left?: string | null, right?: string | null) {
  const leftDigits = normalizeWhatsAppPhone(left);
  const rightDigits = normalizeWhatsAppPhone(right);

  if (!leftDigits || !rightDigits) {
    return false;
  }

  if (leftDigits === rightDigits) {
    return true;
  }

  return leftDigits.slice(-10) === rightDigits.slice(-10);
}

function createRegistrationToken() {
  return randomBytes(24).toString('base64url');
}

export async function getOrCreatePendingWhatsAppRegistration(phone: string, name?: string) {
  const normalizedPhone = normalizeWhatsAppPhone(phone);

  if (!normalizedPhone) {
    throw new Error('WhatsApp phone number is required.');
  }

  const existing = await WhatsAppRegistration.findOne({ phone: normalizedPhone });

  if (existing) {
    if (name && existing.name !== name) {
      existing.name = name;
      await existing.save();
    }

    return existing;
  }

  return WhatsAppRegistration.create({
    phone: normalizedPhone,
    name,
    token: createRegistrationToken(),
    status: 'pending',
  });
}

export async function findLinkedWhatsAppUser(phone: string): Promise<LinkedWhatsAppUser | null> {
  const normalizedPhone = normalizeWhatsAppPhone(phone);

  if (!normalizedPhone) {
    return null;
  }

  const registration = await WhatsAppRegistration.findOne({
    phone: normalizedPhone,
    status: 'linked',
    userId: { $exists: true, $ne: '' },
  }).lean();

  if (!registration?.userId) {
    return null;
  }

  const user = await User.findOne({
    _id: registration.userId,
    isSuspended: { $ne: true },
  })
    .select('_id name email phone')
    .lean();

  if (!user) {
    return null;
  }

  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    phone: user.phone,
  };
}
