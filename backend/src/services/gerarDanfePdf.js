import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { gerarPDF } = require('nfe-danfe-pdf');

function prepararXmlDanfe(xml) {
  let raw = String(xml || '').replace(/^\uFEFF/, '').trim();
  if (!raw || raw.startsWith('{')) {
    throw Object.assign(new Error('XML da NF-e não está disponível para gerar a DANFE'), {
      status: 422,
    });
  }
  if (!/<NFe[\s>]|<nfeProc[\s>]/i.test(raw)) {
    throw Object.assign(new Error('Arquivo da NF não é um XML de NF-e'), { status: 422 });
  }
  if (!/<(?:\w+:)?pag[\s>]/i.test(raw)) {
    raw = raw.replace(
      /<\/(?:\w+:)?infNFe>/i,
      '<pag><detPag><indPag>0</indPag><tPag>99</tPag><vPag>0.00</vPag></detPag></pag></infNFe>',
    );
  }
  if (!/<nfeProc[\s>]/i.test(raw)) {
    const inner = raw.replace(/^<\?xml[^?]*\?>/i, '').trim();
    raw = `<?xml version="1.0" encoding="UTF-8"?><nfeProc versao="4.00">${inner}</nfeProc>`;
  }
  return raw;
}

function pdfDocParaBuffer(doc) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    const finish = () => resolve(Buffer.concat(chunks));
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', finish);
    doc.on('error', reject);
    if (doc.readableEnded) finish();
  });
}

export async function gerarDanfePdfBuffer(xml) {
  const doc = await gerarPDF(prepararXmlDanfe(xml), { textoRodape: 'Grupo Alvim' });
  const buf = await pdfDocParaBuffer(doc);
  if (!buf.length) {
    throw Object.assign(new Error('Falha ao gerar o PDF da DANFE'), { status: 500 });
  }
  return buf;
}
