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
});

export function apenasDigitosKm(val: string): string {
  return val.replace(/\D/g, '');
}

/** Formata KM com separador de milhar (pt-BR: 80.000). */
export function formatarKmInput(val: string): string {
  const digits = apenasDigitosKm(val);
  if (!digits) return '';
  return Number(digits).toLocaleString('pt-BR');
}

/** Aceita dígitos, pontos e vírgulas; formata milhar pt-BR (ex.: 80.000). */
export function filtrarKmAoDigitar(valor: string): string {
  return formatarKmInput(valor.replace(/[^\d.,]/g, ''));
}

export function kmInputParaNumero(val: string): number | null {
  const digits = apenasDigitosKm(val);
  if (!digits) return null;
  return Number(digits);
}

/** Rótulo compacto para listas/select de veículos (placa · marca modelo). */
export function rotuloVeiculoLista(v: {
  placa: string;
  marca?: string | null;
  modelo?: string | null;
  nome_responsavel?: string | null;
  id_usuario_responsavel?: number | null;
}): string {
  const detalhe = [v.marca, v.modelo].filter(Boolean).join(' ');
  let label = detalhe ? `${v.placa} · ${detalhe}` : v.placa;
  if (v.nome_responsavel && v.id_usuario_responsavel) {
    label += ` (${v.nome_responsavel})`;
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
  km_atual?: number | null;
  observacoes?: string | null;
}): FormVeiculoFrota {
  return {
    placa: v.placa || '',
    renavam: v.renavam || '',
    chassi: v.chassi || '',
    marca: v.marca || '',
    modelo: v.modelo || '',
    ano: v.ano != null ? String(v.ano) : '',
    cor: v.cor || '',
    combustivel: v.combustivel || '',
    km_atual: v.km_atual != null ? formatarKmInput(String(v.km_atual)) : '',
    observacoes: v.observacoes || '',
  };
}

export function formParaBody(form: FormVeiculoFrota) {
  return {
    placa: form.placa.trim(),
    renavam: form.renavam.replace(/\D/g, '') || undefined,
    chassi: form.chassi.trim().toUpperCase() || undefined,
    marca: form.marca.trim() || undefined,
    modelo: form.modelo.trim() || undefined,
    ano: form.ano ? Number(form.ano) : null,
    cor: form.cor || undefined,
    combustivel: form.combustivel || undefined,
    km_atual: kmInputParaNumero(form.km_atual),
    observacoes: form.observacoes.trim() || undefined,
  };
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
  valor: 'Digite o valor',
  observacoes: 'Digite observações (opcional)',
} as const;

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
