export const ACTIVE_ORDER_STATUSES = ["pending", "in_progress", "paid"] as const;

export function isActiveOrderStatus(status: string | null | undefined) {
  return ACTIVE_ORDER_STATUSES.includes(
    status as (typeof ACTIVE_ORDER_STATUSES)[number]
  );
}

export function canCustomerCancelOrder(order: {
  status: string;
  hasPaid?: boolean;
}) {
  return (order.status === "pending" || order.status === "in_progress") && !order.hasPaid;
}
