# API Mycto — documentos fiscais

Transmite ao Mycto as NF-e de **compra** que o MERIDIAN já guarda, e o contrato de **venda** (hoje sem XML).

Base (produção): `https://<host>/auditoria/api/mycto`  
O mesmo router também responde em `/api/mycto`. Não usa o JWT do portal.

## Autenticação

`Authorization: Bearer <token>`

Uma das duas formas, nunca as duas obrigatórias:

1. Variável `MYCTO_API_TOKEN` no `.env` da raiz (o que o container `vision-check` lê).
2. Linha em `api_clientes` com o SHA-256 do token (migração `backend/migrations/219_api_clientes_mycto.sql`). Serve para revogar sem redeploy.

Token ausente ou errado: `401`. Acima do limite: `429` e `Retry-After`.

Limite padrão: **120 requisições por minuto** por cliente (`MYCTO_RATE_LIMIT_PER_MIN`). Tentativas sem token: 30/min por IP.

O log (`Logs/AAAA-MM-DD.log`, categoria `mycto`, e a tabela `api_acesso_log` depois da migração) grava método, caminho, status, cliente e IP. Não grava o token nem o XML.

## Listar

```http
GET /auditoria/api/mycto/documentos-fiscais?tipo=compra&id_loja=21&de=2026-11-01&ate=2026-11-30&limit=100
```

| Query | Uso |
| --- | --- |
| `tipo` | `compra` (padrão) ou `venda` |
| `id_loja` | id interno da loja |
| `loja` | `bk_number` |
| `de`, `ate` | emissão `YYYY-MM-DD` |
| `desde_id` | só notas com `id` maior que este (id da `estoque_nfe`) |
| `desde` | instante de `atualizado_em` (ISO, ou data `YYYY-MM-DD` = 00:00 em São Paulo) |
| `cursor` | valor de `proximo_cursor` da página anterior. Se vier, ignora `desde` e `desde_id` |
| `limit` | 1 a 200, padrão 100 |

Duas formas de continuar, sem misturar:

- Por data de alteração: guarde `proximo_cursor` e mande só `cursor` na próxima chamada. A ordem é `atualizado_em`, depois `id`. Nota alterada (novo `atualizado_em`) volta a aparecer.
- Por id: mande `desde_id` (e não mande `cursor` nem `desde`). A ordem é `id`. A próxima chamada usa `desde_id` = `proximo_desde_id`.

O último item da página não se repete. `cursor` anula `desde` e `desde_id`.

Compra devolve metadados e `tem_xml`. O XML em si não vem na lista.

```bash
curl -sS -H "Authorization: Bearer $MYCTO_API_TOKEN" \
  "https://<host>/auditoria/api/mycto/documentos-fiscais?tipo=compra&de=2026-11-01&ate=2026-11-16&limit=50"
```

Resposta (campos):

```json
{
  "tipo": "compra",
  "xml_disponivel": true,
  "limit": 50,
  "tem_mais": true,
  "proximo_cursor": "<opaco>",
  "proximo_desde_id": 18420,
  "documentos": [
    {
      "id": "18420",
      "tipo": "compra",
      "chave": "53123456789012345678901234567890123456789012",
      "numero": "12345",
      "serie": "1",
      "emissao": "2026-11-10",
      "atualizado_em": "2026-11-10T18:02:11.000Z",
      "valor_total": 1520.4,
      "emitente_cnpj": "00000000000191",
      "destinatario_cnpj": "00000000000272",
      "id_loja": 21,
      "loja": "Nome da loja",
      "bk_number": "19929",
      "fonte": "platlog",
      "tem_xml": true
    }
  ]
}
```

Na lista, `destinatario_cnpj` é o CNPJ da loja. No detalhe e no download, se o XML existir, emitente e destinatário saem do próprio XML.

`fonte` é a origem da importação (`platlog`, `sefaz`, `coca`, `gimba`, `idealwork`, …).

### Venda

`tipo=venda` responde `xml_disponivel: false`, `documentos: []` e `motivo`. Não há XML de NFC-e/SAT no banco. Não devolvemos os totais do BK Office no lugar da nota.

```bash
curl -sS -H "Authorization: Bearer $MYCTO_API_TOKEN" \
  "https://<host>/auditoria/api/mycto/documentos-fiscais?tipo=venda"
```

## Metadados de um documento

`ref` é o `id` numérico ou a chave de 44 dígitos.

```bash
curl -sS -H "Authorization: Bearer $MYCTO_API_TOKEN" \
  "https://<host>/auditoria/api/mycto/documentos-fiscais/18420"

curl -sS -H "Authorization: Bearer $MYCTO_API_TOKEN" \
  "https://<host>/auditoria/api/mycto/documentos-fiscais/53123456789012345678901234567890123456789012?incluir_xml=1"
```

`incluir_xml=1` acrescenta o campo `xml` (string). Sem isso o JSON traz só os metadados.

## Baixar o XML

```bash
curl -sS -D - -o nota.xml \
  -H "Authorization: Bearer $MYCTO_API_TOKEN" \
  "https://<host>/auditoria/api/mycto/documentos-fiscais/18420/xml"
```

Corpo: `application/xml`. Cabeçalhos `X-Documento-Chave`, `X-Documento-Emitente-Cnpj`, `X-Documento-Destinatario-Cnpj`, `X-Documento-Id-Loja`, `X-Documento-Emissao`, `X-Documento-Valor-Total`.

Se a nota existe e o XML não (caso típico da Coca/Brasal, que grava JSON do pedido em `xml_path`, ou resumo da SEFAZ ainda sem XML): `404` com `codigo: "xml_indisponivel"` e o objeto `documento`.

## O que entra como compra

| Origem | Onde o XML fica |
| --- | --- |
| Portal eSupri (Platlog) | arquivo em `Logs/esupri-nfe/<id_loja>/<chave>.xml`, caminho em `estoque_nfe.xml_path` |
| SEFAZ DF-e (nota destinada) | `Logs/sefaz-nfe/...` e/ou `finance.nfe_recebida.xml` |
| Ideal Work (WorkExpress) | `Logs/idealwork-nfe/...` |
| Gimba | `Logs/gimba-nfe/...` quando o portal devolve XML |
| Coca / Conecta Brasal | em geral **sem** XML (JSON do pedido). `tem_xml` fica true só se a mesma chave também chegou pela SEFAZ |

A lista é a tabela `estoque_nfe`. Resumo da Receita que ainda não virou linha no gestor não aparece aqui.

## Deploy (não roda sozinho)

1. Colocar no `.env` da raiz do VPS (o `docker-compose` do `vision-check` lê esse arquivo):

   ```env
   MYCTO_API_TOKEN=<chave longa só do Mycto>
   # opcional, padrão 120
   MYCTO_RATE_LIMIT_PER_MIN=120
   ```

   Ou, no lugar da env, gravar o hash em `api_clientes` (veja o comentário da migração). Não commitar o token.

2. Migração, no servidor, **sem** este repositório rodar nada em produção daqui:

   ```bash
   cd backend && node scripts/run-sql.js migrations/219_api_clientes_mycto.sql
   ```

   Sem a migração, `MYCTO_API_TOKEN` já autentica. A tabela de log passa a gravar depois do SQL. Se a tabela não existir, o acesso continua e o log fica só no arquivo do dia.

3. Subir a imagem/código novo e reiniciar o container `vision-check` (porta 3007). Os XML em disco dependem do volume `./Logs:/app/Logs`.

4. Prova:

   ```bash
   curl -sS -o /dev/null -w "%{http_code}\n" \
     -H "Authorization: Bearer $MYCTO_API_TOKEN" \
     "http://127.0.0.1:3007/auditoria/api/mycto/documentos-fiscais?tipo=compra&limit=1"
   ```

   Esperado: `200`. Sem o header: `401`.
