const { Client } = require('pg');

const client = new Client({
  host: '15.204.244.132',
  user: 'alvim',
  password: '1=scvBM=2tR1&N',
  database: 'hr_payroll',
  port: 5432,
  connectionTimeoutMillis: 5000
});

client.connect()
  .then(() => {
    console.log('SUCESSO NA CONEXAO');
    return client.query('SELECT count(*) FROM employees');
  })
  .then(res => {
    console.log('Total employees:', res.rows[0].count);
    client.end();
  })
  .catch(e => {
    console.log('ERRO:', e.message);
    client.end();
  });
