'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { DEFAULTS, fetchSiteContent } from '@/lib/content';

const ContentContext = createContext(DEFAULTS);

/**
 * Site-wide managed content (homepage + global chrome), fetched once from the
 * Medusa content API. Starts with DEFAULTS so first paint + SSR match today's
 * site, then hydrates with whatever the merchant has set. Never blocks render.
 */
export default function ContentProvider({ children }) {
  const [content, setContent] = useState(DEFAULTS);

  useEffect(() => {
    let alive = true;
    fetchSiteContent().then((c) => { if (alive) setContent(c); });
    return () => { alive = false; };
  }, []);

  return <ContentContext.Provider value={content}>{children}</ContentContext.Provider>;
}

export function useSiteContent() {
  return useContext(ContentContext) || DEFAULTS;
}
