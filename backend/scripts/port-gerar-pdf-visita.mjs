import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const src = path.join(__dirname, '../../frontend/src/utils/gerarPdfVisita.ts');
const dest = path.join(__dirname, '../src/services/gerarPdfVisita.js');

let s = fs.readFileSync(src, 'utf8');

const header = `import fs from 'fs';
import path from 'path';
import { jsPDF } from 'jspdf';
import sizeOf from 'image-size';
import { countMidiaResposta, decryptMidiaResposta } from '../fotos.js';
import { getProjectRoot } from '../projectPaths.js';
import { fmtData, fmtNota, formatarHoraVisita, formatarLocalVisita } from '../utils/visitaFormat.js';
`;

s = s.replace(/^import[\s\S]*?from '\.\/visitaFormat';\n\n/, '');
s = s.replace(/ as const/g, '');
s = s.replace(/^type[\s\S]*?^type ImagemPdf[\s\S]*?;\n\n/m, '');
s = s.replace(/: jsPDF/g, '');
s = s.replace(/: VisitaDetalhe\[[^\]]+\]/g, '');
s = s.replace(/: VisitaDetalhe/g, '');
s = s.replace(/: number/g, '');
s = s.replace(/: string/g, '');
s = s.replace(/: Rgb/g, '');
s = s.replace(/: void/g, '');
s = s.replace(/: Promise<[^>]+>/g, '');
s = s.replace(/: LogoIcon \| null/g, '');
s = s.replace(/: ImagemPdf\[\]/g, '');
s = s.replace(/: ImagemPdf \| null/g, '');
s = s.replace(/Array<\{ label: string; value: string; hint\?: string; destaque\?: boolean \}>/g, '');
s = s.replace(/Map<string, VisitaDetalhe\['respostas'\]>/g, 'Map');
s = s.replace(/\(v as \{ observacoes_gerais\?: string \}\)/g, '(v)');
s = s.replace(/Promise<string>/g, 'Promise');
s = s.replace(/reader\.result as string/g, 'reader.result');
s = s.replace(/porCategoria\.get\(cat\)!/g, 'porCategoria.get(cat)');
s = s.replace(/\): number \{/g, ') {');
s = s.replace(/function estiloResposta\(resposta \| null \| undefined\): \{ cor; bg \| null \}/g, 'function estiloResposta(resposta)');
s = s.replace(/function corGravidade\(gravidade\): \{ bg; text \}/g, 'function corGravidade(gravidade)');

const carregarIcone = `function carregarIconeMarca() {
  try {
    const logoPath = path.join(getProjectRoot(), 'frontend', 'public', 'Logo_Alvim_Icone.png');
    if (!fs.existsSync(logoPath)) return null;
    const buffer = fs.readFileSync(logoPath);
    const dim = sizeOf(buffer);
    return {
      dataUrl: \`data:image/png;base64,\${buffer.toString('base64')}\`,
      w: dim.width || 1,
      h: dim.height || 1,
    };
  } catch {
    return null;
  }
}`;

s = s.replace(/async function carregarIconeMarca\(\)[\s\S]*?^}/m, carregarIcone);

s = s.replace(
  /const urlsNaoImg = \(r\.midia_urls\?\.length \?\? 0\) - imagens\.length;/,
  'const urlsNaoImg = countMidiaResposta(r.foto_url) - imagens.length;',
);

const tail = `
async function carregarImagensResposta(r) {
  const imagens = [];
  if (!r.foto_url) return imagens;
  const n = countMidiaResposta(r.foto_url);
  for (let i = 0; i < n; i++) {
    try {
      const { buffer, mime } = decryptMidiaResposta(r.foto_url, i);
      if (!mime.startsWith('image/')) continue;
      const dim = sizeOf(buffer);
      imagens.push({
        dataUrl: \`data:\${mime};base64,\${buffer.toString('base64')}\`,
        mime,
        w: dim.width || 800,
        h: dim.height || 600,
      });
    } catch {
      /* ignora */
    }
  }
  return imagens;
}

export async function gerarPdfVisitaBuffer(dados) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const v = dados.visita;
  const logo = carregarIconeMarca();
  const rotulo = rotuloVisita(v);

  let y = cabecalhoExecutivo(doc, dados, logo);
  y = desempenhoCategorias(doc, y, dados.desempenho_categorias);

  const porCategoria = new Map();
  for (const r of dados.respostas) {
    const cat = r.categoria || 'Outros';
    if (!porCategoria.has(cat)) porCategoria.set(cat, []);
    porCategoria.get(cat).push(r);
  }

  if (porCategoria.size) {
    y = tituloSecao(doc, y, 'Respostas do checklist');

    let catIdx = 0;
    for (const [categoria, items] of porCategoria) {
      y = garantirEspaco(doc, y, 14);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      setText(doc, NAVY_MID);
      doc.text(categoria, MARGIN, y + 3);
      setStroke(doc, ACCENT);
      doc.setLineWidth(0.6);
      doc.line(MARGIN, y + 4.5, MARGIN + 28, y + 4.5);
      setStroke(doc, LINE);
      doc.setLineWidth(0.2);
      doc.line(MARGIN + 28, y + 4.5, PAGE_W - MARGIN, y + 4.5);
      y += 8;

      let respIdx = 0;
      for (const r of items) {
        const imagens = await carregarImagensResposta(r);
        y = desenharBlocoResposta(doc, y, r, imagens, respIdx);
        respIdx += 1;
      }
      catIdx += 1;
      y += catIdx < porCategoria.size ? 2 : 0;
    }
  }

  desenharNaoConformidades(doc, dados.nao_conformidades, v);

  rodape(doc, rotulo);

  return Buffer.from(doc.output('arraybuffer'));
}
`;

s = s.replace(/async function carregarImagem\(path\)[\s\S]*$/m, tail);

fs.writeFileSync(dest, header + s);
console.log('Wrote', dest);
