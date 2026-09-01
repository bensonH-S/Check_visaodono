# Meridian — Motor de baixa de estoque

Documento de trabalho do motor, no formato do plano de correção (30/08/2026).
Não é um rewrite do `estoqueMotor`. É a camada de decisão **antes** de `aplicarMovimento`.

**Loja âncora do piloto:** BKN 23531 — 706/7 Norte  
**Código:** `backend/src/services/estoqueConsumo.js` + `baixarPorProdutoVenda` em `estoqueMotor.js`  
**Fonte de verdade da conversão:** tabela `estoque_conversoes` (não o campo `qtde_estoque` da ficha)

---

## 1. Diagnóstico (o que estava errado)

O motor não precisava ser refeito. O buraco era a interpretação da ficha quando a unidade da receita é diferente da unidade do estoque.

Exemplo real:

- Produto: WHOPPER
- Ficha: cheddar = **2 UN**
- Insumo: `35619 QUEIJO CHEDDAR CLEAN BK DAN VIGOR CX 8X2,208 KG`
- Controle de estoque: **KG**

O campo `qtde_estoque` às vezes copiava o `2` da receita. O motor usava esse número direto e baixava **2 KG** (2 fatias viravam 2 quilos).

O mesmo padrão vale para carnes em KG cuja ficha fala em UN.

**Regra de ouro:** preferir **não baixar** a gerar uma baixa matematicamente errada. Nunca assumir `UN = KG`.

---

## 2. Fluxo atual

```text
Venda BK Office (sync / kit)
    ↓
processarVenda → baixarPorProdutoVenda
    ↓
Produto vendido → ficha técnica
    ↓
Para cada componente da ficha:
    1. Resolver insumo canônico (alias explícito, depois código exato)
    2. Está na diária? (contagem_diaria = true)
         ├── NÃO → FORA_DO_PILOTO · não movimenta
         └── SIM
              ↓
           Conversão resolvida?
              ├── identidade (UN→UND, KG→KG) → baixa
              ├── SI (g↔kg) → baixa
              ├── fator status=validado → baixa
              └── senão → CONVERSAO_NAO_VALIDADA · pendência · sem movimento
```

A whitelist é por **insumo**, não por produto. Um Whopper pode baixar cheddar e carne e ignorar alface.

`qtde_estoque` da ficha **não entra** nessa conta.

A fórmula da **contagem** não muda:

```text
QTD = CAIXA × und_convertida + PC/FD × und_parcial + KG/UND
```

Contagem reconcilia saldo. Não é consumo.

---

## 3. Resolução de consumo

Função única: `resolverConsumoEstoque` / `resolverConsumoInsumo`.

Compara `quantidade_receita`, `unidade_receita`, `unidade_estoque` e fator validado.

| Caso | Receita | Estoque | Resultado |
|---|---|---|---|
| A — identidade peso | 0,014 KG | KG | −0,014 KG |
| B — identidade peça | 1 UN | UND | −1 UND |
| C — SI | 14 g | KG | −0,014 KG |
| D — fator validado | 2 UN × 0,0115 | KG | −0,023 KG |
| E — sem fator | 2 UN | KG | **não baixa** |

Cheddar (embalagem):

```text
2,208 kg / 192 fatias = 0,0115 kg por fatia
1 WHOPPER → 2 × 0,0115 = 0,023 kg
10 WHOPPERS → 0,230 kg
nunca 20 kg
```

---

## 4. Tabelas

### `estoque_conversoes`

`1 unidade_origem = fator unidade_destino`. Só `status = validado` entra na baixa.

Status: `pendente` | `validado` | `bloqueado`.

Fatores semeados hoje:

| Insumo | Fator | Fonte |
|---|---|---|
| Cheddar `35619` | 0,0115 kg / UN ou fatia | 8 × 2,208 kg / 192 fatias |
| Carne Whopper `021403` | 17,2 / 152 kg | caixa 17,2 kg / 152 und |
| Carne HB `35622` | 18,7 / 330 kg | caixa 18,7 kg / 330 und |
| Chicken Jr `031777` | 9,88 / 152 kg | NF 1 cx = 9,88 kg + ficha 152 und |
| Nuggets `34580` | 12 / 588 kg | NF 1 cx = 12 kg + ficha 588 und |
| Bacon tiras `28582` | 4 / 1187 kg | caixa 4 kg + ficha 1187 und |
| Rebel `38178` | 12 / 122 kg | caixa 12 kg + ficha 122 und |

Lançamentos eSupri **fora da diária**: `41962` mix 22 kg, `42284` queijo crispy, `42297` frango pizzaiolo.

### `estoque_insumo_aliases` e zero à esquerda

A ficha (Excel / seed) muitas vezes grava `34754` e o cadastro ativo é `034754`. É o mesmo SKU; o zero caiu no import.

O resolvedor tenta, nesta ordem:

1. alias explícito (`21403` → carne Whopper)
2. código exato, só ativo
3. mesmo número com/sem zero, **somente se existir um único ativo na loja**

Não chuta quando dois ativos diferem só do zero — caso real: `028459` doce de leite e `28459` baunilha.

### `estoque_baixa_pendencias` e `estoque_baixa_auditoria`

Pendência = tentativa bloqueada. Auditoria = cada componente da ficha (aba Piloto / Excel).

### `lojas_estoque_perfil.piloto_baixa`

Ligada em **toda loja com BKN**. Mesma regra: só diária + conversão válida.

---

## 5. O que o motor não faz

- Não reescreve `estoqueMotor` (saldo, break, NF, contagem).
- Não reprocessa histórico contaminado.
- Não baixa insumo fora da diária.
- Não inventa fator.
- Não remove zero à esquerda em massa.
- Sync de venda continua idempotente (delta).

Baseline de prova: contagem D0 depois da regra → vendas/break/NF → saldo teórico → contagem D1. Histórico antigo não serve como prova.

---

## 6. Arquivos

| Peça | Onde |
|---|---|
| Resolvedor + seed + auditoria | `backend/src/services/estoqueConsumo.js` |
| Decisão na baixa de venda | `backend/src/services/estoqueMotor.js` → `baixarPorProdutoVenda` |
| Testes do resolvedor | `backend/src/services/estoqueConsumo.test.js` |
| Schema / fatores | `backend/migrations/160_estoque_piloto_baixa.sql` |
| Expansão para a rede | `backend/migrations/162_estoque_piloto_todas_lojas.sql` |
| Excel da aba Piloto | `GET /estoque/operacional/piloto-auditoria` |

---

## 7. Próximas melhorias (fila)

1. Fator de bacon tiras, nuggets, chicken jr (UN→KG).
2. Conferir se mix / gourmet / rebel / pão 4 entram nas fichas dos produtos vendidos.
3. Só então expandir para insumos fora da diária.
