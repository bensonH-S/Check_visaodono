/**
 * API do Mycto — documentos fiscais.
 * Montada em /auditoria/api/mycto (e /api/mycto) antes do JWT do portal.
 * Contrato: docs/api-mycto-documentos-fiscais.md
 */
import { Router } from 'express';
import { middlewareMycto } from '../integracao/myctoAuth.js';
import { baixarXml, detalheDocumento, listarDocumentos } from '../integracao/myctoFiscal.js';
import { logger } from '../logger.js';

const router = Router();

router.use(middlewareMycto);

function falha(res, err) {
  const status = err?.status || 500;
  if (status >= 500) logger.exception('mycto', err);
  const corpo = { error: err?.message || 'Erro interno' };
  if (err?.codigo) corpo.codigo = err.codigo;
  if (err?.documento) corpo.documento = err.documento;
  res.status(status).json(corpo);
}

router.get('/documentos-fiscais', async (req, res) => {
  try {
    req.myctoLog = {
      tipo: String(req.query.tipo || 'compra'),
      id_loja: req.query.id_loja || null,
      loja: req.query.loja || null,
    };
    const data = await listarDocumentos(req.query);
    res.json(data);
  } catch (err) {
    falha(res, err);
  }
});

router.get('/documentos-fiscais/:ref/xml', async (req, res) => {
  try {
    const { xml, nome, documento } = await baixarXml(req.params.ref);
    req.myctoLog = { id: documento.id, chave: documento.chave, tem_xml: true };
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${nome}"`);
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Documento-Chave', documento.chave || '');
    res.setHeader('X-Documento-Emitente-Cnpj', documento.emitente_cnpj || '');
    res.setHeader('X-Documento-Destinatario-Cnpj', documento.destinatario_cnpj || '');
    res.setHeader('X-Documento-Id-Loja', String(documento.id_loja ?? ''));
    res.setHeader('X-Documento-Emissao', documento.emissao || '');
    res.setHeader('X-Documento-Valor-Total', documento.valor_total == null ? '' : String(documento.valor_total));
    res.send(xml);
  } catch (err) {
    if (err?.documento) {
      req.myctoLog = { id: err.documento.id, chave: err.documento.chave, tem_xml: false };
    }
    falha(res, err);
  }
});

router.get('/documentos-fiscais/:ref', async (req, res) => {
  try {
    const doc = await detalheDocumento(req.params.ref, req.query);
    req.myctoLog = { id: doc.id, chave: doc.chave, tem_xml: doc.tem_xml };
    res.json(doc);
  } catch (err) {
    falha(res, err);
  }
});

router.use((req, res) => {
  res.status(404).json({ error: 'Não encontrado' });
});

export default router;
