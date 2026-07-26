'use client';

import { useEffect, useState } from 'react';
import {
  Shader,
  SolidColor,
  Stripes,
  Tritone,
  Perspective,
  TiltShift,
} from 'shaders/react';

/**
 * Animated hero backdrop (WebGPU, via `shaders`).
 *
 * A slow diagonal gradient sweep in the site's own palette — deliberately
 * abstract so it suits any vertical. To rebrand it, change the three Tritone
 * colours; everything else is composition.
 *
 * ⚠️ PROGRESSIVE ENHANCEMENT, NOT A DEPENDENCY. WebGPU is browser-only and not
 * universally available, and some visitors ask for reduced motion. This
 * renders NOTHING in those cases and the static dark hero behind it (see
 * app/page.js) shows through instead. The hero must always look finished
 * without this component — never move essential content into it.
 */
export default function HeroBackdrop() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const hasGPU = typeof navigator !== 'undefined' && !!navigator.gpu;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    setReady(hasGPU && !reduced);
  }, []);

  if (!ready) return null;

  return (
    <Shader
      aria-hidden="true"
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        zIndex: 1,
        pointerEvents: 'none',
      }}
    >
      <SolidColor color="#0f172a" />
      <Stripes angle={148} density={0.55} softness={0.95} />
      {/* Palette: deep slate -> indigo -> warm accent. Mirrors the design
          tokens in styles/ds/tokens/colors.css. */}
      <Tritone colorA="#0f172a" colorB="#4f46e5" colorC="#b45309" colorSpace="oklab" />
      <Perspective fov={78} offset={{ x: 0.35, y: 0.4 }} pan={12} tilt={22} zoom={1.5} />
      <TiltShift angle={110} center={{ x: 0.6, y: 0.5 }} falloff={0.45} width={0.42} />
    </Shader>
  );
}
