import axios from 'axios';

// Proxy do Vite injeta os headers. Na produção, usar um backend.
const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
    'apikey': import.meta.env.VITE_API_KEY,
    'secretkey': import.meta.env.VITE_SECRET_KEY,
  }
});

// Mapeia os campos reais da API Fulltrack (retornados pelo /vehicles/all)
const mapVehicle = (v, position) => ({
  id: v.ras_vei_id,
  plate: v.ras_vei_placa,
  model: `${v.ras_vei_veiculo?.trim()} ${v.ras_vei_modelo?.trim()}`.trim(),
  year: v.ras_vei_ano,
  color: v.ras_vei_cor,
  observation: v.observation,
  odometer: v.ras_vei_odometro,
  
  // Posição e telemetria vêm do /events/all
  lat: position ? parseFloat(position.ras_eve_latitude) : null,
  lng: position ? parseFloat(position.ras_eve_longitude) : null,
  speed: position ? parseInt(position.ras_eve_velocidade) || 0 : 0,
  ignition: position ? position.ras_eve_ignicao : '0',
  direction: position ? position.ras_eve_direcao : '0',
  gps_signal: position ? position.ras_ras_sinal_gps : '0',
  gprs_signal: position ? position.ras_eve_nivel_sinal_gprs : '0',
  satellites: position ? position.ras_eve_satelites : '0',
  last_update: position ? position.ras_eve_data_gps : v.ras_vei_data_ult_alt,
  equipment_id: v.ras_vei_equipamento,
  
  // Dados extras de telemetria
  fuel: position ? position.total_combustivel || position.sensor_combustivel : null,
  driver: position?.ras_mot_nome && position.ras_mot_nome !== 'PADRAO' ? position.ras_mot_nome : null,
  battery_voltage: position ? position.ras_eve_voltagem : null,
  backup_battery_pct: position ? position.ras_eve_porc_bat_backup : null,
  horimeter: position ? position.ras_eve_horimetro : null,
  temperature: position ? position.sensor_temperatura : null,
});

// Mapeia os campos de evento/histórico
const mapEvent = (h, index) => ({
  id: index,
  time: h.ras_eve_data_gps || h.ras_tel_data || '-',
  ignition: h.ras_eve_ignicao === '1' ? 'Ligado' : 'Desligado',
  speed: parseInt(h.ras_eve_velocidade) || 0,
  lat: parseFloat(h.ras_eve_latitude || h.ras_tel_latitude),
  lng: parseFloat(h.ras_eve_longitude || h.ras_tel_longitude),
  direction: h.ras_eve_direcao || '-',
  satellites: h.ras_eve_satelites || '-',
  odometer: h.ras_eve_hodometro || '-',
  fuel: h.total_combustivel || h.sensor_combustivel || null,
  driver: h.ras_mot_nome && h.ras_mot_nome !== 'PADRAO' ? h.ras_mot_nome : null,
  battery_voltage: h.ras_eve_voltagem || null,
  temperature: h.sensor_temperatura || null,
});

export const fleetService = {
  // Busca todos veículos e posição atual juntos
  getVehiclesWithPosition: async () => {
    // Busca cadastro dos veículos
    const vehiclesResp = await api.get('/vehicles/all');
    if (!vehiclesResp.data?.status) throw new Error(vehiclesResp.data?.message || 'Erro ao buscar veículos');
    const vehicles = vehiclesResp.data.data;

    // Busca última posição de todos os veículos (events/all retorna a última posição)
    const eventsResp = await api.get('/events/all');
    const positions = eventsResp.data?.data || [];

    // Combina veículo com sua última posição pelo ras_vei_id
    return vehicles.map(v => {
      const pos = positions.find(p => p.ras_vei_id === v.ras_vei_id);
      return mapVehicle(v, pos);
    });
  },

  // Busca histórico de eventos do veículo usando unix timestamps
  getVehicleHistory: async (vehicleId, startUnix = null, endUnix = null) => {
    const now = Math.floor(Date.now() / 1000);
    const end = endUnix || now;
    const begin = startUnix || now - (24 * 60 * 60);

    try {
      const response = await api.get(`/events/telemetry/id/${vehicleId}/begin/${begin}/end/${end}`);
      if (response.data?.status && Array.isArray(response.data?.data)) {
        return response.data.data.map(mapEvent);
      }
    } catch (e) {
      console.warn('Telemetry endpoint failed, trying alternative:', e.message);
    }

    return [];
  }
};

export default api;
