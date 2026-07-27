'use client';

import Link from 'next/link';
import { useSiteContent } from '@/components/ContentProvider';
import { BRAND } from "@/lib/brand";
import { HAS_COMMERCE, isCommerceUrl } from '@/lib/site-mode';

const colLinkStyle = { fontSize: 14, color: 'var(--text-on-dark-muted)', textDecoration: 'none' };
const headingStyle = { fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 13, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--gold-400)' };

function FootLink({ url, style, children }) {
  if (url && url.startsWith('/')) return <Link href={url} className="foot-link" style={style}>{children}</Link>;
  return <a href={url || '#'} className="foot-link" style={style}>{children}</a>;
}

export default function Footer() {
  const { home } = useSiteContent();
  const f = home.footer || {};
  // Drop links to routes that do not exist on a brochure site, then drop any
  // column left empty. Done by URL rather than by column name so an editor
  // cannot accidentally reintroduce a dead link by renaming a heading — the
  // commerce routes 404 without a shop, and a footer full of 404s is a bad
  // look and bad for SEO.
  const columns = (f.columns || [])
    .map((col) => ({
      ...col,
      links: (col.links || []).filter((l) => HAS_COMMERCE || !isCommerceUrl(l.url)),
    }))
    .filter((col) => col.links.length > 0);
  const legal = f.legal || [];

  return (
    <footer style={{ background: 'var(--navy-800)', color: 'var(--white)' }}>
      <div style={{ maxWidth: 'var(--container)', margin: '0 auto', padding: '56px 24px 28px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))', gap: 40, paddingBottom: 40, borderBottom: '1px solid rgba(255,255,255,0.14)' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 300 }}>
            <img src="/assets/logo-transparent.svg" alt={BRAND.name} style={{ height: 84, width: 'auto', alignSelf: 'flex-start' }} />
            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: 'var(--text-on-dark-muted)' }}>{f.blurb}</p>
          </div>
          {columns.map((col) => (
            <div key={col.title} style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'flex-start' }}>
              <span style={headingStyle}>{col.title}</span>
              {(col.links || []).map((l) => (
                <FootLink key={l.label} url={l.url} style={colLinkStyle}>{l.label}</FootLink>
              ))}
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap', paddingTop: 22, fontSize: 13, color: 'var(--text-on-dark-muted)' }}>
          <span>© {new Date().getFullYear()} {BRAND.name} · {BRAND.footerSuffix}</span>
          <span style={{ display: 'flex', gap: 20 }}>
            {legal.map((l) => (
              <FootLink key={l.label} url={l.url} style={{ color: 'inherit', textDecoration: 'none' }}>{l.label}</FootLink>
            ))}
          </span>
        </div>
      </div>
    </footer>
  );
}
