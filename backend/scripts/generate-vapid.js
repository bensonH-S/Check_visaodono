/**
 * Gera par de chaves VAPID para Web Push.
 * Uso: node backend/scripts/generate-vapid.js
 */
import webpush from 'web-push';

const keys = webpush.generateVAPIDKeys();

console.log('Adicione ao .env:\n');
console.log(`VAPID_PUBLIC_KEY=${keys.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${keys.privateKey}`);
console.log('VAPID_SUBJECT=mailto:seu-email@grupoalvim.com.br');
