/**
 * Valida VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY do .env (ou ambiente).
 * Uso: node backend/scripts/validate-vapid.js
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import webpush from 'web-push';
import {
  normalizarVapidSubject,
  validarVapidPrivateKey,
  validarVapidPublicKey,
} from '../src/vapidKeys.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');
dotenv.config({ path: path.join(root, '.env') });

const pub = validarVapidPublicKey(process.env.VAPID_PUBLIC_KEY);
const priv = validarVapidPrivateKey(process.env.VAPID_PRIVATE_KEY);
const subject = normalizarVapidSubject(process.env.VAPID_SUBJECT);

console.log('VAPID — validação\n');

if (!pub.ok) {
  console.error('VAPID_PUBLIC_KEY inválida:', pub.reason);
  process.exit(1);
}
console.log('VAPID_PUBLIC_KEY: OK (65 bytes, curva P-256)');

if (!priv.ok) {
  console.error('VAPID_PRIVATE_KEY inválida:', priv.reason);
  process.exit(1);
}
console.log('VAPID_PRIVATE_KEY: OK (32 bytes)');

console.log('VAPID_SUBJECT:', subject);

try {
  webpush.setVapidDetails(subject, pub.key, priv.key);
  console.log('\nPar VAPID aceito pelo web-push.');
} catch (e) {
  console.error('\nPar VAPID rejeitado pelo web-push:', e.message);
  console.error('Gere um novo par: npm run generate:vapid');
  process.exit(1);
}
