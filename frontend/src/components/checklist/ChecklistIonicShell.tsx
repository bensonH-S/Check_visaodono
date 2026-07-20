import type { ReactNode } from 'react';
import { IonContent, IonPage } from '@ionic/react';

type Props = {
  children: ReactNode;
  /** false = página gerencia o scroll (fluxo perguntas). */
  scrollY?: boolean;
};

/** Página Ionic dentro do Root — sem novo IonApp. */
export default function ChecklistIonicShell({ children, scrollY = true }: Props) {
  return (
    <IonPage className="checklist-ionic-page">
      {scrollY ? (
        <IonContent className="checklist-ionic" fullscreen scrollY>
          {children}
        </IonContent>
      ) : (
        <div className="checklist-ionic checklist-ionic-fill">{children}</div>
      )}
    </IonPage>
  );
}
