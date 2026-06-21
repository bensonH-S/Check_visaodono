import { useEffect } from 'react';
import { APP_NAME } from '../config/brand';

export const APP_BRAND = APP_NAME;

export function usePageTitle(pageName: string) {
  useEffect(() => {
    document.title = pageName ? `${pageName} | ${APP_NAME}` : APP_NAME;
  }, [pageName]);
}
