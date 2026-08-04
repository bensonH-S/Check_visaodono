/**
 * Teste rápido do endpoint DETRAN-DF usado pelo APIBrasil/api-multas (BRController).
 * Uso: node scripts/test-detran-df.cjs PLACA RENAVAM
 */
const placa = (process.argv[2] || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
const renavam = (process.argv[3] || '').replace(/\D/g, '');
const key = process.env.DETRAN_DF_USER_KEY || '09239c5267c5b260884ec56f0b63f44c';

if (!placa || !renavam) {
  console.error('Uso: node scripts/test-detran-df.cjs PLACA RENAVAM');
  process.exit(1);
}

const url = `https://api.detran.df.gov.br/app/vinculo-veiculo/area-publica/buscaVeiculo/${placa}/${renavam}?user_key=${key}`;
console.log('GET', url.replace(key, '***'));

fetch(url, {
  headers: {
    Accept: 'application/json, text/plain, */*',
    'User-Agent': 'okhttp/4.9.2',
    Host: 'api.detran.df.gov.br',
  },
})
  .then(async (r) => {
    const text = await r.text();
    console.log('HTTP', r.status);
    try {
      const json = JSON.parse(text);
      console.log(JSON.stringify(json, null, 2).slice(0, 4000));
    } catch {
      console.log(text.slice(0, 2000));
    }
  })
  .catch((e) => {
    console.error('Erro:', e.message);
    process.exit(1);
  });
