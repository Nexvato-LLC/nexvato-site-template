import { IS_CONNECTED } from '@/lib/shop';

/**
 * Renders ONLY when this site has not been connected to a store.
 *
 * WHY IT EXISTS: the failure it catches is invisible otherwise. A site with no
 * `NEXT_PUBLIC_SHOP_ID` builds successfully, deploys successfully, returns
 * HTTP 200, and shows an empty catalog — indistinguishable from a shop that
 * simply has no products yet. That shipped once and took a day to find.
 *
 * This makes the difference obvious the moment anyone opens the page, and
 * names the missing variable so the fix is immediate.
 */
export default function SetupNotice() {
  if (IS_CONNECTED) return null;

  return (
    <div
      role="status"
      style={{
        background: '#7f1d1d',
        color: '#fee2e2',
        padding: '14px 20px',
        textAlign: 'center',
        fontSize: 14,
        lineHeight: 1.5,
      }}
    >
      <strong>This site is not connected to a store yet.</strong>{' '}
      <span style={{ opacity: 0.9 }}>
        <code style={{ fontFamily: 'ui-monospace, monospace' }}>NEXT_PUBLIC_SHOP_ID</code> is
        missing, so no products can load. Set it in the site&rsquo;s hosting settings and
        redeploy.
      </span>
    </div>
  );
}
