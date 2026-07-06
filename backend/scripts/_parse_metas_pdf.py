"""Extrai painéis de resumo (empresa/gestor) de PDFs de metas."""
import json
import re
import sys
import unicodedata

try:
    from pypdf import PdfReader
except ImportError:
    print("Instale pypdf: pip install pypdf", file=sys.stderr)
    sys.exit(1)

MESES = {
    "janeiro": 1,
    "fevereiro": 2,
    "marco": 3,
    "março": 3,
    "abril": 4,
    "maio": 5,
    "junho": 6,
    "julho": 7,
    "agosto": 8,
    "setembro": 9,
    "outubro": 10,
    "novembro": 11,
    "dezembro": 12,
}

SKIP_LINE = re.compile(
    r"^(SUBTOTAL|FINAL|METAS|REF:|BONUS|PLATINA|DESTAQUE|\*|--|\s*$|Demanda)",
    re.I,
)


def fix_text(s: str) -> str:
    s = (s or "").replace("\ufffd", "Ú").replace("SADE", "SAÚDE").replace("SAUDE", "SAÚDE")
    s = s.replace("TERRAO", "TERRAÇO").replace("SAÙDE", "SAÚDE")
    return s.strip()


def norm(s: str) -> str:
    s = fix_text(s).lower()
    s = unicodedata.normalize("NFD", s)
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return re.sub(r"\s+", " ", s).strip()


def slug_indicador(nome: str, tipo: str) -> str:
    n = norm(nome)
    base = {
        "saude": "saude",
        "r.e.v. (ouro)": "rev_ouro",
        "r.e.v. (zc)": "rev_zc",
        "cmp(paga)": "cmp_paga",
        "guest nps": "guest_nps",
        "google": "google",
        "assiduidade": "assiduidade",
        "dlv 4,8": "dlv_48",
        "check list 360": "checklist_360",
        "nps": "nps",
    }.get(n, re.sub(r"[^a-z0-9]+", "_", n).strip("_"))

    if tipo == "gestor":
        gestor_map = {
            "rev_ouro": "gestor_rev_ouro",
            "rev_zc": "gestor_rev_zc",
            "cmp_paga": "gestor_cmp_paga",
        }
        return gestor_map.get(base, base if base.startswith("gestor_") else base)
    return base


def parse_stores(line: str) -> list[str]:
    line = fix_text(line)
    line = re.sub(r"^Gestor\s+", "", line, flags=re.I)
    parts = re.split(r"\s+(?=BK\s)|\s+(?=POPEYES\b)", line, flags=re.I)
    out = []
    for p in parts:
        p = re.sub(r"\s+", " ", p.strip().upper())
        if p.startswith("BK ") or p == "POPEYES":
            if p not in out:
                out.append(p)
    return out


def parse_indicador_line(line: str):
    line = fix_text(line)
    if SKIP_LINE.match(line):
        return None
    if line.upper().startswith("BK "):
        return None

    tokens = line.split()
    celulas_start = None
    for i, tok in enumerate(tokens):
        if tok.upper() in ("OK", "X"):
            celulas_start = i
            break
    if celulas_start is None or celulas_start < 2:
        return None

    try:
        peso = int(tokens[celulas_start - 1])
    except ValueError:
        return None

    nome = " ".join(tokens[: celulas_start - 1]).strip()
    if not nome or nome.upper() in ("BONUS", "PLATINA"):
        return None

    celulas = []
    for tok in tokens[celulas_start:]:
        u = tok.upper()
        if u in ("OK", "X"):
            celulas.append(u)
        elif u.startswith("R$") or tok.upper().startswith("BK "):
            break
        else:
            break

    if not celulas:
        return None

    return {
        "nome": nome,
        "codigo": slug_indicador(nome, ""),
        "peso": peso,
        "celulas": celulas,
    }


def parse_page(text: str, page_idx: int) -> dict | None:
    text = fix_text(text)
    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    if not lines:
        return None

    tipo = "gestor" if page_idx >= 3 or re.match(r"^Gestor\s", lines[0], re.I) else "empresa"
    grupo = (page_idx % 3) + 1

    stores = parse_stores(lines[0])
    if len(stores) < 2:
        return None

    indicadores = []
    for ln in lines[1:]:
        if ln.upper().startswith("SUBTOTAL"):
            break
        if SKIP_LINE.match(ln):
            continue
        ind = parse_indicador_line(ln)
        if not ind:
            continue
        ind["codigo"] = slug_indicador(ind["nome"], tipo)
        indicadores.append(ind)

    if not indicadores:
        return None

    ref_mes = None
    ref_ano = None
    for ln in lines:
        m = re.search(r"REF:\s*([A-Za-zÀ-ú]+)\s+(\d{4})", ln, re.I)
        if m:
            mes_nome = norm(m.group(1))
            ref_mes = MESES.get(mes_nome)
            ref_ano = int(m.group(2))
            break

    # Ajusta células ao nº de lojas
    n = len(stores)
    for ind in indicadores:
        vals = ind["celulas"][:n]
        while len(vals) < n:
            vals.append("")
        ind["celulas"] = vals

    return {
        "tipo": tipo,
        "grupo": grupo,
        "codigo": f"{'gestor' if tipo == 'gestor' else 'empresa'}_grupo{grupo}",
        "titulo": f"{'Gestor' if tipo == 'gestor' else 'Empresa'} — Grupo {grupo}",
        "ordem": (grupo - 1) * 2 + (2 if tipo == "gestor" else 1),
        "lojas_rotulos": stores,
        "indicadores": indicadores,
        "mes": ref_mes,
        "ano": ref_ano,
    }


def parse_pdf(path: str) -> dict:
    reader = PdfReader(path)
    paineis = []
    mes = None
    ano = None

    for i, page in enumerate(reader.pages):
        if i >= 6:
            break
        raw = page.extract_text() or ""
        panel = parse_page(raw, i)
        if not panel:
            continue
        if panel.get("mes"):
            mes = panel["mes"]
        if panel.get("ano"):
            ano = panel["ano"]
        paineis.append(panel)

    # Título do arquivo como fallback
    base = norm(path.split("\\")[-1].split("/")[-1].replace(".pdf", ""))
    for nome, num in MESES.items():
        if nome in base and not mes:
            mes = num
    if not ano:
        ano = 2026

    titulo_mes = [k for k, v in MESES.items() if v == mes]
    titulo = f"Metas {titulo_mes[0].capitalize() if titulo_mes else mes}/{ano}"

    return {
        "arquivo": path,
        "ano": ano,
        "mes": mes,
        "titulo": titulo,
        "paineis": paineis,
    }


def main():
    paths = sys.argv[1:]
    if not paths:
        print("Uso: python _parse_metas_pdf.py arquivo1.pdf ...", file=sys.stderr)
        sys.exit(1)
    out = [parse_pdf(p) for p in paths]
    print(json.dumps(out, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
