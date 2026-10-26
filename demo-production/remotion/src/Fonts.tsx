import { useEffect, useState } from 'react';
import { continueRender, delayRender, staticFile } from 'remotion';

// Noto Sans from the app's own font package (copied to public/fonts), loaded before the first frame renders.
const faces: [string, string, string][] = [
  ['Noto Sans', 'fonts/noto-sans-latin-400-normal.woff2', '400'],
  ['Noto Sans', 'fonts/noto-sans-latin-600-normal.woff2', '600'],
  ['Noto Sans', 'fonts/noto-sans-latin-700-normal.woff2', '700'],
  ['Noto Sans Devanagari', 'fonts/noto-sans-devanagari-devanagari-600-normal.woff2', '600'],
];

export const useFonts = () => {
  const [handle] = useState(() => delayRender('fonts'));
  useEffect(() => {
    Promise.all(
      faces.map(([family, file, weight]) => {
        const f = new FontFace(family, `url(${staticFile(file)})`, { weight });
        return f.load().then((loaded) => document.fonts.add(loaded));
      }),
    ).then(() => continueRender(handle));
  }, [handle]);
};
