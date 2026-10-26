import { classifyDeliveryLocation, validateDeliveryRoom } from '@/lib/delivery-policy';
import { saveNewOrderWithBonus } from '@/lib/first-order-bonus';
import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { notifyAdminsOfOrderEvent } from '@/lib/order-alerts';
import { Order } from '@/models/order';
import CampusLocation from '@/models/campus-location';
import { Types } from 'mongoose';
import { User } from '@/models/user';
import { auth } from '@/lib/auth';
import { Review } from '@/models/review';
import { ACTIVE_ORDER_STATUSES } from '@/lib/order-status';
import { emitOrderUpdated } from '@/lib/socket';
import { ensureCompletionTimer } from '@/lib/completion-timer';
import {
  calculateOrderPricing,
  type PricingResult,
  CAFE_INQUIRY_EXTRA_FEE,
  descriptionMentionsWater,
  normalizeRestaurantPeopleCount,
  normalizeRestaurantTakeawayCount,
  normalizeNoteSize,
  normalizePrintingServiceType,
  PRINTING_TASK_TYPE,
  RESTAURANT_MAX_PEOPLE,
  WATER_TASK_TYPE,
  INDOMIE_TASK_TYPE,
} from '@/lib/pricing';
import { getConfiguredServiceFee } from '@/lib/pricing-config';
import { resolveVendorDeliveryPricing, VendorPricingError } from '@/lib/vendors';
import { splitServiceFee } from '@/lib/order-finance';
import {
  getCreatedInMode,
  shouldCreateTestOrder,
  shouldSendOrderNotification,
} from '@/lib/test-orders';
import {
  getUserLookupConditions,
  hasActiveServiceFeeDiscountReservation,
} from '@/lib/service-fee-discount';
import {
  formatPushTaskType,
  sendPushNotification,
} from '@/lib/push-notifications';
import { isProfileComplete } from '@/lib/profile-completion';
import { canCreateOrder, OPERATIONS_SUSPENDED } from '@/lib/operations';
import { batchingMetadata } from '@/lib/indomie-batch-release';
import { reserveIndomieCapacity } from '@/lib/indomie-capacity';
import { getNextAvailableIndomieRun, getNextTrainingIndomieRun, isRunStillBookable } from '@/lib/indomie-runs';
import { randomUUID } from 'node:crypto';
import { getIndomieBatchSettings } from '@/lib/indomie-batch-settings';
import { formatMinute, getIndomieServiceMode, getNextOpeningTime, getOperationsSettings, getOperationsStatus } from '@/lib/operations-settings';

const ALLOWED_CUSTOMER_TASK_TYPES = new Set(['restaurant', 'printing', 'shopping', 'water', INDOMIE_TASK_TYPE]);

export async function POST(request: NextRequest) {
  const idempotencyKey = request.headers.get('Idempotency-Key')?.trim() || undefined
  try {
    await connectDB();

    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // A retry must only ever see its own original order.
    if (idempotencyKey) {
      const existingOrder = await Order.findOne({ userId: session.user.id, idempotencyKey }).lean()
      if (existingOrder) {
        return NextResponse.json(existingOrder)
      }
    }

    // Customer operational details are required to place an order, not to authenticate.
    // Privileged/test-order behavior remains governed by the existing authorization below.
    if (session.user.role === 'user') {
      const profile = await User.findById(session.user.id)
        .select('name gender phone location defaultLocation')
        .lean();
      if (!profile || !isProfileComplete(profile)) {
        return NextResponse.json(
          { error: 'Complete your profile before placing an order.', code: 'PROFILE_INCOMPLETE', completeProfileURL: '/complete-profile' },
          { status: 403 }
        );
      }
    }

    const body = await request.json();

    const {
      taskType,
      description,
      amount,
      location,
      store,
      packaging,
      restaurantPeopleCount,
      restaurantTakeawayCount,
      waterBags,
      indomiePacks,
      eggCount,
      indomieMeals,
      noteSize,
      numberOfPages,
      printingServiceType,
      printingNeedsEditing,
      deadline,
      copyNotesType,
      copyNotesPages,
      deadlineDate,
      cafeInquiry,
      isTestOrder: requestedIsTestOrder,
      expectedIndomieMode,
      parentLocationId,
      deliveryLocation,
      vendorId,
    } = body;

    // New mapped orders always resolve their broad destination on the server.  The
    // parent is the pricing identity; an exact location is only a delivery target.
    let parentLocation: { _id: Types.ObjectId; name: string; type: string; coordinates: unknown; deliveryPolicy?: { requiresRoomNumber?: boolean; taskerGenderRestriction?: 'male' | 'female' | 'any' } } | null = null;
    if (parentLocationId !== undefined && parentLocationId !== null && parentLocationId !== '') {
      if (!Types.ObjectId.isValid(parentLocationId)) return NextResponse.json({ error: 'Choose a valid parent location.' }, { status: 400 });
      parentLocation = await CampusLocation.findOne({ _id: parentLocationId, parentLocationId: null, active: true }).select('name type coordinates deliveryPolicy').lean();
      if (!parentLocation) return NextResponse.json({ error: 'Choose an active parent location.' }, { status: 400 });
    }

    // Validation
    if (
      !taskType ||
      !location
    ) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const resolvedLocation = parentLocation?.name || location;
    if (typeof resolvedLocation !== 'string' || (!parentLocation && !classifyDeliveryLocation(resolvedLocation))) {
      return NextResponse.json({ error: 'Choose a recognized delivery destination and include it with your room or landmark details.' }, { status: 400 });
    }

    let roomNumber: string | undefined;
    try {
      if (parentLocation) {
        roomNumber = typeof body.roomNumber === 'string' ? body.roomNumber.trim() || undefined : undefined;
        if ((parentLocation.type === 'hostel' || parentLocation.deliveryPolicy?.requiresRoomNumber) && !roomNumber) throw new Error('Enter the exact location for this delivery.');
      } else {
        roomNumber = validateDeliveryRoom(resolvedLocation, body.roomNumber);
      }
    } catch (error) {
      return NextResponse.json({ error: (error as Error).message }, { status: 400 });
    }
    const normalizedDeliveryLocation = typeof deliveryLocation === 'string' ? deliveryLocation.trim().replace(/\s+/g, ' ') || undefined : undefined;
    if (normalizedDeliveryLocation && normalizedDeliveryLocation.length > 120) return NextResponse.json({ error: 'Exact delivery location must be at most 120 characters.' }, { status: 400 });
    if (parentLocation && (parentLocation.type === 'building' || parentLocation.type === 'lecture_theatre') && !normalizedDeliveryLocation) return NextResponse.json({ error: 'Enter the exact delivery location for this building.' }, { status: 400 });
    const normalizedDescription = String(description || '').trim();
    const normalizedTaskType = String(taskType || '').trim();
    const isCafeInquiry = normalizedTaskType === 'restaurant' && cafeInquiry === true;
    const parsedAmount = isCafeInquiry ? 0 : Number(amount);
    if (isCafeInquiry && (typeof store !== 'string' || !store.trim() || typeof location !== 'string' || !location.trim())) {
      return NextResponse.json({ error: 'Choose a cafe and delivery location.' }, { status: 400 });
    }
    const parsedRestaurantPeopleCount =
      normalizedTaskType === 'restaurant' ? Number(isCafeInquiry ? 1 : restaurantPeopleCount || 1) : undefined;
    const normalizedRestaurantPeopleCount =
      normalizedTaskType === 'restaurant'
        ? normalizeRestaurantPeopleCount(parsedRestaurantPeopleCount)
        : undefined;
    const parsedRestaurantTakeawayCount =
      normalizedTaskType === 'restaurant' ? Number(isCafeInquiry ? 0 : restaurantTakeawayCount || 0) : undefined;
    const normalizedRestaurantTakeawayCount =
      normalizedTaskType === 'restaurant'
        ? normalizeRestaurantTakeawayCount(
            parsedRestaurantTakeawayCount,
            normalizedRestaurantPeopleCount
          )
        : undefined;
    const parsedWaterBags =
      normalizedTaskType === WATER_TASK_TYPE ? Number(waterBags) : undefined;
    const suppliedMeals = normalizedTaskType === INDOMIE_TASK_TYPE && Array.isArray(indomieMeals) ? indomieMeals : undefined;
    const normalizedIndomieMeals = suppliedMeals?.map((meal) => ({
      indomiePacks: Number(meal?.indomiePacks), eggCount: Number(meal?.eggCount), amount: Number(meal?.amount),
      description: typeof meal?.description === 'string' ? meal.description.trim() || undefined : undefined,
    }));
    const parsedIndomiePacks = normalizedTaskType === INDOMIE_TASK_TYPE
      ? normalizedIndomieMeals ? normalizedIndomieMeals.reduce((total, meal) => total + meal.indomiePacks, 0) : Number(indomiePacks) : undefined;
    const parsedEggCount = normalizedTaskType === INDOMIE_TASK_TYPE
      ? normalizedIndomieMeals ? normalizedIndomieMeals.reduce((total, meal) => total + meal.eggCount, 0) : Number(eggCount) : undefined;
    const parsedIndomieAmount = normalizedTaskType === INDOMIE_TASK_TYPE && normalizedIndomieMeals
      ? normalizedIndomieMeals.reduce((total, meal) => total + meal.amount, 0) : Number(amount);
    const normalizedNoteSize = normalizeNoteSize(
      String(noteSize || copyNotesType || '').trim()
    );
    const parsedNumberOfPages =
      normalizedTaskType === 'copy_notes' || normalizedTaskType === PRINTING_TASK_TYPE
        ? Number(numberOfPages ?? copyNotesPages)
        : undefined;
    const normalizedPrintingServiceType =
      normalizedTaskType === PRINTING_TASK_TYPE
        ? normalizePrintingServiceType(String(printingServiceType || '').trim())
        : undefined;
    const normalizedPrintingNeedsEditing =
      normalizedTaskType === PRINTING_TASK_TYPE && Boolean(printingNeedsEditing);
    const parsedDeadline =
      normalizedTaskType === 'copy_notes' && (deadline || deadlineDate)
        ? new Date(String(deadline || deadlineDate).trim())
        : undefined;

    if (!ALLOWED_CUSTOMER_TASK_TYPES.has(normalizedTaskType)) {
      return NextResponse.json(
        { error: 'Select a valid task type.' },
        { status: 400 }
      );
    }

    if (
      normalizedTaskType !== 'copy_notes' &&
      normalizedTaskType !== PRINTING_TASK_TYPE &&
      normalizedTaskType !== WATER_TASK_TYPE &&
      !isCafeInquiry &&
      (amount === undefined ||
        amount === null ||
        amount === '' ||
        !Number.isFinite(parsedAmount) ||
        parsedAmount < 0)
    ) {
      return NextResponse.json({ error: 'Enter a valid task amount' }, { status: 400 });
    }

    if (normalizedTaskType === 'copy_notes') {
      if (!normalizedNoteSize) {
        return NextResponse.json({ error: 'Choose the note size.' }, { status: 400 });
      }

      if (!Number.isInteger(parsedNumberOfPages) || (parsedNumberOfPages ?? 0) < 1) {
        return NextResponse.json({ error: 'Enter the number of pages.' }, { status: 400 });
      }

      if (
        !parsedDeadline ||
        Number.isNaN(parsedDeadline.getTime()) ||
        parsedDeadline.getTime() <= Date.now()
      ) {
        return NextResponse.json(
          { error: 'Choose a future deadline for the copied notes.' },
          { status: 400 }
        );
      }
    }

    if (normalizedTaskType === PRINTING_TASK_TYPE) {
      if (!normalizedPrintingServiceType) {
        return NextResponse.json(
          { error: 'Choose printing or photocopying.' },
          { status: 400 }
        );
      }

      if (!Number.isInteger(parsedNumberOfPages) || (parsedNumberOfPages ?? 0) < 1) {
        return NextResponse.json(
          { error: 'Enter the number of pages.' },
          { status: 400 }
        );
      }
    }

    if (normalizedDescription && descriptionMentionsWater(normalizedDescription) && normalizedTaskType !== WATER_TASK_TYPE) {
      return NextResponse.json(
        {
          error:
            'Choose the bag of water task for water delivery.',
        },
        { status: 400 }
      );
    }

    if (normalizedTaskType === WATER_TASK_TYPE) {
      if (!Number.isInteger(parsedWaterBags) || (parsedWaterBags ?? 0) <= 0) {
        return NextResponse.json(
          { error: 'Enter the number of water bags for this delivery.' },
          { status: 400 }
        );
      }
    }

    if (
      normalizedTaskType === 'restaurant' &&
      (!Number.isInteger(parsedRestaurantPeopleCount) ||
        Number(parsedRestaurantPeopleCount) < 1 ||
        Number(parsedRestaurantPeopleCount) > RESTAURANT_MAX_PEOPLE)
    ) {
      return NextResponse.json(
        { error: `Restaurant food orders can only be for 1 to ${RESTAURANT_MAX_PEOPLE} people.` },
        { status: 400 }
      );
    }

    if (
      normalizedTaskType === 'restaurant' &&
      (!Number.isInteger(parsedRestaurantTakeawayCount) ||
        Number(parsedRestaurantTakeawayCount) < 0 ||
        Number(parsedRestaurantTakeawayCount) > Number(normalizedRestaurantPeopleCount || 1))
    ) {
      return NextResponse.json(
        { error: 'Choose how many restaurant orders need takeaway packs.' },
        { status: 400 }
      );
    }

    if (normalizedTaskType === 'shopping') {
      if (normalizedDescription.length < 5) {
        return NextResponse.json(
          {
            error:
              false
                ? 'Describe the clothes you want cleaned.'
                : 'Describe the items you want.',
          },
          { status: 400 }
        );
      }
    }

    if (normalizedTaskType === 'shopping' || normalizedTaskType === INDOMIE_TASK_TYPE) {
      if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
        return NextResponse.json(
          {
            error:
              false
                ? 'Enter a valid dry cleaning budget.'
                : normalizedTaskType === INDOMIE_TASK_TYPE
                  ? 'Enter a valid indomie budget.'
                  : 'Enter a valid shopping budget.',
          },
          { status: 400 }
        );
      }
    }

    if (normalizedTaskType === INDOMIE_TASK_TYPE) {
      if (normalizedIndomieMeals && (normalizedIndomieMeals.length < 1 || normalizedIndomieMeals.length > 3 || normalizedIndomieMeals.some(meal => !Number.isInteger(meal.indomiePacks) || meal.indomiePacks < 1 || !Number.isInteger(meal.eggCount) || meal.eggCount < 0 || !Number.isFinite(meal.amount) || meal.amount <= 0))) {
        return NextResponse.json({ error: 'Each Indomie meal needs packs, eggs and a valid budget.' }, { status: 400 });
      }
      if (!Number.isInteger(parsedIndomiePacks) || Number(parsedIndomiePacks) < 1) {
        return NextResponse.json(
          { error: 'Enter how many indomie packs you want.' },
          { status: 400 }
        );
      }

      if (!Number.isInteger(parsedEggCount) || Number(parsedEggCount) < 0) {
        return NextResponse.json(
          { error: 'Enter how many eggs you want.' },
          { status: 400 }
        );
      }
    }

    const vendorBacked = normalizedTaskType === 'shopping' || normalizedTaskType === 'restaurant' || normalizedTaskType === PRINTING_TASK_TYPE
    let vendorPricing: Awaited<ReturnType<typeof resolveVendorDeliveryPricing>> | null = null
    if (vendorBacked) { if (typeof vendorId !== 'string' || !parentLocation) return NextResponse.json({ error: 'Choose a vendor and delivery location.', code: 'VENDOR_NOT_FOUND' }, { status: 400 }); try { vendorPricing = await resolveVendorDeliveryPricing({ vendorId, dropoffParentLocationId: String(parentLocation._id), expectedServiceType: normalizedTaskType }) } catch (error) { const e = error as VendorPricingError; return NextResponse.json({ error: e.message, code: e.code }, { status: 400 }) } }
    const configuredServiceFee = vendorPricing ? vendorPricing.serviceFee : await getConfiguredServiceFee({ taskType: normalizedTaskType, parentLocationId: parentLocation?._id })
    const pricing: PricingResult = calculateOrderPricing({
      amount:
        normalizedTaskType === 'copy_notes' || normalizedTaskType === WATER_TASK_TYPE
          ? 0
          : normalizedTaskType === INDOMIE_TASK_TYPE ? parsedIndomieAmount : parsedAmount,
      taskType: normalizedTaskType,
      store: typeof store === 'string' ? store : undefined,
      restaurantPeopleCount: normalizedRestaurantPeopleCount,
      restaurantTakeawayCount: normalizedRestaurantTakeawayCount,
      cafeInquiry: isCafeInquiry,
      waterBags: parsedWaterBags,
      indomiePacks: parsedIndomiePacks,
      eggCount: parsedEggCount,
      noteSize: normalizedNoteSize,
      numberOfPages: parsedNumberOfPages,
      printingServiceType: normalizedPrintingServiceType,
      printingNeedsEditing: normalizedPrintingNeedsEditing,
      serviceFee: configuredServiceFee ?? undefined,
    });

    const customerLookupConditions = getUserLookupConditions(session.user);
    const customerAccount = customerLookupConditions.length
      ? await User.findOne({ $or: customerLookupConditions })
      .select(
        'isExco excoRole testOrderMode serviceFeeDiscountEnabled serviceFeeDiscountGrantedByUserId serviceFeeDiscountGrantedByName serviceFeeDiscountGrantedByPhone serviceFeeDiscountRemainingOrders'
      )
      .lean()
      : null;
    const isTestOrder = shouldCreateTestOrder(customerAccount || undefined);

    if (requestedIsTestOrder === true && !isTestOrder) {
      return NextResponse.json(
        { error: 'Only EXCO accounts in test order mode can create test orders.' },
        { status: 403 }
      );
    }
    if (!canCreateOrder(isTestOrder)) {
      return NextResponse.json(OPERATIONS_SUSPENDED, { status: 503 });
    }
    const now = new Date();
    const [operationsSettings, indomieSettings] = await Promise.all([getOperationsSettings(), getIndomieBatchSettings()]);
    const operationsStatus = getOperationsStatus(now, operationsSettings);
    if (!isTestOrder && !operationsStatus.open) {
      return NextResponse.json({ error: `SwiftDU is closed for today. We open again at ${formatMinute(operationsSettings.openMinute)}.`, code: 'OUTSIDE_OPERATING_HOURS', nextOpeningAt: operationsStatus.nextOpeningAt }, { status: 409 });
    }
    const indomieMode = isTestOrder ? 'batching' : getIndomieServiceMode({ now, operationsSettings, batchingSettings: indomieSettings });
    if (!isTestOrder && normalizedTaskType === INDOMIE_TASK_TYPE && expectedIndomieMode && expectedIndomieMode !== indomieMode) {
      return NextResponse.json({ error: indomieMode === 'batching' ? 'Evening Indomie runs have started.' : 'Indomie orders are closed for tonight.', code: 'INDOMIE_MODE_CHANGED', mode: indomieMode }, { status: 409 });
    }
    if (!isTestOrder && normalizedTaskType === INDOMIE_TASK_TYPE && indomieMode === 'closed') {
      return NextResponse.json({ error: 'Indomie orders are closed for tonight.', code: 'INDOMIE_CLOSED', nextAvailableAt: getNextOpeningTime(now, operationsSettings) }, { status: 409 });
    }

    let serviceFeeDiscountGrantedByName =
      customerAccount?.serviceFeeDiscountGrantedByName || undefined;
    let serviceFeeDiscountGrantedByPhone =
      customerAccount?.serviceFeeDiscountGrantedByPhone || undefined;

    if (
      customerAccount?.serviceFeeDiscountEnabled &&
      customerAccount?.serviceFeeDiscountGrantedByUserId &&
      !serviceFeeDiscountGrantedByPhone
    ) {
      const grantorLookupConditions = getUserLookupConditions({
        id: customerAccount.serviceFeeDiscountGrantedByUserId,
      });
      const grantor = grantorLookupConditions.length
        ? await User.findOne({ $or: grantorLookupConditions })
            .select('name phone email')
            .lean()
        : null;

      serviceFeeDiscountGrantedByName =
        serviceFeeDiscountGrantedByName ||
        grantor?.name ||
        grantor?.email ||
        undefined;
      serviceFeeDiscountGrantedByPhone =
        typeof grantor?.phone === 'string' && grantor.phone.trim()
          ? grantor.phone.trim()
          : undefined;

      if (serviceFeeDiscountGrantedByPhone) {
        await User.findOneAndUpdate(
          { $or: customerLookupConditions },
          {
            serviceFeeDiscountGrantedByName,
            serviceFeeDiscountGrantedByPhone,
          }
        );
      }
    }

    const baseSettlement =
      pricing.pricingModel === 'copy_notes' || pricing.pricingModel === 'water'
        ? {
            serviceFee: pricing.serviceFee,
            platformFee: pricing.platformFee || 0,
            taskerFee: pricing.taskerFee || 0,
          }
        : splitServiceFee(pricing.serviceFee);
    const hasDiscountReservation = await hasActiveServiceFeeDiscountReservation(session.user.id);
    const serviceFeeDiscountApplied = Boolean(
      customerAccount?.serviceFeeDiscountEnabled &&
        Number(customerAccount?.serviceFeeDiscountRemainingOrders || 0) > 0 &&
        !hasDiscountReservation &&
        pricing.serviceFee > 0
    );
    const discountCommissionAmount = serviceFeeDiscountApplied
      ? pricing.pricingModel === 'tiered'
        ? isCafeInquiry ? splitServiceFee(pricing.serviceFee - CAFE_INQUIRY_EXTRA_FEE).taskerFee : baseSettlement.taskerFee || pricing.serviceFee
        : pricing.serviceFee
      : 0;
    const settlement = baseSettlement;
    const totalAmount = serviceFeeDiscountApplied
      ? Math.max(0, pricing.totalAmount - pricing.serviceFee + (isCafeInquiry ? CAFE_INQUIRY_EXTRA_FEE : 0))
      : pricing.totalAmount;

    const bookedAt = new Date();
    const isScheduledIndomie = normalizedTaskType === INDOMIE_TASK_TYPE && indomieMode === 'batching'
    const indomieRunAt = isScheduledIndomie ? (isTestOrder ? getNextTrainingIndomieRun(bookedAt, indomieSettings) : getNextAvailableIndomieRun(bookedAt, indomieSettings)) : null
    if (isScheduledIndomie && (!indomieRunAt || (!isTestOrder && !isRunStillBookable(indomieRunAt, bookedAt, indomieSettings)))) {
      return NextResponse.json({ error: 'There is no Indomie run open for booking right now.', code: 'INDOMIE_RUN_CLOSED' }, { status: 409 })
    }
    const batching = normalizedTaskType === INDOMIE_TASK_TYPE ? { taskerSearchStartedAt: bookedAt } : await batchingMetadata(normalizedTaskType, bookedAt)

    const order = new Order({
      userId: session.user.id,
      idempotencyKey,
      source: 'website',
      taskType: normalizedTaskType,
      description: isCafeInquiry ? 'Text me what is in cafe' : normalizedDescription,
      amount: pricing.amount,
      commission: settlement.serviceFee,
      platformFee: settlement.platformFee,
      taskerFee: settlement.taskerFee,
      serviceFee: settlement.serviceFee,
      serviceFeeBeforeDiscount: serviceFeeDiscountApplied ? pricing.serviceFee : undefined,
      serviceFeeDiscountApplied,
      serviceFeeDiscountGrantedByName: serviceFeeDiscountApplied
        ? serviceFeeDiscountGrantedByName
        : undefined,
      serviceFeeDiscountGrantedByPhone: serviceFeeDiscountApplied
        ? serviceFeeDiscountGrantedByPhone
        : undefined,
      discountCommissionAmount,
      pricingModel: pricing.pricingModel,
      totalAmount,
      location: resolvedLocation,
      taskerGenderRestriction: parentLocation?.deliveryPolicy?.taskerGenderRestriction,
      roomNumber,
      deliveryLocation: normalizedDeliveryLocation || roomNumber,
      parentLocationId: parentLocation?._id,
      exactLocationId: undefined,
      vendorId: vendorPricing?.vendor.id,
      vendorName: vendorPricing?.vendor.name,
      pickupParentLocationId: vendorPricing?.pickup.parentLocationId,
      pickupExactLocationId: vendorPricing?.pickup.exactLocationId,
      dropoffParentLocationId: vendorPricing?.dropoff.parentLocationId,
      pickupParentLocationName: vendorPricing?.pickup.parentLocationName,
      dropoffParentLocationName: vendorPricing?.dropoff.parentLocationName,
      store:
        normalizedTaskType === 'copy_notes' ||
        normalizedTaskType === WATER_TASK_TYPE ||
        normalizedTaskType === INDOMIE_TASK_TYPE ||
        false
          ? undefined
          : store || undefined,
      itemPrice: normalizedTaskType === 'restaurant' || normalizedTaskType === 'shopping' || normalizedTaskType === INDOMIE_TASK_TYPE ? parsedAmount : undefined,
      packaging: isCafeInquiry ? undefined :
        normalizedTaskType === 'restaurant'
          ? pricing.restaurantTakeawayCount && pricing.restaurantTakeawayCount > 0
            ? pricing.restaurantTakeawayCount === pricing.restaurantPeopleCount
              ? 'Takeaway pack'
              : `${pricing.restaurantTakeawayCount} takeaway, ${Number(pricing.restaurantPeopleCount || 0) - pricing.restaurantTakeawayCount} cellophane`
            : 'Cellophane'
          : packaging || undefined,
      restaurantPeopleCount: pricing.restaurantPeopleCount,
      restaurantTakeawayCount: pricing.restaurantTakeawayCount,
      restaurantPackagingFee: pricing.restaurantPackagingFee || 0,
      cafeInquiry: isCafeInquiry,
      cafeInquiryStatus: isCafeInquiry ? 'waiting_for_tasker' : undefined,
      cafeInquiryFeePaid: false,
      cafeInquiryDetailsSubmitted: !isCafeInquiry,
      waterBags: pricing.waterBags || undefined,
      waterFee: pricing.waterFee,
      indomiePacks: normalizedTaskType === INDOMIE_TASK_TYPE ? pricing.indomiePacks : undefined,
      eggCount: normalizedTaskType === INDOMIE_TASK_TYPE ? pricing.eggCount : undefined,
      indomieMeals: isScheduledIndomie ? normalizedIndomieMeals : undefined,
      indomieSlotCount: isScheduledIndomie ? (normalizedIndomieMeals?.length || 1) : undefined,
      indomieRunAt: indomieRunAt || undefined,
      scheduledFor: indomieRunAt || undefined,
      indomieRunStatus: isScheduledIndomie ? 'reserved' : undefined,
      indomieReservationGroupId: isScheduledIndomie ? randomUUID() : undefined,
      noteSize: pricing.noteSize,
      numberOfPages: pricing.numberOfPages,
      printingServiceType: pricing.printingServiceType,
      printingNeedsEditing: pricing.printingNeedsEditing,
      drawingPages: 0,
      deadline: normalizedTaskType === 'copy_notes' ? parsedDeadline : undefined,
      dueDate: normalizedTaskType === 'copy_notes' ? parsedDeadline : undefined,
      copyNotesType: pricing.copyNotesType,
      copyNotesPages: pricing.copyNotesPages,
      deadlineDate: normalizedTaskType === 'copy_notes' ? parsedDeadline : undefined,
      deadlineValue: undefined,
      deadlineUnit: undefined,
      status: 'pending',
      bookedAt,
      ...batching,
      paymentProvider: 'manual_transfer',
      paymentStatus: 'unpaid',
      taskerHasPaid: false,
      settlementStatus: 'not_due',
      isTestOrder,
      createdInMode: getCreatedInMode(isTestOrder),
      testOrderCreatedBy: isTestOrder ? session.user.id : undefined,
      testOrderCreatedByRole: isTestOrder
        ? customerAccount?.excoRole || session.user.role || 'exco'
        : undefined,
    });

    try {
      if (isScheduledIndomie) {
        await reserveIndomieCapacity({
          location,
          isTestOrder,
          requiredUnits: order.indomieSlotCount,
          save: async (taskerId) => {
            order.taskerId = taskerId
            const assignedTasker = await (await import('@/models/tasker')).default.findById(taskerId).select('userId').lean()
            const assignedUser = assignedTasker?.userId ? await User.findById(assignedTasker.userId).select('name').lean() : null
            order.taskerName = assignedUser?.name || 'Your tasker'
            order.acceptedBy = assignedTasker?.userId ? String(assignedTasker.userId) : undefined
            order.acceptedAt = bookedAt
            order.status = 'in_progress'
            order.batchStatus = 'booked'
            order.batchId = `indomie:${order.indomieRunAt?.toISOString()}:${taskerId}:${order.deliveryDestinationKey || 'campus'}`
            await saveNewOrderWithBonus(order, pricing)
            return order
          },
        })
      } else {
        await saveNewOrderWithBonus(order, pricing)
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes('No compatible Live tasker capacity')) {
        return NextResponse.json({ error: error.message, code: 'INDOMIE_BATCH_FULL' }, { status: 409 })
      }
      throw error
    }

    emitOrderUpdated(order);

    // Orders held for an Indomie collection window are deliberately invisible
    // until the release materializer creates one batch notification.
    if (order.batchingStatus !== 'waiting' && !isScheduledIndomie) {
      const taskerPushResult = await sendPushNotification({
        audience: { roles: ['tasker'], taskerGenderRestriction: order.taskerGenderRestriction || null, taskerMode: order.isTestOrder ? 'training' : 'live' },
        title: order.isTestOrder ? '[Training] New Task Available' : 'New Task Available',
        body: isCafeInquiry
          ? `Cafe inquiry in ${location} - NGN ${pricing.serviceFee.toLocaleString()} service fee`
          : `${formatPushTaskType(normalizedTaskType)} in ${location} - NGN ${totalAmount.toLocaleString()}`,
        url: '/available-tasks',
        tag: `new-task-${order._id.toString()}`,
      });

      if (
        taskerPushResult.skipped ||
        taskerPushResult.deliveredCount + (taskerPushResult.expiredCount || 0) <
          taskerPushResult.recipientCount
      ) {
        console.warn('[Orders POST Tasker Push Notification]:', taskerPushResult);
      }
    }

    if (shouldSendOrderNotification(order) || order.isTestOrder) {
      try {
        const adminAlertResult = await notifyAdminsOfOrderEvent({
          event: 'created',
          order,
          actorName: session.user.name || null,
          actorEmail: session.user.email || null,
          actorRole: 'customer',
        });

        if (
          adminAlertResult.skipped ||
          adminAlertResult.deliveredCount < adminAlertResult.recipientCount
        ) {
          console.warn('[Orders POST Admin Notification]:', adminAlertResult);
        }
      } catch (notificationError) {
        console.error('[Orders POST Admin Notification Error]:', notificationError);
      }
    }

    return NextResponse.json(order, { status: 201 });
  } catch (error) {
    // The unique sparse index closes the race between two simultaneous retries.
    if (idempotencyKey && (error as { code?: number }).code === 11000) {
      const session = await auth.api.getSession({ headers: request.headers })
      if (session?.user?.id) {
        const existingOrder = await Order.findOne({ userId: session.user.id, idempotencyKey }).lean()
        if (existingOrder) return NextResponse.json(existingOrder)
      }
    }
    console.error('[Orders POST Error]:', error);
    return NextResponse.json(
      { error: 'Failed to create order' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {

    await connectDB();

    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const currentOnly = searchParams.get('current') === 'true';
    const needsReview = searchParams.get('needsReview') === 'true';
    const taskTypeUsage = searchParams.get('taskTypeUsage') === 'true';
    const limit = Number(searchParams.get('limit') || 0);
    const statusParam = searchParams.get('status');

    const query: Record<string, unknown> = {
      userId: session.user.id,
    };

    if (taskTypeUsage) {
      const rows = await Order.aggregate<{ _id: string; count: number }>([
        { $match: { userId: session.user.id } },
        { $group: { _id: '$taskType', count: { $sum: 1 } } },
      ]);
      const taskTypeCounts = rows.reduce<Record<string, number>>((counts, row) => {
        if (row._id) {
          counts[row._id] = row.count;
        }

        return counts;
      }, {});

      return NextResponse.json({ taskTypeCounts });
    }

    if (currentOnly) {
      const account = await User.findById(session.user.id).select('isExco excoRole testOrderMode').lean()
      query.isTestOrder = shouldCreateTestOrder(account || undefined) ? true : { $ne: true }
      query.status = { $in: [...ACTIVE_ORDER_STATUSES] };
      query.taskType = { $ne: INDOMIE_TASK_TYPE };
    } else if (statusParam) {
      const statuses = statusParam
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean);

      if (statuses.length === 1) {
        query.status = statuses[0];
      } else if (statuses.length > 1) {
        query.status = { $in: statuses };
      }
    }

    if (currentOnly) {
      const order = await Order.findOne(query).sort({
        createdAt: -1,
      });
      if (order && ensureCompletionTimer(order)) {
        await order.save();
        emitOrderUpdated(order);
      }
      return NextResponse.json(order);
    }

    let ordersQuery = Order.find(query).sort({
      createdAt: -1,
    });

    if (limit > 0) {
      ordersQuery = ordersQuery.limit(limit);
    }

    let orders = await ordersQuery.lean();

    if (needsReview) {
      const completedOrders = orders.filter((order) => order.status === 'completed');

      if (completedOrders.length === 0) {
        return NextResponse.json([]);
      }

      const orderIds = completedOrders.map((order) => order._id);
      const existingReviews = await Review.find({
        userId: session.user.id,
        orderId: { $in: orderIds },
      })
        .select('orderId')
        .lean();

      const reviewedOrderIds = new Set(
        existingReviews.map((review) => review.orderId.toString())
      );

      orders = completedOrders.filter(
        (order) => !reviewedOrderIds.has(order._id.toString())
      );
    }

    return NextResponse.json(orders);
  } catch (error) {
    console.error('[Orders GET Error]:', error);
    return NextResponse.json(
      { error: 'Failed to fetch orders' },
      { status: 500 }
    );
  }
}
