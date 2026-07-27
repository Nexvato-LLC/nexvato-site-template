'use client';

import SectionHeading from '@/components/ds/SectionHeading';

/**
 * "What we do" — the section a brochure site lives or dies on.
 *
 * Content-driven, NOT commerce-driven: a store with services still shows this,
 * and a site with nothing to say here hides it rather than rendering an empty
 * band. Copy lives in lib/content.js under `home.services`.
 */
export default function Services({ services }) {
  const items = services?.items ?? [];
  if (items.length === 0) return null;

  return (
    <section data-band id="services" style={{ background: 'var(--surface-default)', padding: '84px 0' }}>
      <div style={{ maxWidth: 1180, margin: '0 auto', padding: '0 24px' }}>
        <div data-rise>
          <SectionHeading
            eyebrow={services.eyebrow}
            title={services.title}
            subtitle={services.subtitle}
          />
        </div>

        <div
          style={{
            marginTop: 40,
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: 24,
          }}
        >
          {items.map((item, i) => (
            <article
              key={item.title || i}
              data-rise
              style={{
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                padding: 28,
                background: 'var(--surface-default)',
              }}
            >
              {/* Numbered rather than iconned: icons need art direction per
                  client, numerals never look wrong. */}
              <div
                aria-hidden="true"
                style={{
                  fontFamily: 'Oswald, sans-serif',
                  fontSize: 13,
                  fontWeight: 700,
                  letterSpacing: 2,
                  color: 'var(--brand-royal)',
                  marginBottom: 14,
                }}
              >
                {String(i + 1).padStart(2, '0')}
              </div>
              <h3 style={{ margin: '0 0 10px', fontSize: 19, color: 'var(--text-strong)' }}>
                {item.title}
              </h3>
              <p style={{ margin: 0, color: 'var(--text-body)', lineHeight: 1.6, fontSize: 15 }}>
                {item.body}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
