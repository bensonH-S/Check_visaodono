import { apiBasePath } from '../config/paths';
import { getToken } from '../lib/auth';
import type { GeolocationResult } from './geolocation';

const DB_NAME = 'vision-check-gps';
const STORE = 'outbox';

type GpsPendente = GeolocationResult & { criadoEm: number };

function abrirDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'criadoEm' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function enfileirarPosicaoGps(pos: GeolocationResult): Promise<void> {
  try {
    const db = await abrirDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put({ ...pos, criadoEm: Date.now() } satisfies GpsPendente);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    /* ignore */
  }
}

export async function enviarPosicaoGps(pos: GeolocationResult): Promise<boolean> {
  const token = getToken();
  if (!token) return false;
  try {
    const res = await fetch(`${apiBasePath}/frota/posicao`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        latitude: pos.latitude,
        longitude: pos.longitude,
        precisao_metros: pos.precisao_metros ?? undefined,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function flushGpsOutbox(): Promise<void> {
  try {
    const db = await abrirDb();
    const pendentes = await new Promise<GpsPendente[]>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).getAll();
      req.onsuccess = () => resolve((req.result as GpsPendente[]) || []);
      req.onerror = () => reject(req.error);
    });

    for (const item of pendentes) {
      const ok = await enviarPosicaoGps(item);
      if (!ok) break;
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).delete(item.criadoEm);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    }
    db.close();
  } catch {
    /* ignore */
  }
}
