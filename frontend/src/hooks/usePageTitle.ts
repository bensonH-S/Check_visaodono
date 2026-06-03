import { useEffect } from 'react';

export const APP_BRAND = 'Vision Check';

export function usePageTitle(pageName: string) {
  useEffect(() => {
    document.title = pageName ? `${pageName} | ${APP_BRAND}` : APP_BRAND;
  }, [pageName]);
}
