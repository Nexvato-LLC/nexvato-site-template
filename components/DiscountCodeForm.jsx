'use client';

import { useEffect, useState } from 'react';
import Input from '@/components/ds/Input';
import Button from '@/components/ds/Button';
import { useCart } from '@/components/CartProvider';
import { shopErrorMessage } from '@/lib/shop';

/**
 * Discount code field for the cart drawer and the checkout summary (support #143).
 *
 * Uses the same public contract as the managed storefront: PATCH the cart with
 * `discountCode`, then show the server's verdict. An unknown, expired or
 * below-minimum code is not an error response — the cart simply does not get
 * cheaper — so the verdict message is the ONLY way a shopper can tell a typo
 * from an expiry from a broken store. It is always shown.
 *
 * `locked`: the checkout passes true once a payment has been prepared. From
 * then on the server freezes the order's offers and refuses code changes, so
 * the field says so instead of offering an Apply that can only fail.
 */
export default function DiscountCodeForm({ locked = false }) {
  const { cart, discountCode, applyDiscount } = useCart();
  const [code, setCode] = useState(discountCode || '');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState(null); // { ok: boolean, text: string }

  // Keep the field in step with the code actually saved on the cart (a reload,
  // another tab, or the checkout replacing the cart).
  useEffect(() => { setCode(discountCode || ''); }, [discountCode]);

  const frozen = locked || !!cart?.promotionCodeFrozen || (!!cart?.status && cart.status !== 'draft');

  const submit = async (value) => {
    if (busy || frozen || !cart?.id) return;
    setBusy(true);
    setNote(null);
    try {
      const verdict = await applyDiscount(value);
      if (!verdict) setNote(value.trim() ? null : { ok: true, text: 'Discount code removed.' });
      else if (verdict.applied) setNote({ ok: true, text: `${verdict.code} applied.` });
      else setNote({ ok: false, text: verdict.message || `${verdict.code} can’t be used on this order.` });
    } catch (err) {
      setNote({ ok: false, text: shopErrorMessage(err) });
    } finally {
      setBusy(false);
    }
  };

  const onSubmit = (e) => { e.preventDefault(); submit(code); };
  const onRemove = () => { setCode(''); submit(''); };

  return (
    <form onSubmit={onSubmit} aria-label="Discount code" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'stretch' }}>
        <Input
          size="sm"
          aria-label="Discount code"
          placeholder="Discount code"
          autoComplete="off"
          value={code}
          disabled={busy || frozen}
          onChange={(e) => setCode(e.target.value)}
          style={{ flex: '1 1 auto' }}
        />
        <Button type="submit" variant="navy" size="sm" disabled={busy || frozen || !code.trim()}>
          {busy ? 'Checking…' : 'Apply'}
        </Button>
      </div>
      {discountCode && !frozen && (
        <button type="button" onClick={onRemove} disabled={busy} style={{ alignSelf: 'flex-start', background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--link)', fontSize: 12.5, textDecoration: 'underline' }}>
          Remove code {discountCode}
        </button>
      )}
      {frozen && (
        <p style={{ margin: 0, fontSize: 12.5, color: 'var(--text-muted)' }}>
          {discountCode ? `Code ${discountCode} is saved on this order. ` : ''}Discount codes can&rsquo;t be changed once payment is ready.
        </p>
      )}
      {note && (
        <p role={note.ok ? 'status' : 'alert'} style={{ margin: 0, fontSize: 13, color: note.ok ? 'var(--success)' : 'var(--danger)' }}>
          {note.text}
        </p>
      )}
    </form>
  );
}
