import React from 'react';
import { Gauge, MapPin, Wifi, WifiOff, Fuel, Battery, User } from 'lucide-react';

const VehicleCard = ({ vehicle, active, onClick }) => {
  const isOnline = vehicle.ignition === '1';

  return (
    <div
      className={`card ${active ? 'active' : ''}`}
      onClick={onClick}
      style={{ marginBottom: '0.75rem' }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3 className="vehicle-plate">{vehicle.plate || 'Sem Placa'}</h3>
          <p className="vehicle-info" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {vehicle.model} {vehicle.year ? `• ${vehicle.year}` : ''} {vehicle.color ? `• ${vehicle.color}` : ''}
          </p>
        </div>
        <span className={`status-badge ${isOnline ? 'status-online' : 'status-offline'}`} style={{ marginLeft: '0.5rem', flexShrink: 0 }}>
          {isOnline ? <Wifi size={10} style={{ marginRight: '3px' }} /> : <WifiOff size={10} style={{ marginRight: '3px' }} />}
          {isOnline ? 'Ligado' : 'Desligado'}
        </span>
      </div>

      <div style={{ marginTop: '0.75rem', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
          <Gauge size={13} color={vehicle.speed > 0 ? 'var(--primary)' : 'var(--text-muted)'} />
          <span style={{ color: vehicle.speed > 0 ? 'var(--text-main)' : 'var(--text-muted)', fontWeight: vehicle.speed > 0 ? '600' : '400' }}>
            {vehicle.speed} km/h
          </span>
        </div>
        {vehicle.fuel && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
            <Fuel size={13} color="var(--warning)" />
            <span style={{ color: 'var(--text-main)', fontSize: '0.7rem' }}>{vehicle.fuel}L</span>
          </div>
        )}
        {vehicle.battery_voltage && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
            <Battery size={13} color="var(--success)" />
            <span style={{ color: 'var(--text-main)', fontSize: '0.7rem' }}>{vehicle.battery_voltage}V</span>
          </div>
        )}
        {vehicle.driver && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
            <User size={13} color="var(--primary)" />
            <span style={{ color: 'var(--text-main)', fontSize: '0.7rem' }}>{vehicle.driver}</span>
          </div>
        )}
        {vehicle.lat && vehicle.lng && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
            <MapPin size={13} color="var(--success)" />
            <span style={{ color: 'var(--success)', fontSize: '0.7rem' }}>GPS OK</span>
          </div>
        )}
      </div>

      <div style={{
        marginTop: '0.5rem',
        fontSize: '0.7rem',
        color: 'var(--text-muted)',
        borderTop: '1px solid var(--border)',
        paddingTop: '0.5rem',
        display: 'flex',
        justifyContent: 'space-between'
      }}>
        <span>Últ. update: {vehicle.last_update || '-'}</span>
        {vehicle.satellites && <span>📡 {vehicle.satellites} sat.</span>}
      </div>
    </div>
  );
};

export default VehicleCard;
