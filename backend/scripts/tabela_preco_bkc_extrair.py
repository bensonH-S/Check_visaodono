"""Extrai a Tabela de Preço BKC (xlsb) para JSON.

Uso: python tabela_preco_bkc_extrair.py "<arquivo.xlsb>" saida.json [aba]
Aba padrão: TP CD SP (CD que fatura as lojas). Linha 4 = código da tabela (BB5, B31...),
linha 6 = nome da tabela, dados a partir da linha 7 (col D código, E descrição, G unidade).
Requer: pip install pyxlsb
"""
import json
import sys

from pyxlsb import open_workbook


def extrair(caminho, aba='TP CD SP'):
    itens = []
    with open_workbook(caminho) as wb:
        with wb.get_sheet(aba) as sh:
            cod_tab, nomes = {}, {}
            for i, row in enumerate(sh.rows()):
                vals = [c.v for c in row]
                if i == 3:
                    cod_tab = {
                        j: v.strip()
                        for j, v in enumerate(vals)
                        if isinstance(v, str) and len(v.strip()) == 3 and j >= 56
                    }
                    continue
                if i == 5:
                    nomes = {
                        t: (vals[j].strip() if j < len(vals) and isinstance(vals[j], str) else '')
                        for j, t in cod_tab.items()
                    }
                    continue
                if i < 6 or len(vals) < 5 or vals[3] in (None, ''):
                    continue
                cod = vals[3]
                cod = str(int(cod)) if isinstance(cod, float) else str(cod).strip()
                precos = {}
                for j, t in cod_tab.items():
                    v = vals[j] if j < len(vals) else None
                    if isinstance(v, (int, float)) and v > 0:
                        precos[t] = round(float(v), 4)
                if not precos:
                    continue
                itens.append({
                    'codigo': cod,
                    'descricao': str(vals[4] or '').strip(),
                    'tipologia': vals[1] if isinstance(vals[1], str) else None,
                    'unidade': vals[6] if isinstance(vals[6], str) else None,
                    'precos': precos,
                })
    return {'aba': aba, 'tabelas': nomes, 'itens': itens}


if __name__ == '__main__':
    if len(sys.argv) < 3:
        print(__doc__)
        sys.exit(1)
    dados = extrair(sys.argv[1], sys.argv[3] if len(sys.argv) > 3 else 'TP CD SP')
    with open(sys.argv[2], 'w', encoding='utf-8') as f:
        json.dump(dados, f, ensure_ascii=False)
    print(f"{dados['aba']}: {len(dados['itens'])} itens, tabelas {', '.join(dados['tabelas'])}")
