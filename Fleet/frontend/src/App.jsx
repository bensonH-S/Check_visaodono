import React, { useState, useEffect } from 'react';
import { Search, RefreshCw, Car, History, ChevronRight, Wifi, WifiOff, Gauge, Navigation } from 'lucide-react';
import Flatpickr from 'react-flatpickr';
import { Portuguese } from 'flatpickr/dist/l10n/pt.js';
import 'flatpickr/dist/themes/dark.css';
import VehicleCard from './components/VehicleCard';
import Map from './components/Map';
import { fleetService } from './services/api';

function App() {
  const [vehicles, setVehicles] = useState([]);
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState(null);

  // Date range for history (defaults to last 24h)
  const [startDate, setStartDate] = useState(
    new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 16)
  );
  const [endDate, setEndDate] = useState(
    new Date().toISOString().slice(0, 16)
  );

  const fetchVehicles = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fleetService.getVehiclesWithPosition();
      setVehicles(data);
      // Mantém o veículo selecionado atualizado se já havia um
      if (selectedVehicle) {
        const updated = data.find(v => v.id === selectedVehicle.id);
        if (updated) setSelectedVehicle(updated);
      }
    } catch (err) {
      setError('Falha ao conectar com a API Fulltrack. Verifique as credenciais.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchHistory = async (vehicleId, start = startDate, end = endDate) => {
    if (!vehicleId) return;
    setHistoryLoading(true);
    setHistory([]);
    try {
      const startUnix = Math.floor(new Date(start).getTime() / 1000);
      const endUnix = Math.floor(new Date(end).getTime() / 1000);
      const data = await fleetService.getVehicleHistory(vehicleId, startUnix, endUnix);
      setHistory(data);
    } catch (err) {
      console.error('Erro ao buscar histórico:', err);
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    fetchVehicles();
    // Auto-refresh a cada 60 segundos
    const interval = setInterval(fetchVehicles, 60000);
    return () => clearInterval(interval);
  }, []);

  const handleVehicleSelect = (vehicle) => {
    setSelectedVehicle(vehicle);
    fetchHistory(vehicle.id);
  };

  const filteredVehicles = vehicles.filter(v =>
    (v.plate || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (v.model || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const onlineCount = vehicles.filter(v => v.ignition === '1').length;

  return (
    <div className="dashboard-container">
      <aside className="sidebar">
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
          <div style={{ backgroundColor: 'var(--primary)', padding: '0.5rem', borderRadius: '8px', display: 'flex' }}>
            <Car size={22} color="white" />
          </div>
          <div>
            <h1 style={{ fontSize: '1.1rem', fontWeight: '800', lineHeight: 1 }}>FleetTrack</h1>
            <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Monitoramento em tempo real</p>
          </div>
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '1.25rem' }}>
          <div style={{ backgroundColor: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: '8px', padding: '0.5rem', textAlign: 'center' }}>
            <div style={{ fontSize: '1.25rem', fontWeight: '800', color: 'var(--success)' }}>{onlineCount}</div>
            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Ligados</div>
          </div>
          <div style={{ backgroundColor: 'rgba(100,116,139,0.1)', border: '1px solid var(--border)', borderRadius: '8px', padding: '0.5rem', textAlign: 'center' }}>
            <div style={{ fontSize: '1.25rem', fontWeight: '800', color: 'var(--text-main)' }}>{vehicles.length}</div>
            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total</div>
          </div>
        </div>

        {/* Search */}
        <div style={{ position: 'relative', marginBottom: '1rem' }}>
          <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="Buscar por placa ou modelo..."
            style={{
              width: '100%',
              backgroundColor: 'var(--bg-main)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              padding: '0.6rem 0.75rem 0.6rem 2.25rem',
              color: 'var(--text-main)',
              outline: 'none',
              fontSize: '0.875rem'
            }}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* List header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Veículos ({filteredVehicles.length})
          </span>
          <button
            onClick={fetchVehicles}
            style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem' }}
          >
            <RefreshCw size={13} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
            Atualizar
          </button>
        </div>

        {/* Error state */}
        {error && (
          <div style={{ backgroundColor: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', padding: '0.75rem', marginBottom: '1rem', fontSize: '0.8rem', color: 'var(--danger)' }}>
            ⚠️ {error}
          </div>
        )}

        {/* Loading state */}
        {loading && (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            <RefreshCw size={24} style={{ animation: 'spin 1s linear infinite', marginBottom: '0.5rem' }} />
            <p>Carregando veículos...</p>
          </div>
        )}

        {/* Vehicle list */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {!loading && filteredVehicles.map(vehicle => (
            <VehicleCard
              key={vehicle.id}
              vehicle={vehicle}
              active={selectedVehicle?.id === vehicle.id}
              onClick={() => handleVehicleSelect(vehicle)}
            />
          ))}
        </div>
      </aside>

      <main className="main-content">
        {/* Map section */}
        <section className="map-section">
          <Map vehicles={filteredVehicles.filter(v => v.lat && v.lng)} selectedVehicle={selectedVehicle} history={history} />
        </section>

        {/* History section */}
        <section className="history-section">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
            <div className="section-title" style={{ margin: 0 }}>
              <History size={18} color="var(--primary)" />
              <span>
                {selectedVehicle
                  ? `Histórico — ${selectedVehicle.plate} (${selectedVehicle.model})`
                  : 'Histórico de Atividades'}
              </span>
            </div>
            
            {selectedVehicle && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <Flatpickr
                  value={[startDate, endDate]}
                  options={{
                    mode: 'range',
                    dateFormat: 'd/m/Y',
                    locale: Portuguese,
                    enableTime: false,
                  }}
                  onChange={(dates) => {
                    if (dates.length === 2) {
                      setStartDate(dates[0]);
                      setEndDate(dates[1]);
                    }
                  }}
                  className="flatpickr-input"
                  style={{ backgroundColor: 'var(--bg-card)', color: 'var(--text-main)', border: '1px solid var(--border)', borderRadius: '4px', padding: '0.5rem 0.75rem', fontSize: '0.8rem', minWidth: '220px' }}
                  placeholder="Selecione o período..."
                />
                <button 
                  onClick={() => fetchHistory(selectedVehicle.id)}
                  style={{ backgroundColor: 'var(--primary)', color: 'white', border: 'none', borderRadius: '4px', padding: '0.5rem 1rem', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold' }}
                >
                  Filtrar
                </button>
              </div>
            )}

            {selectedVehicle && historyLoading && (
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <RefreshCw size={12} style={{ animation: 'spin 1s linear infinite' }} /> Carregando...
              </span>
            )}
          </div>

          {!selectedVehicle ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '120px', color: 'var(--text-muted)' }}>
              <ChevronRight size={36} style={{ opacity: 0.2, marginBottom: '0.5rem' }} />
              <p style={{ fontSize: '0.875rem' }}>Selecione um veículo na lista para ver o histórico</p>
            </div>
          ) : !historyLoading && history.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
              Nenhum evento encontrado no período selecionado.
            </div>
          ) : (
            <table className="history-table">
              <thead>
                <tr>
                  <th>Data / Hora</th>
                  <th>Ignição</th>
                  <th>Velocidade</th>
                  <th>Bateria</th>
                  <th>Temp.</th>
                  <th>Combustível</th>
                  <th>Motorista</th>
                  <th>Hodômetro</th>
                  <th>Latitude</th>
                  <th>Longitude</th>
                </tr>
              </thead>
              <tbody>
                {history.map((item) => (
                  <tr key={item.id}>
                    <td>{item.time}</td>
                    <td>
                      <span className={`status-badge ${item.ignition === 'Ligado' ? 'status-online' : 'status-offline'}`}>
                        {item.ignition}
                      </span>
                    </td>
                    <td>{item.speed} km/h</td>
                    <td>{item.battery_voltage ? `${item.battery_voltage}V` : '-'}</td>
                    <td>{item.temperature ? `${item.temperature}°C` : '-'}</td>
                    <td>{item.fuel ? `${item.fuel}L` : '-'}</td>
                    <td>{item.driver || '-'}</td>
                    <td>{item.odometer} m</td>
                    <td style={{ fontSize: '0.75rem' }}>{item.lat?.toFixed(6)}</td>
                    <td style={{ fontSize: '0.75rem' }}>{item.lng?.toFixed(6)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </main>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

export default App;
