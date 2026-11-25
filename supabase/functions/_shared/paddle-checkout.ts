import { type PaddleApi, type PaddleSubscription, type PaddleTransaction } from "./paddle.ts";

export function customerSubscriptions(api: PaddleApi, customerId: string) {
  return api.list<PaddleSubscription>(`/subscriptions?customer_id=${encodeURIComponent(customerId)}`);
}

export async function* pendingSignupTransactions(api: PaddleApi, customerId: string) {
  for await (const transaction of api.list<PaddleTransaction>(
    `/transactions?customer_id=${encodeURIComponent(customerId)}&status=draft,ready,paid&origin=api`,
  )) {
    if (!transaction.subscription_id && transaction.origin === "api" &&
        transaction.custom_data?.treuplate_checkout === true) yield transaction;
  }
}

export async function cancelPendingTransaction(api: PaddleApi, transaction: PaddleTransaction) {
  if (transaction.status === "paid") throw new Error("Paddle checkout is processing payment");
  await api.patch(`/transactions/${transaction.id}`, { status: "canceled" });
}
