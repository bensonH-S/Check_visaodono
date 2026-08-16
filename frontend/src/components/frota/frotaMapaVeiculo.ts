import L from 'leaflet';
import type { FrotaVeiculoHistoricoPonto, FrotaVeiculoPosicao } from '../../api/client';
import { formatDataHoraBalaoMapa, formatarDuracaoMs, parseDataApi } from '../../utils/dateBr';
import { MAX_INTERVALO_PARADO_MS } from '../../utils/frotaTempoParado';
import { geocodificarReversa } from '../../utils/geocodificarReversa';

export const VELOCIDADE_MINIMA_MOVIMENTO_KMH = 3;
const MIN_PARADO_MS = 2 * 60 * 1000;

/** em_rota=azul · disponivel=verde · parado=cinza · sem_sinal=cinza claro */
export type StatusVeiculoMapa = 'em_rota' | 'disponivel' | 'parado' | 'sem_sinal';

function escapeHtml(texto: string) {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function formatarDuracaoDesde(iso: string | null | undefined): string {
  if (!iso) return 'tempo indisponível';
  const d = parseDataApi(iso);
  if (Number.isNaN(d.getTime())) return 'tempo indisponível';
  const diffMin = Math.round((Date.now() - d.getTime()) / 60_000);
  if (diffMin < 1) return 'agora';
  if (diffMin < 60) return `${diffMin} min`;
  const diffH = Math.round(diffMin / 60);
  if (diffH < 24) return `${diffH} h`;
  return formatDataHoraBalaoMapa(iso);
}

export function formatarAtualizadoVeiculo(iso: string | null | undefined): { rotulo: string; valor: string } {
  if (!iso) return { rotulo: 'Atualizado:', valor: 'sem registro' };
  const d = parseDataApi(iso);
  if (Number.isNaN(d.getTime())) return { rotulo: 'Atualizado:', valor: 'tempo indisponível' };
  return { rotulo: 'Atualizado:', valor: textoAtualizadoRelativo(iso) };
}

export function textoAtualizadoRelativo(iso: string | null | undefined): string {
  if (!iso) return 'sem registro';
  const ha = formatarDuracaoDesde(iso);
  if (ha === 'agora') return 'agora';
  if (ha.includes('/')) return ha;
  return `há ${ha}`;
}

export function rodapeAtualizadoBalaoHtml(iso: string | null | undefined): string {
  const valor = textoAtualizadoRelativo(iso);
  return `<div class="info-balao-rodape-atualizado"><span class="info-balao-rodape-rotulo">Atualizado:</span> ${escapeHtml(valor)}</div>`;
}

export function formatarNomeModeloVeiculo(veiculo: Pick<FrotaVeiculoPosicao, 'marca' | 'modelo'>) {
  const bruto = (veiculo.modelo || veiculo.marca || '').trim();
  if (!bruto) return 'Veículo';
  return bruto
    .toLowerCase()
    .split(/\s+/)
    .map((parte) => parte.charAt(0).toUpperCase() + parte.slice(1))
    .join(' ');
}

export function statusVeiculoMapa(
  veiculo: Pick<FrotaVeiculoPosicao, 'ignicao' | 'velocidade' | 'rastreamento_disponivel'>,
  comGps = true,
): StatusVeiculoMapa {
  if (!comGps || veiculo.rastreamento_disponivel === false) return 'sem_sinal';
  if (veiculo.ignicao === false) return 'parado';
  const velocidade = Number(veiculo.velocidade);
  if (veiculo.ignicao === true && Number.isFinite(velocidade) && velocidade > VELOCIDADE_MINIMA_MOVIMENTO_KMH) {
    return 'em_rota';
  }
  return 'disponivel';
}

export function rotuloStatusVeiculoMapa(status: StatusVeiculoMapa): string {
  if (status === 'em_rota') return 'Em rota';
  if (status === 'disponivel') return 'Disponível';
  if (status === 'parado') return 'Parado';
  return 'Sem sinal';
}

function iconePopupVeiculoCarro() {
  const base =
    'class="info-veiculo-icone" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="15" height="15" fill="currentColor" aria-hidden="true"';
  return `<svg ${base}><path d="M5 11l1.5-4.5h11L19 11H5zm2.5 5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zm9 0a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99z"/></svg>`;
}

function iconePopupVeiculo(tipo: 'velocidade' | 'ignicao' | 'endereco' | 'atualizado') {
  const base =
    'class="info-veiculo-icone" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="15" height="15" fill="currentColor" aria-hidden="true"';
  if (tipo === 'velocidade') {
    return `<svg ${base}><path d="M20.38 8.57l-1.23 1.85a8 8 0 0 1-.22 7.58H5.07A8 8 0 0 1 15.58 6.85l1.85-1.23A10 10 0 0 0 3.92 16a10 10 0 0 0 17.16 0 10 10 0 0 0-0.7-7.43z"/><path d="M10.59 15.41a2 2 0 0 0 2.83 0l5.66-8.49-8.49 5.66a2 2 0 0 0 0 2.83z"/></svg>`;
  }
  if (tipo === 'ignicao') {
    return `<svg ${base}><path d="M17 8h-1V6c0-2.76-2.24-5-5-5S6 3.24 6 6v2H5c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zM9 6c0-1.66 1.34-3 3-3s3 1.34 3 3v2H9V6zm9 14H6V10h12v10zm-6-3c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2z"/></svg>`;
  }
  if (tipo === 'atualizado') {
    return `<svg ${base}><path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/></svg>`;
  }
  return `<svg ${base}><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>`;
}

function linhaPopupVeiculo(
  tipo: 'velocidade' | 'ignicao' | 'endereco' | 'atualizado',
  rotulo: string,
  valor: string,
) {
  return `<div class="info-veiculo-linha">
    <span class="info-veiculo-linha-icone">${iconePopupVeiculo(tipo)}</span>
    <span class="info-veiculo-linha-texto"><span class="info-veiculo-rotulo">${escapeHtml(rotulo)}</span> ${escapeHtml(valor)}</span>
  </div>`;
}

function tituloPopupVeiculo(titulo: string) {
  return `<div class="info-veiculo-titulo">
    <span class="info-veiculo-titulo-icone">${iconePopupVeiculoCarro()}</span>
    <span class="info-veiculo-titulo-texto">${escapeHtml(titulo)}</span>
  </div>`;
}

export function htmlInfoVeiculo(
  v: FrotaVeiculoPosicao,
  endereco?: string | null,
  comGps = true,
) {
  const status = statusVeiculoMapa(v, comGps);
  const modelo = formatarNomeModeloVeiculo(v);
  const titulo = modelo !== 'Veículo' ? `${v.placa} - ${modelo}` : v.placa;
  const ignicao =
    v.ignicao === true ? 'Ligado' : v.ignicao === false ? 'Desligado' : 'Sem informação';
  const velocidade = v.velocidade != null ? `${v.velocidade} km/h` : '—';
  const enderecoValor =
    endereco === undefined ? 'Buscando endereço…' : endereco || 'Endereço indisponível';
  const estaParado = status !== 'em_rota';

  let linhaEstado = '';
  if (status === 'parado' && v.atualizado_em) {
    const ha = formatarDuracaoDesde(v.atualizado_em);
    const desde = formatDataHoraBalaoMapa(v.atualizado_em);
    const valor = ha === 'agora' ? desde : `${desde} (há ${ha})`;
    linhaEstado = linhaPopupVeiculo('ignicao', 'Desligado desde:', valor);
  } else if (estaParado && status !== 'sem_sinal') {
    linhaEstado = linhaPopupVeiculo('atualizado', 'Parado há:', formatarDuracaoDesde(v.atualizado_em));
  }

  return `<div class="info-veiculo-mapa info-veiculo-mapa--${status}">
    ${tituloPopupVeiculo(titulo)}
    ${linhaPopupVeiculo('velocidade', 'Velocidade:', velocidade)}
    ${linhaPopupVeiculo('ignicao', 'Ignição:', ignicao)}
    ${linhaEstado}
    ${linhaPopupVeiculo('endereco', 'Endereço:', enderecoValor)}
    ${rodapeAtualizadoBalaoHtml(v.atualizado_em)}
  </div>`;
}

export function marcadorVeiculo(
  veiculo: Pick<FrotaVeiculoPosicao, 'marca' | 'modelo' | 'ignicao' | 'velocidade' | 'rastreamento_disponivel'>,
  mobile = false,
  destacado = false,
  comGps = true,
  forcarStatus?: StatusVeiculoMapa,
) {
  const w = mobile ? (destacado ? 40 : 34) : 32;
  const status = forcarStatus ?? statusVeiculoMapa(veiculo, comGps);
  const modelo = formatarNomeModeloVeiculo(veiculo);
  const labelW = Math.min(mobile ? 84 : 76, Math.max(44, modelo.length * 6.5 + 14));
  const totalW = w + labelW + 6;
  const pinH = w + 10;
  const cls = ['marker-veiculo-pin', `is-${status}`, destacado ? 'is-destaque' : ''].filter(Boolean).join(' ');
  return L.divIcon({
    className: 'marcador-veiculo-pin',
    html: `<div class="marker-veiculo-wrap" style="width:${totalW}px">
      <div class="${cls}" style="width:${w}px">
        <div class="marker-veiculo-corpo">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M5 11l1.5-4.5h11L19 11H5zm2.5 5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zm9 0a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99z"/>
          </svg>
        </div>
        <div class="marker-veiculo-ponta"></div>
      </div>
      <div class="marker-veiculo-modelo" title="${escapeHtml(modelo)}">${escapeHtml(modelo)}</div>
    </div>`,
    iconSize: [totalW, pinH],
    iconAnchor: [w / 2, pinH - 1],
    popupAnchor: [0, -(pinH - 2)],
  });
}

export function pontoHistoricoParaVeiculo(
  ponto: FrotaVeiculoHistoricoPonto,
  meta: Pick<FrotaVeiculoPosicao, 'id_veiculo' | 'placa' | 'marca' | 'modelo'>,
): FrotaVeiculoPosicao {
  return {
    id_veiculo: meta.id_veiculo,
    placa: meta.placa,
    marca: meta.marca,
    modelo: meta.modelo,
    latitude: ponto.latitude,
    longitude: ponto.longitude,
    velocidade: ponto.velocidade ?? null,
    ignicao: ponto.ignicao ?? null,
    atualizado_em: ponto.atualizado_em ?? null,
    rastreamento_disponivel: true,
  };
}

export function vincularPopupVeiculo(
  marker: L.Marker,
  v: FrotaVeiculoPosicao,
  onClicar?: (veiculo: FrotaVeiculoPosicao) => void,
  comGps = true,
  semPopup = false,
) {
  const comRastreamento = comGps && v.rastreamento_disponivel !== false;
  const status = statusVeiculoMapa(v, comRastreamento);
  marker.off('popupopen');
  marker.off('click');
  marker.unbindPopup();
  if (!semPopup) {
    marker.bindPopup(htmlInfoVeiculo(v, undefined, comRastreamento), {
      maxWidth: 320,
      className: `popup-veiculo-mapa popup-veiculo-mapa--${status}`,
    });
    marker.on('popupopen', () => {
      void geocodificarReversa(Number(v.latitude), Number(v.longitude)).then((endereco) => {
        marker.setPopupContent(htmlInfoVeiculo(v, endereco, comRastreamento));
      });
    });
  }
  marker.on('click', (ev) => {
    L.DomEvent.stopPropagation(ev);
    if (!semPopup) marker.openPopup();
    onClicar?.(v);
  });
}

type EventoDesligado = {
  inicio: FrotaVeiculoHistoricoPonto;
  fim: FrotaVeiculoHistoricoPonto;
  pontos: FrotaVeiculoHistoricoPonto[];
  duracaoMs: number;
  religadoEm: string | null;
};

function pontoDesligadoParado(p: FrotaVeiculoHistoricoPonto) {
  return p.ignicao === false && (Number(p.velocidade) || 0) <= VELOCIDADE_MINIMA_MOVIMENTO_KMH;
}

function ordenarPontos(pontos: FrotaVeiculoHistoricoPonto[]) {
  return [...pontos].sort((a, b) => {
    const ta = a.atualizado_em ? new Date(a.atualizado_em).getTime() : 0;
    const tb = b.atualizado_em ? new Date(b.atualizado_em).getTime() : 0;
    return ta - tb;
  });
}

function calcularDuracaoMs(inicio: FrotaVeiculoHistoricoPonto, fim: FrotaVeiculoHistoricoPonto): number {
  const ta = inicio.atualizado_em ? new Date(inicio.atualizado_em).getTime() : NaN;
  const tb = fim.atualizado_em ? new Date(fim.atualizado_em).getTime() : NaN;
  if (!Number.isFinite(ta) || !Number.isFinite(tb) || tb <= ta) return 0;
  return tb - ta;
}

function centroPontos(pontos: FrotaVeiculoHistoricoPonto[]): [number, number] | null {
  const coords = pontos
    .map((p) => {
      const lat = Number(p.latitude);
      const lng = Number(p.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
      return [lat, lng] as [number, number];
    })
    .filter((c): c is [number, number] => c != null);
  if (!coords.length) return null;
  if (coords.length === 1) return coords[0];
  const lat = coords.reduce((s, c) => s + c[0], 0) / coords.length;
  const lng = coords.reduce((s, c) => s + c[1], 0) / coords.length;
  return [lat, lng];
}

function agruparEventosDesligado(pontos: FrotaVeiculoHistoricoPonto[]): EventoDesligado[] {
  const ordenados = ordenarPontos(pontos);
  const eventos: EventoDesligado[] = [];
  let atual: EventoDesligado | null = null;

  const fechar = (proximo?: FrotaVeiculoHistoricoPonto) => {
    if (!atual) return;
    const ta = atual.inicio.atualizado_em ? new Date(atual.inicio.atualizado_em).getTime() : NaN;
    let duracao = calcularDuracaoMs(atual.inicio, atual.fim);
    let religadoEm: string | null = null;

    if (proximo?.atualizado_em && !pontoDesligadoParado(proximo)) {
      const tr = new Date(proximo.atualizado_em).getTime();
      if (Number.isFinite(ta) && Number.isFinite(tr) && tr > ta) {
        religadoEm = proximo.atualizado_em;
        duracao = tr - ta;
      }
    }

    atual.duracaoMs = duracao;
    atual.religadoEm = religadoEm;
    if (atual.duracaoMs >= MIN_PARADO_MS) eventos.push(atual);
    atual = null;
  };

  for (const p of ordenados) {
    if (pontoDesligadoParado(p)) {
      if (atual) {
        const gap = calcularDuracaoMs(atual.fim, p);
        if (gap > MAX_INTERVALO_PARADO_MS) {
          fechar();
          atual = { inicio: p, fim: p, pontos: [p], duracaoMs: 0, religadoEm: null };
        } else {
          atual.fim = p;
          atual.pontos.push(p);
        }
      } else {
        atual = { inicio: p, fim: p, pontos: [p], duracaoMs: 0, religadoEm: null };
      }
    } else {
      fechar(p);
    }
  }
  fechar();
  return eventos;
}

function htmlInfoEventoHistorico(
  titulo: string,
  ponto: FrotaVeiculoHistoricoPonto,
  veiculo: Pick<FrotaVeiculoPosicao, 'placa' | 'marca' | 'modelo'>,
  extras?: { duracaoMs?: number; religadoEm?: string | null },
  endereco?: string | null,
) {
  const modelo = formatarNomeModeloVeiculo(veiculo as FrotaVeiculoPosicao);
  const subtitulo = modelo !== 'Veículo' ? `${veiculo.placa} - ${modelo}` : veiculo.placa;
  const hora = ponto.atualizado_em ? formatDataHoraBalaoMapa(ponto.atualizado_em) : '—';
  const enderecoValor = endereco === undefined ? 'Buscando endereço…' : endereco || 'Endereço indisponível';
  const duracao =
    extras?.duracaoMs && extras.duracaoMs > 0
      ? linhaPopupVeiculo('atualizado', 'Tempo parado:', formatarDuracaoMs(extras.duracaoMs))
      : '';
  const religou =
    extras?.religadoEm
      ? linhaPopupVeiculo('ignicao', 'Religou em:', formatDataHoraBalaoMapa(extras.religadoEm))
      : '';

  return `<div class="info-veiculo-mapa">
    ${tituloPopupVeiculo(subtitulo)}
    <div class="info-veiculo-evento">${escapeHtml(titulo)}</div>
    ${linhaPopupVeiculo('atualizado', 'Horário:', hora)}
    ${duracao}
    ${religou}
    ${linhaPopupVeiculo('endereco', 'Endereço:', enderecoValor)}
    ${rodapeAtualizadoBalaoHtml(ponto.atualizado_em)}
  </div>`;
}

function vincularPopupEventoHistorico(
  marker: L.Marker,
  titulo: string,
  ponto: FrotaVeiculoHistoricoPonto,
  veiculo: Pick<FrotaVeiculoPosicao, 'placa' | 'marca' | 'modelo'>,
  extras?: { duracaoMs?: number; religadoEm?: string | null },
) {
  const lat = Number(ponto.latitude);
  const lng = Number(ponto.longitude);
  marker.bindPopup(htmlInfoEventoHistorico(titulo, ponto, veiculo, extras), {
    maxWidth: 320,
    className: 'popup-veiculo-mapa',
  });
  marker.on('popupopen', () => {
    void geocodificarReversa(lat, lng).then((endereco) => {
      marker.setPopupContent(htmlInfoEventoHistorico(titulo, ponto, veiculo, extras, endereco));
    });
  });
  marker.on('click', (ev) => {
    L.DomEvent.stopPropagation(ev);
    marker.openPopup();
  });
}

export function desenharMarcadoresIgnicaoDia(
  layer: L.LayerGroup,
  pontos: FrotaVeiculoHistoricoPonto[],
  veiculo: Pick<FrotaVeiculoPosicao, 'id_veiculo' | 'placa' | 'marca' | 'modelo'>,
  bounds: L.LatLngBounds,
  pane = 'paneVeiculoHistorico',
) {
  layer.clearLayers();
  const ordenados = ordenarPontos(pontos);
  if (!ordenados.length) return;

  const primeiraLigada = ordenados.find((p) => p.ignicao === true);
  if (primeiraLigada) {
    const coord = centroPontos([primeiraLigada]);
    if (coord) {
      bounds.extend(coord);
      const v = pontoHistoricoParaVeiculo(primeiraLigada, veiculo);
      const marker = L.marker(coord, {
        pane,
        icon: marcadorVeiculo(v, true, false, true, 'em_rota'),
        zIndexOffset: 850,
      });
      vincularPopupEventoHistorico(marker, 'Primeira ligada do dia', primeiraLigada, veiculo);
      marker.addTo(layer);
    }
  }

  const eventosDesligado = agruparEventosDesligado(ordenados);
  const ultimoPonto = ordenados[ordenados.length - 1];
  const ultimoEhDesligado = ultimoPonto?.ignicao === false;

  for (const [idx, evento] of eventosDesligado.entries()) {
    const coord = centroPontos(evento.pontos);
    if (!coord) continue;
    bounds.extend(coord);
    const v = pontoHistoricoParaVeiculo(evento.inicio, veiculo);
    const ehUltimo = ultimoEhDesligado && evento.fim.id === ultimoPonto.id;
    const titulo = ehUltimo ? 'Parada com desligamento · Último desligamento' : 'Parada com desligamento';
    const marker = L.marker(coord, {
      pane,
      icon: marcadorVeiculo(v, true, ehUltimo, true, 'parado'),
      zIndexOffset: ehUltimo ? 860 : 840,
    });
    vincularPopupEventoHistorico(marker, titulo, evento.inicio, veiculo, {
      duracaoMs: evento.duracaoMs,
      religadoEm: evento.religadoEm,
    });
    marker.addTo(layer);
    void idx;
  }

  if (ultimoEhDesligado) {
    const jaMarcado = eventosDesligado.some((e) => e.fim.id === ultimoPonto.id);
    if (!jaMarcado) {
      const coord = centroPontos([ultimoPonto]);
      if (coord) {
        bounds.extend(coord);
        const v = pontoHistoricoParaVeiculo(ultimoPonto, veiculo);
        const marker = L.marker(coord, {
          pane,
          icon: marcadorVeiculo(v, true, true, true, 'parado'),
          zIndexOffset: 860,
        });
        vincularPopupEventoHistorico(marker, 'Último desligamento do dia', ultimoPonto, veiculo);
        marker.addTo(layer);
      }
    }
  }
}

export function desenharMarcadorVeiculoAoVivo(
  layer: L.LayerGroup,
  veiculo: FrotaVeiculoPosicao,
  bounds: L.LatLngBounds,
  pane = 'paneVeiculoHistorico',
) {
  layer.clearLayers();
  const lat = Number(veiculo.latitude);
  const lng = Number(veiculo.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
  const coord: [number, number] = [lat, lng];
  bounds.extend(coord);
  const marker = L.marker(coord, {
    pane,
    icon: marcadorVeiculo(veiculo, true, true, veiculo.rastreamento_disponivel !== false),
    zIndexOffset: 900,
  });
  vincularPopupVeiculo(marker, veiculo, undefined, veiculo.rastreamento_disponivel !== false);
  marker.addTo(layer);
}
