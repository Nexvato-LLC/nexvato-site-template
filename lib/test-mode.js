/**
 * Test mode at checkout (support #240).
 *
 * A store whose payments are in Stripe TEST mode takes test cards only: no
 * real money moves, and a real card is declined. The checkout has to say so,
 * or a shopper may think they are paying and the owner does not know to use a
 * test card.
 *
 * The API decides this (`testMode` on `GET /public/shop/:shopId`, true only
 * while the store is accepting payments on its test keys). An older API that
 * does not send the field is read from the publishable key instead: a
 * `pk_test_` key can only ever take test payments.
 *
 * No imports, so `node --test` can load it without the app's path aliases.
 */

export const TEST_MODE_NOTICE = 'Test mode — no real charges. Use card 4242 4242 4242 4242, any future date, any CVC.';

/** Whether this shop's checkout takes Stripe test payments. */
export function isTestMode(shop) {
  if (!shop || typeof shop !== 'object') return false;
  if (typeof shop.testMode === 'boolean') return shop.testMode;
  if (shop.acceptingPayments === false) return false;
  return typeof shop.publishableKey === 'string' && shop.publishableKey.startsWith('pk_test_');
}
