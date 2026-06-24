export function cepSomenteDigitos(cep: string) {
  return cep.replace(/\D/g, '').slice(0, 8);
}

/** Máscara 00000-000 enquanto digita. */
export function formatarCepInput(cep: string) {
  const digits = cepSomenteDigitos(cep);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

export type DadosCep = {
  address: string;
  neighborhood: string;
  city: string;
  state: string;
};

export async function buscarCep(cep: string): Promise<DadosCep | null> {
  const digits = cepSomenteDigitos(cep);
  if (digits.length !== 8) return null;

  const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
  if (!res.ok) return null;

  const data = await res.json();
  if (data?.erro) return null;

  return {
    address: String(data.logradouro || '').trim(),
    neighborhood: String(data.bairro || '').trim(),
    city: String(data.localidade || '').trim(),
    state: String(data.uf || '').trim().toUpperCase(),
  };
}
