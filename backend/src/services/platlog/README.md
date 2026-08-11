# Platlog / eSupri — sync de preços e NF-e

## Preços (ativo)

Fonte preferida de **preço de estoque** para Platlog:

1. Login no eSupri (`ESUPRI_USER` / `ESUPRI_PASS`)
2. Tela **Pedido** — catálogo com `CÓDIGO`, `DESCRIÇÃO`, `PREÇO R$`
3. Casa com `insumos` da loja pelo código (ignora zeros à esquerda)
4. Grava `preco_caixa` + `custo_fonte = 'catalogo'`

- Serviço: `syncPrecosCatalogoPlatlog.js`
- Cliente: `listarCatalogoPedidoEsupri` em `esupriClient.js`
- Scheduler: `estoque_sync_fornecedor` com `fornecedor = 'platlog'` chama o catálogo (não a NF)

CLI:

```bash
node scripts/sync-platlog-catalogo.mjs --loja=21 --aplicar
```

Sem `--aplicar` só gera relatório (casados / faltando).

### Por que catálogo e não NF?

- A NF só traz itens **comprados** naquele pedido — vários insumos da contagem ficam de fora.
- O catálogo Pedido tem o **preço de prateleira atual** de (quase) tudo que a Platlog vende.
- Contagem aberta / CMV teórico usam o preço vivo do insumo; contagem finalizada já tem `total_valor` snapshot.

## NF-e (legado / outro uso)

O fluxo antigo de baixar ZIP/XML no **Financeiro** continua no código, mas **não** alimenta mais o scheduler Platlog:

| Peça | Arquivo |
|------|---------|
| Download NF-e | `esupriClient.js` → `baixarNfesFinanceiroEsupri` |
| Parse/match/custo NF | `syncNfePlatlog.js` + `../nfeXml.js` |
| Tabelas | `estoque_nfe`, `estoque_nfe_itens` |
| CLI legado | `scripts/sync-platlog-nfe.mjs` |

Útil depois para: conferência de compra, entrada automática de estoque, auditoria de nota — **não** como fonte principal de preço da contagem.

## Credenciais

Só no `.env` do backend (não na tabela):

- `ESUPRI_USER`
- `ESUPRI_PASS`
