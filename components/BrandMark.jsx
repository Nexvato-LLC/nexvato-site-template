'use client';

/**
 * The logo: the merchant's uploaded image when there is one, otherwise a text
 * wordmark in the site's own colours.
 *
 * WHY NOT A STATIC SVG: the placeholder logo had the words "Your Brand" baked
 * into the image in near-black. It could not show the shop's real name, and on
 * the navy footer it was unreadable (support #220). Text takes its colour from
 * the surface it sits on, so one component serves the white header and the
 * dark footer.
 *
 * `onDark` puts an uploaded logo on a light chip: a merchant's logo is
 * usually dark artwork on a transparent background and would vanish on navy.
 */
export default function BrandMark({ brand, height = 48, onDark = false, imgRef, id }) {
  const src = brand.logoUrl || brand.logoPath;
  const initial = (brand.name || '?').trim().charAt(0).toUpperCase();

  if (src) {
    const img = (
      <img
        id={id}
        ref={imgRef}
        src={src}
        alt={brand.name}
        style={{ display: 'block', height, width: 'auto', maxWidth: '100%', objectFit: 'contain', transformOrigin: 'left center' }}
      />
    );
    if (!onDark) return img;
    return <span style={{ display: 'inline-flex', maxWidth: '100%', background: 'var(--white)', borderRadius: 'var(--radius-md)', padding: '8px 12px' }}>{img}</span>;
  }

  return (
    <span
      id={id}
      ref={imgRef}
      style={{ display: 'inline-flex', alignItems: 'center', gap: Math.round(height * 0.22), minWidth: 0, maxWidth: '100%', transformOrigin: 'left center' }}
    >
      <span
        aria-hidden="true"
        style={{ flexShrink: 0, width: Math.round(height * 0.62), height: Math.round(height * 0.62), borderRadius: Math.round(height * 0.15), background: 'var(--brand-royal)', color: 'var(--white)', display: 'grid', placeItems: 'center', fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: Math.round(height * 0.34) }}
      >
        {initial}
      </span>
      <span
        style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: Math.max(16, Math.round(height * 0.4)), letterSpacing: '-0.005em', color: onDark ? 'var(--text-on-dark)' : 'var(--text-strong)' }}
      >
        {brand.name}
      </span>
    </span>
  );
}
