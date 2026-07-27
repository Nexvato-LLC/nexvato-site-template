'use client';

import Eyebrow from '@/components/ds/Eyebrow';
import Button from '@/components/ds/Button';

/**
 * Contact band.
 *
 * Every field is optional and hidden when blank, so a client who only wants to
 * show a phone number gets exactly that — no empty rows, no placeholder text
 * like "email coming soon". If nothing at all is filled in, the whole section
 * disappears rather than shipping a contact block with no way to make contact.
 *
 * Copy lives in lib/content.js under `home.contact`.
 */
export default function Contact({ contact }) {
  if (!contact) return null;

  const details = [
    contact.phone && { label: 'Phone', value: contact.phone, href: `tel:${contact.phone.replace(/[^\d+]/g, '')}` },
    contact.email && { label: 'Email', value: contact.email, href: `mailto:${contact.email}` },
    contact.address && { label: 'Address', value: contact.address, href: null },
    contact.hours && { label: 'Hours', value: contact.hours, href: null },
  ].filter(Boolean);

  // Nothing to contact them by, and no action to take — show nothing.
  if (details.length === 0 && !contact.cta_label) return null;

  return (
    <section
      data-band
      id="contact"
      style={{ background: 'var(--surface-navy)', color: 'var(--text-on-dark)', padding: '84px 0' }}
    >
      <div style={{ maxWidth: 1180, margin: '0 auto', padding: '0 24px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 48, alignItems: 'flex-start' }}>
          <div style={{ flex: '1 1 320px' }}>
            <div data-rise><Eyebrow color="onDark" rule>{contact.eyebrow}</Eyebrow></div>
            <h2
              data-rise
              style={{
                margin: '14px 0 12px',
                fontSize: 'clamp(28px, 4vw, 40px)',
                lineHeight: 1.1,
                color: 'var(--text-on-dark)',
              }}
            >
              {contact.title}
            </h2>
            {contact.subtitle && (
              <p data-rise style={{ margin: 0, color: 'var(--text-on-dark-muted)', maxWidth: 460, lineHeight: 1.6 }}>
                {contact.subtitle}
              </p>
            )}
            {contact.cta_label && (
              <div data-rise style={{ marginTop: 28 }}>
                <Button
                  variant="primary"
                  size="lg"
                  arrow
                  onClick={() => {
                    if (!contact.cta_url || contact.cta_url === '#') return;
                    window.location.href = contact.cta_url;
                  }}
                >
                  {contact.cta_label}
                </Button>
              </div>
            )}
          </div>

          {details.length > 0 && (
            <div style={{ flex: '1 1 300px', display: 'grid', gap: 18 }}>
              {details.map((d) => (
                <div key={d.label} data-rise>
                  <div
                    style={{
                      fontSize: 12,
                      letterSpacing: 1.5,
                      textTransform: 'uppercase',
                      color: 'var(--text-on-dark-muted)',
                      marginBottom: 4,
                    }}
                  >
                    {d.label}
                  </div>
                  {d.href ? (
                    <a
                      href={d.href}
                      style={{ color: 'var(--text-on-dark)', fontSize: 18, textDecoration: 'none' }}
                    >
                      {d.value}
                    </a>
                  ) : (
                    <div style={{ color: 'var(--text-on-dark)', fontSize: 18 }}>{d.value}</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
