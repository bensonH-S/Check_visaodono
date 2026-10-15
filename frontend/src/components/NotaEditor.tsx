import { useCallback, useEffect, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import FormatBoldIcon from '@mui/icons-material/FormatBold';
import FormatItalicIcon from '@mui/icons-material/FormatItalic';
import FormatListBulletedIcon from '@mui/icons-material/FormatListBulleted';
import FormatUnderlinedIcon from '@mui/icons-material/FormatUnderlined';
import HighlightOffIcon from '@mui/icons-material/HighlightOff';
import HighlightIcon from '@mui/icons-material/Highlight';
import {
  FIN_BORDER,
  FIN_MUTED,
  FIN_SURFACE,
  FIN_SURFACE_ALT,
  FIN_TEXT,
} from '../financeiro/temaFinanceiroEscuro';

type Props = {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
};

type EstadoFmt = {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  mark: boolean;
  fontSize: string;
};

const TAMANHOS: { valor: string; label: string; px: number }[] = [
  { valor: '1', label: 'Pequena', px: 12 },
  { valor: '3', label: 'Normal', px: 15 },
  { valor: '5', label: 'Grande', px: 18 },
  { valor: '6', label: 'Enorme', px: 22 },
];

function ehHtml(s: string) {
  return /<\/?[a-z][\s\S]*>/i.test(s);
}

function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function textoParaHtml(texto: string) {
  if (!texto) return '';
  if (ehHtml(texto)) return texto;
  return texto
    .split(/\n/)
    .map((linha) => `<div>${linha ? escapeHtml(linha) : '<br>'}</div>`)
    .join('');
}

function ehMarkEl(el: HTMLElement) {
  if (el.tagName === 'MARK' || el.getAttribute('data-mark') === '1') return true;
  const bg = (el.style?.backgroundColor || '').toLowerCase();
  return /yellow|ffff00|ffeb3b|fff59d|fef08a|fde047|rgb\(\s*253\s*,\s*224\s*,\s*71/.test(bg);
}

/** Aceita só formatação básica das anotações. */
export function sanitizarNotaHtml(html: string) {
  if (!html || !ehHtml(html)) return html;
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html');
  const root = doc.body.firstElementChild;
  if (!root) return '';

  const permitidos = new Set([
    'DIV', 'P', 'BR', 'B', 'STRONG', 'I', 'EM', 'U', 'UL', 'OL', 'LI', 'SPAN', 'MARK', 'FONT',
  ]);

  function limpar(node: Node) {
    if (node.nodeType === Node.TEXT_NODE) return;
    if (node.nodeType !== Node.ELEMENT_NODE) {
      node.parentNode?.removeChild(node);
      return;
    }
    const el = node as HTMLElement;
    if (!permitidos.has(el.tagName)) {
      const parent = el.parentNode;
      while (el.firstChild) parent?.insertBefore(el.firstChild, el);
      parent?.removeChild(el);
      return;
    }

    const fontSize = el.style?.fontSize || '';
    const isMark = ehMarkEl(el);
    const sizeAttr = el.tagName === 'FONT' ? el.getAttribute('size') : null;

    [...el.attributes].forEach((a) => el.removeAttribute(a.name));

    if (isMark) {
      el.setAttribute('data-mark', '1');
      el.style.backgroundColor = '#fde047';
      el.style.padding = '0 3px';
      el.style.borderRadius = '3px';
    }
    if (fontSize) el.style.fontSize = fontSize;
    if (sizeAttr) {
      const map: Record<string, string> = { '1': '12px', '2': '13px', '3': '15px', '4': '16px', '5': '18px', '6': '22px', '7': '26px' };
      el.style.fontSize = map[sizeAttr] || '15px';
    }

    [...el.childNodes].forEach(limpar);
  }

  [...root.childNodes].forEach(limpar);
  return root.innerHTML;
}

function cmd(comando: string, valor?: string) {
  document.execCommand(comando, false, valor);
}

function ancestralMark(node: Node | null, root: HTMLElement): HTMLElement | null {
  let cur: Node | null = node;
  while (cur && cur !== root) {
    if (cur.nodeType === Node.ELEMENT_NODE && ehMarkEl(cur as HTMLElement)) {
      return cur as HTMLElement;
    }
    cur = cur.parentNode;
  }
  return null;
}

function desmarcarSelecao(root: HTMLElement) {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return false;

  // Caso 1: cursor dentro de um mark existente
  const marks = new Set<HTMLElement>();
  if (!sel.isCollapsed) {
    const range = sel.getRangeAt(0);
    const walker = document.createTreeWalker(range.commonAncestorContainer, NodeFilter.SHOW_ELEMENT);
    let n: Node | null = walker.currentNode;
    while (n) {
      if (n.nodeType === Node.ELEMENT_NODE && ehMarkEl(n as HTMLElement) && range.intersectsNode(n)) {
        marks.add(n as HTMLElement);
      }
      n = walker.nextNode();
    }
    const startMark = ancestralMark(range.startContainer, root);
    const endMark = ancestralMark(range.endContainer, root);
    if (startMark) marks.add(startMark);
    if (endMark) marks.add(endMark);
  } else {
    const m = ancestralMark(sel.anchorNode, root);
    if (m) marks.add(m);
  }

  if (!marks.size) return false;

  for (const mark of marks) {
    const parent = mark.parentNode;
    if (!parent) continue;
    while (mark.firstChild) parent.insertBefore(mark.firstChild, mark);
    parent.removeChild(mark);
  }
  root.normalize();
  return true;
}

function marcarSelecao() {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return false;
  const range = sel.getRangeAt(0);
  const mark = document.createElement('mark');
  mark.setAttribute('data-mark', '1');
  mark.style.backgroundColor = '#fde047';
  mark.style.padding = '0 3px';
  mark.style.borderRadius = '3px';
  try {
    range.surroundContents(mark);
    return true;
  } catch {
    cmd('hiliteColor', '#fde047');
    return true;
  }
}

const btnSx = (ativo: boolean) => ({
  color: ativo ? '#1B6EF3' : FIN_TEXT,
  bgcolor: ativo ? 'rgba(27,110,243,0.12)' : 'transparent',
  borderRadius: 1,
  '&:hover': { bgcolor: ativo ? 'rgba(27,110,243,0.18)' : 'rgba(15,23,42,0.06)' },
});

export default function NotaEditor({ value, onChange, placeholder = 'Anote aqui…' }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const synced = useRef('');
  const [fmt, setFmt] = useState<EstadoFmt>({
    bold: false,
    italic: false,
    underline: false,
    mark: false,
    fontSize: '3',
  });

  const emitir = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const limpo = sanitizarNotaHtml(el.innerHTML);
    synced.current = limpo;
    onChange(limpo === '<div><br></div>' || limpo === '<br>' ? '' : limpo);
  }, [onChange]);

  const lerEstado = useCallback(() => {
    const el = ref.current;
    if (!el || document.activeElement !== el) return;
    const sel = window.getSelection();
    const mark = sel ? Boolean(ancestralMark(sel.anchorNode, el)) : false;
    let fontSize = '3';
    try {
      const v = document.queryCommandValue('fontSize');
      if (v && TAMANHOS.some((t) => t.valor === String(v))) fontSize = String(v);
    } catch {
      /* ignore */
    }
    setFmt({
      bold: document.queryCommandState('bold'),
      italic: document.queryCommandState('italic'),
      underline: document.queryCommandState('underline'),
      mark,
      fontSize,
    });
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const html = textoParaHtml(value || '');
    if (document.activeElement === el) {
      if (sanitizarNotaHtml(el.innerHTML) === sanitizarNotaHtml(html)) return;
    }
    if (synced.current === html && el.innerHTML) return;
    el.innerHTML = html || '';
    synced.current = html;
  }, [value]);

  useEffect(() => {
    const onSel = () => lerEstado();
    document.addEventListener('selectionchange', onSel);
    return () => document.removeEventListener('selectionchange', onSel);
  }, [lerEstado]);

  function aplicar(fn: () => void) {
    ref.current?.focus();
    fn();
    emitir();
    lerEstado();
  }

  function toggleMark() {
    aplicar(() => {
      const el = ref.current;
      if (!el) return;
      // Já tem marca no cursor/seleção → remove. Senão → marca.
      if (fmt.mark) {
        desmarcarSelecao(el);
        return;
      }
      if (desmarcarSelecao(el)) return;
      marcarSelecao();
    });
  }

  function setTamanho(valor: string) {
    aplicar(() => {
      cmd('fontSize', valor);
      // normaliza <font size> para style em px (mais previsível)
      const el = ref.current;
      if (!el) return;
      el.querySelectorAll('font[size]').forEach((font) => {
        const size = font.getAttribute('size') || '3';
        const px = TAMANHOS.find((t) => t.valor === size)?.px || 15;
        const span = document.createElement('span');
        span.style.fontSize = `${px}px`;
        while (font.firstChild) span.appendChild(font.firstChild);
        font.parentNode?.replaceChild(span, font);
      });
    });
  }

  const vazio = !value || value === '<br>' || value === '<div><br></div>';
  const tamLabel = TAMANHOS.find((t) => t.valor === fmt.fontSize)?.label || 'Normal';

  return (
    <Box
      sx={{
        flex: 1,
        minHeight: 0,
        width: '100%',
        maxWidth: 820,
        display: 'flex',
        flexDirection: 'column',
        border: `1px solid ${FIN_BORDER}`,
        borderRadius: 2,
        bgcolor: '#fff',
        overflow: 'hidden',
        boxShadow: '0 1px 2px rgba(15,23,42,0.04)',
      }}
    >
      <Stack
        direction="row"
        spacing={0.5}
        sx={{
          px: 1.25,
          py: 1,
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 0.5,
          borderBottom: `1px solid ${FIN_BORDER}`,
          bgcolor: FIN_SURFACE_ALT,
          flexShrink: 0,
        }}
      >
        <TextField
          select
          size="small"
          value={fmt.fontSize}
          onChange={(e) => setTamanho(e.target.value)}
          onMouseDown={(e) => e.preventDefault()}
          sx={{
            minWidth: 118,
            '& .MuiOutlinedInput-root': {
              height: 32,
              fontSize: 12.5,
              bgcolor: FIN_SURFACE,
            },
          }}
          slotProps={{
            select: { displayEmpty: true },
            input: { 'aria-label': 'Tamanho da fonte' },
          }}
        >
          {TAMANHOS.map((t) => (
            <MenuItem key={t.valor} value={t.valor} sx={{ fontSize: t.px * 0.85 }}>
              {t.label}
            </MenuItem>
          ))}
        </TextField>

        <Divider orientation="vertical" flexItem sx={{ mx: 0.25, borderColor: FIN_BORDER }} />

        <Tooltip title="Negrito (Ctrl+B)">
          <IconButton
            size="small"
            sx={btnSx(fmt.bold)}
            onMouseDown={(e) => {
              e.preventDefault();
              aplicar(() => cmd('bold'));
            }}
          >
            <FormatBoldIcon sx={{ fontSize: 19 }} />
          </IconButton>
        </Tooltip>
        <Tooltip title="Itálico (Ctrl+I)">
          <IconButton
            size="small"
            sx={btnSx(fmt.italic)}
            onMouseDown={(e) => {
              e.preventDefault();
              aplicar(() => cmd('italic'));
            }}
          >
            <FormatItalicIcon sx={{ fontSize: 19 }} />
          </IconButton>
        </Tooltip>
        <Tooltip title="Sublinhado">
          <IconButton
            size="small"
            sx={btnSx(fmt.underline)}
            onMouseDown={(e) => {
              e.preventDefault();
              aplicar(() => cmd('underline'));
            }}
          >
            <FormatUnderlinedIcon sx={{ fontSize: 19 }} />
          </IconButton>
        </Tooltip>

        <Divider orientation="vertical" flexItem sx={{ mx: 0.25, borderColor: FIN_BORDER }} />

        <Tooltip title={fmt.mark ? 'Remover marca amarela' : 'Marcar importante (amarelo)'}>
          <IconButton
            size="small"
            sx={{
              ...btnSx(fmt.mark),
              color: fmt.mark ? '#a16207' : FIN_TEXT,
              bgcolor: fmt.mark ? 'rgba(253,224,71,0.55)' : 'transparent',
            }}
            onMouseDown={(e) => {
              e.preventDefault();
              toggleMark();
            }}
          >
            {fmt.mark ? <HighlightOffIcon sx={{ fontSize: 19 }} /> : <HighlightIcon sx={{ fontSize: 19, color: '#ca8a04' }} />}
          </IconButton>
        </Tooltip>

        <Tooltip title="Lista">
          <IconButton
            size="small"
            sx={btnSx(false)}
            onMouseDown={(e) => {
              e.preventDefault();
              aplicar(() => cmd('insertUnorderedList'));
            }}
          >
            <FormatListBulletedIcon sx={{ fontSize: 19 }} />
          </IconButton>
        </Tooltip>

        <Box sx={{ flex: 1, minWidth: 8 }} />
        <Typography sx={{ fontSize: 11, color: FIN_MUTED, pr: 0.5 }}>
          Fonte: <Box component="span" sx={{ fontWeight: 700, color: FIN_TEXT }}>{tamLabel}</Box>
          {fmt.mark ? ' · marca ativa (clique de novo pra tirar)' : ''}
        </Typography>
      </Stack>

      <Box sx={{ position: 'relative', flex: 1, minHeight: 300, overflow: 'auto', bgcolor: '#fff' }}>
        {vazio ? (
          <Typography
            sx={{
              position: 'absolute',
              top: 18,
              left: 20,
              right: 20,
              fontSize: 15,
              color: FIN_MUTED,
              pointerEvents: 'none',
              lineHeight: 1.7,
              whiteSpace: 'pre-line',
            }}
          >
            {placeholder}
          </Typography>
        ) : null}
        <Box
          ref={ref}
          contentEditable
          suppressContentEditableWarning
          role="textbox"
          aria-multiline
          onInput={() => {
            emitir();
            lerEstado();
          }}
          onBlur={emitir}
          onKeyUp={lerEstado}
          onMouseUp={lerEstado}
          sx={{
            minHeight: '100%',
            px: 2.5,
            py: 2.25,
            outline: 'none',
            color: '#0f172a',
            fontSize: 15,
            lineHeight: 1.75,
            letterSpacing: '0.01em',
            '& div, & p': { margin: 0, minHeight: '1.75em' },
            '& ul, & ol': { margin: '0.4em 0', paddingLeft: 1.6 },
            '& mark, & [data-mark="1"]': {
              backgroundColor: '#fde047 !important',
              padding: '0 3px',
              borderRadius: '3px',
            },
            '& b, & strong': { fontWeight: 700 },
          }}
        />
      </Box>
    </Box>
  );
}
