import { notFound } from "next/navigation";
import { HAS_COMMERCE } from "@/lib/site-mode";

export const metadata = {
  title: "Wishlist",
  // A personal list: nothing here for a search engine to index.
  robots: { index: false, follow: true },
};

/** Commerce route guard — see app/shop/layout.js. The wishlist only exists once a shop is connected. */
export default function WishlistLayout({ children }) {
  if (!HAS_COMMERCE) notFound();
  return children;
}
