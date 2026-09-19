# Tema claro / escuro — referência Meridian (Grupo Alvim)

Guia consolidado para reutilizar em outro projeto: cores, logos, accent e técnicas.

---

## 1. Marca (fixa)

| Nome | Hex | Uso |
|------|-----|-----|
| Navy | `#1B2A6B` | Primário no **claro** |
| Navy dark | `#152056` | Hover navy |
| Laranja | `#E8520A` | Primário no **escuro** / CTA |
| Laranja hover | `#CF4909` | Hover laranja |

**Regra de accent**

| Tema | Botões, ícones ativos, links de ação |
|------|--------------------------------------|
| Claro | Navy `#1B2A6B` |
| Escuro | Laranja `#E8520A` |

```ts
const acento = mode === 'dark' ? '#E8520A' : '#1B2A6B';
const acentoHover = mode === 'dark' ? '#CF4909' : '#152056';
```

---

## 2. Superfícies e texto

### Claro

| Papel | Hex |
|-------|-----|
| Fundo (canvas) | `#F9FAFB` |
| Card / surface | `#FFFFFF` |
| Alt / zebra | `#F3F4F6` |
| Texto | `#111827` |
| Texto 2 | `#6B7280` |
| Texto muted | `#9CA3AF` |
| Borda | `#E5E7EB` |
| Borda forte | `#D1D5DB` |
| Soft navy | `rgba(27, 42, 107, 0.06–0.12)` |

### Escuro (Deep Navy — não preto puro)

| Papel | Hex |
|-------|-----|
| Fundo | `#0B0F19` |
| Card / surface | `#111827` |
| Alt | `#0F172A` |
| Elevado / picker | `#1E293B` |
| Texto | `#F8FAFC` |
| Texto 2 (slate) | `#94A3B8` |
| Texto muted | `#64748B` |
| Borda | `rgba(255,255,255,0.08)` |
| Borda forte | `rgba(255,255,255,0.18)` |
| Soft laranja | `rgba(232, 82, 10, 0.14–0.18)` |

Evitar: `#000`, `#050505`, cinza quente (`#9a958e`). Preferir navy + slate.

### Status (apoio)

| | Claro | Escuro |
|--|-------|--------|
| Success | `#059669` | `#34D399` |
| Warning | `#D97706` | `#FB923C` |
| Error | `#DC2626` | `#F87171` |

---

## 3. Logos (mudam com o tema)

Arquivos em `frontend/public/`:

| Arquivo | Quando usar |
|---------|-------------|
| `logo-grupo-alvim.png` | Wordmark no **tema claro** (sidebar, login, BrandLogo) |
| `logo-grupo-alvim-oficial.png` | Wordmark no **tema escuro** (sidebar) — sem fundo navy “bloco” |
| `Logo_Alvim_Icone.png` | Ícone compacto (mobile, PWA, favicon) |
| `Logo_Icon-light.png` / `Logo_Icon-clear.png` | Legado / ícones claros (opcional) |

### Padrão no código (sidebar)

```tsx
const { mode } = useAppTheme();
const escuro = mode === 'dark';

{escuro ? (
  <img src={assetUrl('logo-grupo-alvim-oficial.png')} alt="Grupo Alvim" />
) : (
  <BrandLogo /> // → logo-grupo-alvim.png
)}
```

Constantes (`config/paths.ts`):

```ts
export const LOGO_GRUPO_ALVIM = 'logo-grupo-alvim.png';           // claro
export const LOGO_GRUPO_ALVIM_OFICIAL = 'logo-grupo-alvim-oficial.png'; // escuro
export const LOGO_ALVIM_ICONE = 'Logo_Alvim_Icone.png';         // ícone
```

### Tipografia ao lado da logo

- Claro: nome do app em navy `#1B2A6B`
- Escuro: nome do app em texto primário `#F8FAFC` (ou branco suave)

Não inverter PNG com `filter: invert()` — usar asset certo por tema.

---

## 4. Técnicas

### A) CSS variables + classe no `html`

```css
:root {
  --brand: #1B2A6B;
  --brand-hover: #152056;
  --accent: #E8520A;
  --accent-hover: #CF4909;

  --canvas: #F9FAFB;
  --surface: #FFFFFF;
  --surface-alt: #F3F4F6;
  --text: #111827;
  --text-2: #6B7280;
  --text-3: #9CA3AF;
  --border: #E5E7EB;
  --primary-btn: var(--brand);
  --logo-wordmark: url('/logo-grupo-alvim.png');
}

:root.dark {
  --canvas: #0B0F19;
  --surface: #111827;
  --surface-alt: #0F172A;
  --text: #F8FAFC;
  --text-2: #94A3B8;
  --text-3: #64748B;
  --border: rgba(255, 255, 255, 0.08);
  --primary-btn: var(--accent);
  --logo-wordmark: url('/logo-grupo-alvim-oficial.png');
}

body {
  background: var(--canvas);
  color: var(--text);
}
```

### B) Toggle de tema

1. Estado `mode: 'light' | 'dark'`
2. Persistência: `localStorage.setItem('app-theme-mode', mode)`
3. Sync DOM: `document.documentElement.classList.toggle('dark', mode === 'dark')`
4. (Opcional) MUI: dois `createTheme` + `ThemeProvider` conforme `mode`
5. Tokens TS apontam para CSS vars (`surface: 'var(--ga-surface)'`) — um código, duas aparências

### C) Soft / fundos de ícone

```css
/* claro */
background: color-mix(in srgb, var(--brand) 14%, transparent);
/* escuro */
background: color-mix(in srgb, var(--accent) 14%, transparent);
```

### D) Escopo por página (ex.: dashboard)

No claro, o Command Center força accent navy sobrescrevendo `--ga-orange` / `--ga-primary-btn` na classe da página. No escuro, volta o laranja.

### E) Mobile

Neste app, viewport &lt; `md` força tema claro; a preferência do desktop fica no `localStorage`.

---

## 5. Checklist ao portar

- [ ] Duas logos wordmark (clara + escura) + ícone
- [ ] Trocar `src` da logo pelo `mode` (não só CSS filter)
- [ ] Accent: navy no claro, laranja no escuro
- [ ] Fundos Deep Navy no escuro (`#0B0F19` / `#111827`)
- [ ] Texto secundário slate (`#94A3B8`), não cinza quente
- [ ] CSS vars em `:root` / `:root.dark`
- [ ] Classe `dark` no `<html>`
- [ ] Preferência salva no `localStorage`
- [ ] Componentes usam `var(--*)` ou `acento = mode === 'dark' ? …`

---

## 6. Mini mapa mental

```
claro  → fundo cinza-claro + navy + logo-grupo-alvim.png
escuro → Deep Navy + laranja + logo-grupo-alvim-oficial.png
tudo   → CSS vars + classList('dark') + logo por mode
```
