# Baixa da contagem diária — em português claro

Se você só puder ler uma página, é esta.

---

## O que o sistema está tentando fazer

Todo dia a loja **conta** uns 16 produtos críticos (pão, carne, queijo, batata, frango…).

Entre uma contagem e outra, o sistema precisa **tirar do saldo** o que foi vendido. Isso é a **baixa**.

Exemplo: vendeu 10 Whopper → tem que sair cheddar, carne e pão do estoque.

Se a baixa estiver errada, a próxima contagem “não fecha”. Não é a Raquel que contou mal. É o sistema que tirou o peso errado.

---

## A regra em uma frase

A ficha diz **quantas peças** o sanduíche usa.  
A câmara conta em **quilo** (ou em **pão inteiro**).  
Se peça e quilo forem unidades diferentes, a gente precisa saber **quanto pesa 1 peça**.

Esse “quanto pesa 1 peça” é o **fator**.  
Não é um tipo de lançamento. É só a conta.

---

## Três situações, sempre as mesmas

**1. Já está na mesma unidade — baixa direto**

Pão: a ficha pede 1 pão, a câmara conta pão.  
1 vendido = 1 a menos. Pronto.

Batata e bacon em kg na ficha: já está em quilo. Copia o número.

**2. Peça → quilo, e a gente sabe o peso**

Cheddar: a ficha pede 2 fatias, a câmara conta kg.  
1 fatia = 0,0115 kg. Dois fatias = 0,023 kg.  
Sem isso o sistema antigo fazia 2 fatias = 2 kg. Absurdo.

**3. Peça → quilo, e a gente NÃO sabe o peso**

Aí **não baixa**. Melhor o saldo ficar parado do que inventar quilo.

---

## De onde veio o peso da peça

A nota fiscal diz: “chegou **1 caixa** de nugget = **12 kg**”.  
Ela **não** diz quantos nuggets tem na caixa.

Quem diz isso é a ficha, na observação: “caixa com **588** unidades, 12 kg”.

Conta:

```text
12 kg ÷ 588 nuggets = 0,0204 kg por nugget
(cerca de 20 gramas)
```

Vendeu um 10 nuggets → tira 0,204 kg.

A nota da 706/7 Norte ainda não está no sistema. Usamos as notas do **Terraço**, mesmo produto, mesma caixa.

Cópia das notas: `nf-amostras.json` nesta pasta.

---

## O que já está coberto (os 16 da diária)

Os 3 lançamentos novos (mix 22 kg, queijo crispy, frango pizzaiolo) **saíram da diária**. Ainda não usamos.

| O que a loja conta | Baixa? | Por quê, em uma linha |
|---|---|---|
| Cheddar | Sim | 2 fatias × 0,0115 kg |
| Carne Whopper | Sim | peso da peça na caixa |
| Carne HB | Sim | idem |
| Carne gourmet | Sim | ficha e câmara são peça |
| Batata | Sim | já vem em kg |
| Pão 5, pão 4, Supremo, brioche | Sim | 1 pão = 1 pão (e o Excel come o zero do código) |
| Chicken Jr | Sim | caixa 9,88 kg ÷ 152 peças |
| Nuggets | Sim | caixa 12 kg ÷ 588 peças |
| Bacon tiras | Sim, quando a ficha pede **peça** | caixa 4 kg ÷ 1187 tiras |
| Rebel | Sim | caixa 12 kg ÷ 122 peças |
| Bacon cubos | Só quando a ficha já está em **kg** | “fatia” nesse código ainda não |
| Mix baunilha / doce de leite | Não | a ficha fala em **volta** da máquina, a nota fala em caixa de 20 kg. Falta a conta volta → kg |

Traduzindo: **sanduíche, frango, pão, queijo, batata e carne** estão no jogo.  
**Mix da máquina de sorvete** ainda não.

---

## O que ainda precisa ir para o servidor

Isso está no código. Produção só muda depois de:

1. commit / deploy  
2. rodar a migration `164` no banco de produção  

Sem isso, nugget / chicken / bacon tiras / rebel continuam **não baixando** no app de verdade.

---

## Um erro da ficha (para não usar)

O código do bacon tiras (`28582`) aparece em combo escrito **“Batata M, 120 g”**.  
É código de bacon com texto de batata. Ignoramos essa linha na conta.
