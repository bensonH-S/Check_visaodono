# Platlog / eSupri — sync de preços e NF-e

## Conta da rede

A conta **VERONICA** no eSupri enxerga as 22 lojas. O sync **sempre filtra** pelo código da loja (`cbLojas[]`) para não misturar NF.

Credenciais:

- `ESUPRI_USER` / `ESUPRI_PASS` no `.env`, **ou**
- `backend/config/credenciais-fornecedores.local.json` (gitignored; copie do `.example.json`)

Mapeamento loja ↔ código eSupri: `backend/src/config/fornecedoresLojas.js`.

## NF-e (entrada no app)

Baixa XML no **Financeiro**, grava `estoque_nfe` e deixa pendente de conferência no mobile.

- Cliente: `baixarNfesFinanceiroEsupri` (AJAX `financeiro.lista.php` + `findfile.php`)
- Serviço: `syncNfePlatlog.js`
- Scheduler: `estoque_sync_fornecedor` com `fornecedor = 'platlog'` (junto com o catálogo)

CLI:

```bash
node backend/scripts/sync-platlog-nfe.mjs --loja=21 --limit=3
node backend/scripts/sync-platlog-nfe.mjs --loja=21 --limit=3 --apply
```

A loja confere a nota no app e só então lança estoque.

## Preços (catálogo Pedido)

Fonte preferida de **preço de estoque** para Platlog:

1. Login VERONICA
2. Tela **Pedido** — `CÓDIGO`, `DESCRIÇÃO`, `PREÇO R$`
3. Casa com `insumos` da loja pelo código
4. Grava `preco_caixa` + `custo_fonte = 'catalogo'`

O scheduler baixa a NF para conferência no app. Catálogo de preço: ligue `ESUPRI_SYNC_CATALOGO=1` no `.env` (já fica ligado no ambiente local).

```bash
node backend/scripts/sync-platlog-catalogo.mjs --loja=21 --aplicar
```

## Coca-Cola (Conecta Brasal)

Login por loja no JSON (`brasal.user` / `brasal.pass`). A API Conecta aceitou **CNPJ + senha** nestas lojas: 706/7 Norte, Sudoeste, São Sebastião, Sobradinho. E-mail/CokeNet (422) ainda não entra neste sync.

## Credenciais

Não versionar senhas. Use:

1. `.env` — `ESUPRI_USER` / `ESUPRI_PASS` (conta rede)
2. `backend/config/credenciais-fornecedores.local.json` — Brasal, Gimba, IdealWork, CokeNet por `bk_number`
