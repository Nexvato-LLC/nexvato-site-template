import { notFound } from "next/navigation";
import { HAS_COMMERCE } from "@/lib/site-mode";

/**
 * Commerce route guard.
 *
 * On a brochure site (no shop connected) this route does not exist. Returning
 * a real 404 is deliberate: a reachable-but-broken checkout is worse than a
 * missing one, and search engines should never index a store page for a
 * business that does not sell online.
 *
 * The moment a shop is connected the route works — no code change, no deploy
 * of this repo beyond the redeploy that injects the shop id.
 */
export default function CommerceRouteLayout({ children }) {
  if (!HAS_COMMERCE) notFound();
  return children;
}
