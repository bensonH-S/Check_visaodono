import type { FrotaVeiculoBody } from '../api/client';

export const MARCAS_VEICULO = [
  'Chevrolet',
  'Citroën',
  'Fiat',
  'Ford',
  'Honda',
  'Hyundai',
  'Jeep',
  'Kia',
  'Mercedes-Benz',
  'Mitsubishi',
  'Nissan',
  'Peugeot',
  'Renault',
  'Toyota',
  'Volkswagen',
  'Volvo',
  'RAM',
  'Outra',
] as const;

const anoAtual = new Date().getFullYear();
export const ANOS_VEICULO = Array.from({ length: anoAtual - 1979 + 2 }, (_, i) =>
  String(anoAtual + 1 - i),
);

export const CORES_VEICULO = [
  'Branco',
  'Preto',
  'Prata',
  'Cinza',
  'Vermelho',
  'Azul',
  'Verde',
  'Bege',
  'Marrom',
  'Amarelo',
  'Laranja',
  'Dourado',
  'Vinho',
  'Outra',
] as const;

export const COMBUSTIVEIS_VEICULO = [
  'Gasolina',
  'Etanol',
  'Flex',
  'Diesel',
  'GNV',
  'Elétrico',
  'Híbrido',
] as const;

export type FormVeiculoFrota = {
  placa: string;
  renavam: string;
  chassi: string;
  marca: string;
  modelo: string;
  ano: string;
  cor: string;
  combustivel: string;
  km_atual: string;
  observacoes: string;
  id_regiao: string;
};

export const formVeiculoVazio = (): FormVeiculoFrota => ({
  placa: '',
  renavam: '',
  chassi: '',
  marca: '',
  modelo: '',
  ano: '',
  cor: '',
  combustivel: '',
  km_atual: '',
  observacoes: '',
  id_regiao: '',
});

export function apenasDigitosKm(val: string): string {
  let s = String(val ?? '').trim();
  if (!s) return '';

  const hasComma = s.includes(',');
  const hasDot = s.includes('.');

  // Descarta parte decimal (KM é inteiro). Ex.: "308.684,500" → "308.684"
  if (hasComma && hasDot) {
    const lastComma = s.lastIndexOf(',');
    const lastDot = s.lastIndexOf('.');
    // pt-BR: 308.684,50 | en-US: 308,684.50
    s = lastComma > lastDot ? s.slice(0, lastComma) : s.slice(0, lastDot);
  } else if (hasComma) {
    const [esq, dir = ''] = s.split(',');
    const dec = dir.replace(/\D/g, '');
    // "308684,5" / "308684,50" → decimal; "308,684" (EN) → milhar
    if (dec.length > 0 && dec.length <= 2) {
      s = esq;
    } else {
      s = esq + dir;
    }
  }

  // Pontos restantes = separador de milhar (pt-BR)
  return s.replace(/\D/g, '');
}

/** Formata KM com separador de milhar (pt-BR: 80.000). */
export function formatarKmInput(val: string): string {
  const digits = apenasDigitosKm(val);
  if (!digits) return '';
  // Evita números absurdos por colagem (ex.: decimal virando dígitos)
  const limitado = digits.slice(0, 8);
  return Number(limitado).toLocaleString('pt-BR');
}

/** Aceita dígitos, pontos e vírgulas; formata milhar pt-BR (ex.: 80.000). */
export function filtrarKmAoDigitar(valor: string): string {
  return formatarKmInput(valor);
}

export function kmInputParaNumero(val: string): number | null {
  const digits = apenasDigitosKm(val).slice(0, 8);
  if (!digits) return null;
  const n = Number(digits);
  return Number.isFinite(n) ? n : null;
}

/** Marca e modelo para exibição em tabelas. */
export function rotuloMarcaModelo(marca?: string | null, modelo?: string | null): string {
  const texto = [marca, modelo].filter(Boolean).join(' ');
  return texto || '—';
}

/** Rótulo compacto para listas/select de veículos (placa · marca modelo). */
export function rotuloVeiculoOpcao(v: {
  placa: string;
  marca?: string | null;
  modelo?: string | null;
}): string {
  const detalhe = [v.marca, v.modelo].filter(Boolean).join(' ');
  return detalhe ? `${v.placa} · ${detalhe}` : v.placa;
}

/** Rótulo compacto para listas/select de veículos (placa · marca modelo). */
export function rotuloVeiculoLista(v: {
  placa: string;
  marca?: string | null;
  modelo?: string | null;
  nome_responsavel?: string | null;
  id_usuario_responsavel?: number | null;
}): string {
  const label = rotuloVeiculoOpcao(v);
  if (v.nome_responsavel && v.id_usuario_responsavel) {
    return `${label} (${v.nome_responsavel})`;
  }
  return label;
}

export function veiculoParaForm(v: {
  placa?: string | null;
  renavam?: string | null;
  chassi?: string | null;
  marca?: string | null;
  modelo?: string | null;
  ano?: number | null;
  cor?: string | null;
  combustivel?: string | null;
  km_inicial?: number | null;
  km_atual?: number | null;
  observacoes?: string | null;
  id_regiao?: number | null;
}): FormVeiculoFrota {
  const kmBase = v.km_inicial != null ? v.km_inicial : v.km_atual;
  return {
    placa: v.placa || '',
    renavam: v.renavam || '',
    chassi: v.chassi || '',
    marca: v.marca || '',
    modelo: v.modelo || '',
    ano: v.ano != null ? String(v.ano) : '',
    cor: v.cor || '',
    combustivel: v.combustivel || '',
    km_atual: kmBase != null ? formatarKmInput(String(kmBase)) : '',
    observacoes: v.observacoes || '',
    id_regiao: v.id_regiao != null ? String(v.id_regiao) : '',
  };
}

export function formParaBody(
  form: FormVeiculoFrota,
  opts?: { omitirKm?: boolean; omitirRegiao?: boolean },
): Partial<FrotaVeiculoBody> & Pick<FrotaVeiculoBody, 'placa'> {
  const body: Partial<FrotaVeiculoBody> & Pick<FrotaVeiculoBody, 'placa'> = {
    placa: form.placa.trim(),
    renavam: form.renavam.replace(/\D/g, '') || undefined,
    chassi: form.chassi.trim().toUpperCase() || undefined,
    marca: form.marca.trim() || undefined,
    modelo: form.modelo.trim() || undefined,
    ano: form.ano ? Number(form.ano) : null,
    cor: form.cor || undefined,
    combustivel: form.combustivel || undefined,
    observacoes: form.observacoes.trim() || undefined,
  };
  if (!opts?.omitirKm) {
    const km = kmInputParaNumero(form.km_atual);
    body.km_inicial = km;
    body.km_atual = km;
  }
  if (!opts?.omitirRegiao) {
    body.id_regiao = form.id_regiao ? Number(form.id_regiao) : null;
  }
  return body;
}

/** Placeholder cinza claro nos campos do formulário. */
export const ph = {
  placa: 'Digite a placa',
  renavam: 'Digite o RENAVAM',
  veiculo: 'Selecione o veículo',
  chassi: 'Digite o chassi',
  marca: 'Selecione a marca',
  modelo: 'Digite o modelo',
  ano: 'Selecione o ano',
  cor: 'Selecione a cor',
  combustivel: 'Selecione o combustível',
  km: 'Digite o KM atual',
  kmInicial: 'Digite o KM inicial do veículo',
  valor: '0,00',
  regiao: 'Selecione a região',
  observacoes: 'Digite observações (opcional)',
} as const;

/**
 * Máscara monetária BR por centavos (digita 15090 → 150,90).
 * Colagem de "R$ 1.150,90" ou "150,90" também funciona.
 */
export function filtrarMoedaAoDigitar(texto: string): string {
  const digitos = String(texto || '').replace(/\D/g, '').slice(0, 12);
  if (!digitos) return '';
  const centavos = Number(digitos);
  if (!Number.isFinite(centavos)) return '';
  return (centavos / 100).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function moedaInputParaNumero(texto: string): number | null {
  const digitos = String(texto || '').replace(/\D/g, '');
  if (!digitos) return null;
  const n = Number(digitos) / 100;
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100) / 100;
}

/** Evita label flutuante “pulando” ao focar no diálogo. */
export const labelFixo = { inputLabel: { shrink: true } };

/** Altura uniforme dos campos simples no mobile da frota (KM, valor, data). */
export const campoAlturaFrotaSx = {
  mb: 2,
  '& .MuiOutlinedInput-root, & .MuiPickersOutlinedInput-root': {
    borderRadius: 2,
    minHeight: 40,
    height: 40,
    alignItems: 'center',
  },
  '& .MuiOutlinedInput-notchedOutline, & .MuiPickersOutlinedInput-notchedOutline': {
    borderRadius: 2,
  },
  '& .MuiOutlinedInput-input, & .MuiPickersInputBase-input': {
    py: 0,
    boxSizing: 'border-box' as const,
    fontSize: '0.875rem',
  },
  '& .MuiInputBase-input::placeholder': {
    color: 'text.disabled',
    opacity: 1,
    fontSize: '0.75rem',
  },
} as const;
