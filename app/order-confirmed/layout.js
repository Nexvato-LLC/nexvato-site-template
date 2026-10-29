import { notFound } from "next/navigation";
import { HAS_COMMERCE } from "@/lib/site-mode";

export const metadata = {
  title: "Order confirmed",
  // One shopper's receipt: nothing here for a search engine to index.
  robots: { index: false, follow: false },
};

/**
 * Commerce route guard — see app/checkout/layout.js.
 *
 * This is the store's thank-you page: checkout sends every completed order
 * here, so its URL is the one to give Google Ads or Meta as the purchase
 * conversion ("URL contains /order-confirmed"). Keep the path stable.
 */
export default function OrderConfirmedLayout({ children }) {
  if (!HAS_COMMERCE) notFound();
  return children;
}
