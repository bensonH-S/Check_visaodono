export const TI_TICKET_CATEGORIAS = [
  { value: 'geral', label: 'Geral', slaDiasUteis: 3 },
  { value: 'tecnologia', label: 'Tecnologia', slaDiasUteis: 2 },
  { value: 'financeiro', label: 'Financeiro', slaDiasUteis: 2 },
  { value: 'operacoes', label: 'Operações', slaDiasUteis: 1 },
  { value: 'frota', label: 'Frota', slaDiasUteis: 2 },
  { value: 'vendas', label: 'Vendas', slaDiasUteis: 2 },
  { value: 'estoque', label: 'Estoque', slaDiasUteis: 1 },
  { value: 'manutencao', label: 'Manutenção', slaDiasUteis: 2 },
  { value: 'rh', label: 'Recursos Humanos', slaDiasUteis: 3 },
] as const;

export function categoriaTicket(value: string) {
  return TI_TICKET_CATEGORIAS.find((categoria) => categoria.value === value) || TI_TICKET_CATEGORIAS[0];
}

export function calcularPrazoSlaTicket(categoria: string, dataBase: Date | string = new Date()) {
  const config = categoriaTicket(categoria);
  const data = new Date(dataBase);
  data.setHours(12, 0, 0, 0);

  let adicionados = 0;
  while (adicionados < config.slaDiasUteis) {
    data.setDate(data.getDate() + 1);
    const dia = data.getDay();
    if (dia !== 0 && dia !== 6) adicionados += 1;
  }

  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  const dia = String(data.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}
