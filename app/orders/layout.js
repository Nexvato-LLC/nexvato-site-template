import { notFound } from "next/navigation";
import { HAS_COMMERCE } from "@/lib/site-mode";

export const metadata = {
  title: "Track your order",
  // A private lookup: nothing here for a search engine to index.
  robots: { index: false, follow: true },
};

/** Commerce route guard — see app/shop/layout.js. Order lookup only exists once a shop is connected. */
export default function OrdersLayout({ children }) {
  if (!HAS_COMMERCE) notFound();
  return children;
}
