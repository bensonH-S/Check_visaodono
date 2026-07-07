const cache = new Map<string, string>();
const pendente = new Map<string, Promise<string>>();

function chaveCoordenada(lat: number, lng: number) {
  return `${lat.toFixed(5)},${lng.toFixed(5)}`;
}

export async function geocodificarReversa(lat: number, lng: number): Promise<string> {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return 'Endereço indisponível';
  const chave = chaveCoordenada(lat, lng);
  const salvo = cache.get(chave);
  if (salvo) return salvo;

  const emAndamento = pendente.get(chave);
  if (emAndamento) return emAndamento;

  const promessa = (async () => {
    try {
      const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;
      const res = await fetch(url, {
        headers: {
          'Accept-Language': 'pt-BR',
        },
      });
      if (!res.ok) throw new Error('reverse failed');
      const data = (await res.json()) as { display_name?: string };
      const endereco = data.display_name?.trim() || 'Endereço indisponível';
      cache.set(chave, endereco);
      return endereco;
    } catch {
      const fallback = 'Endereço indisponível';
      cache.set(chave, fallback);
      return fallback;
    } finally {
      pendente.delete(chave);
    }
  })();

  pendente.set(chave, promessa);
  return promessa;
}
