import { useLayoutEffect, useState } from 'react';

/** Pixels from layout viewport bottom to visual viewport bottom (keyboard / browser UI). */
export function useVisualViewportKeyboardInset() {
  const [bottom, setBottom] = useState(0);
  useLayoutEffect(() => {
    const vv = window.visualViewport;
    const update = () => {
      if (!vv) {
        setBottom(0);
        return;
      }
      setBottom(Math.max(0, window.innerHeight - (vv.offsetTop + vv.height)));
    };
    update();
    vv?.addEventListener('resize', update);
    vv?.addEventListener('scroll', update);
    window.addEventListener('resize', update);
    return () => {
      vv?.removeEventListener('resize', update);
      vv?.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, []);
  return bottom;
}
