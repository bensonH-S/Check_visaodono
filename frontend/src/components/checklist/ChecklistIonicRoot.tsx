import '../../ionic/setup';
import type { ReactNode } from 'react';
import { IonApp } from '@ionic/react';

/** Um único IonApp para toda a rota checklist (evita bug de IonApp aninhado). */
export default function ChecklistIonicRoot({ children }: { children: ReactNode }) {
  return <IonApp className="checklist-ionic-app">{children}</IonApp>;
}
