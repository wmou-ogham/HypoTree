import { useEffect, useState } from 'react';

/** 偵測是否為行動裝置（viewport 寬度 < 768px，等同 Tailwind md 斷點） */
export function useIsMobile(): boolean {
  const [mobile, setMobile] = useState(
    () => typeof window !== 'undefined' && window.innerWidth < 768
  );
  useEffect(() => {
    const mql = window.matchMedia('(max-width: 767px)');
    const handler = (e: MediaQueryListEvent) => setMobile(e.matches);
    mql.addEventListener('change', handler);
    setMobile(mql.matches);
    return () => mql.removeEventListener('change', handler);
  }, []);
  return mobile;
}
