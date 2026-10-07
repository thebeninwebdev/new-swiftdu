export const ACTIVE_ORDER_STATUSES = ["pending", "in_progress", "paid"] as const;

export function isActiveOrderStatus(status: string | null | undefined) {
  return ACTIVE_ORDER_STATUSES.includes(
    status as (typeof ACTIVE_ORDER_STATUSES)[number]
  );
}

export function isCustomerPaymentConfirmed(order: {
  status: string;
  hasPaid?: boolean;
  paymentStatus?: string;
  isDeclinedTask?: boolean;
}) {
  return !order.isDeclinedTask && (order.paymentStatus === "paid" || !!order.hasPaid);
}

export function canCustomerCancelOrder(order: {
  status: string;
  hasPaid?: boolean;
  paymentStatus?: string;
  isDeclinedTask?: boolean;
}) {
  return (
    !order.isDeclinedTask &&
    order.status !== "completed" &&
    order.status !== "cancelled" &&
    !isCustomerPaymentConfirmed(order)
  );
}

export function canTaskerCancelOrder(order: {
  status: string;
  hasPaid?: boolean;
  paymentStatus?: string;
  isDeclinedTask?: boolean;
}) {
  return (
    !order.isDeclinedTask &&
    order.status !== "completed" &&
    order.status !== "cancelled" &&
    !isCustomerPaymentConfirmed(order)
  );
}

export function canTaskerReportTransferIssue(order: {
  status: string;
  hasPaid?: boolean;
  paymentStatus?: string;
  isDeclinedTask?: boolean;
  paymentDisputeResolvedAt?: string | Date;
  paymentDisputeResolution?: string;
}) {
  return (
    isActiveOrderStatus(order.status) &&
    isCustomerPaymentConfirmed(order) &&
    !order.paymentDisputeResolvedAt &&
    order.paymentDisputeResolution !== "tasker_confirmed_received"
  );
}