import { useEffect, useRef, useState } from 'react';
import * as pdfjs from 'pdfjs-dist';
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;

export default function DanfePdfPreview({ url }: { url: string }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  useEffect(() => {
    let cancel = false;
    const host = hostRef.current;
    if (!host) return undefined;
    host.replaceChildren();
    setLoading(true);
    setErr('');

    (async () => {
      try {
        const pdf = await pdfjs.getDocument({ url, verbosity: 0 }).promise;
        if (cancel) {
          pdf.destroy();
          return;
        }
        const alvo = Math.max(280, host.clientWidth || window.innerWidth - 24);
        for (let i = 1; i <= pdf.numPages; i += 1) {
          const page = await pdf.getPage(i);
          if (cancel) return;
          const base = page.getViewport({ scale: 1 });
          const scale = Math.min(2.4, alvo / base.width);
          const viewport = page.getViewport({ scale });
          const canvas = document.createElement('canvas');
          canvas.width = Math.floor(viewport.width);
          canvas.height = Math.floor(viewport.height);
          canvas.className = 'ck-estoque-nfe__danfe-page';
          const ctx = canvas.getContext('2d', { alpha: false });
          if (!ctx) continue;
          await page.render({ canvasContext: ctx, viewport }).promise;
          if (cancel) return;
          host.appendChild(canvas);
        }
        setLoading(false);
      } catch (e) {
        if (!cancel) {
          setErr(e instanceof Error ? e.message : 'Não foi possível mostrar a DANFE');
          setLoading(false);
        }
      }
    })();

    return () => {
      cancel = true;
    };
  }, [url]);

  return (
    <div className="ck-estoque-nfe__danfe-preview">
      {loading ? <p className="ck-estoque-nfe__danfe-status">Abrindo a nota…</p> : null}
      {err ? <p className="ck-estoque-nfe__danfe-status">{err}</p> : null}
      <div ref={hostRef} />
    </div>
  );
}
