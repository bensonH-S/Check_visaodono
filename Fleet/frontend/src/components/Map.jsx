import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, LayersControl, Polyline } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix for default marker icons in Leaflet with Vite
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: markerIcon,
    shadowUrl: markerShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

function ChangeView({ center, zoom, bounds }) {
  const map = useMap();
  useEffect(() => {
    if (bounds && bounds.isValid()) {
      map.fitBounds(bounds, { padding: [50, 50] });
    } else if (center) {
      map.setView(center, zoom);
    }
  }, [center, zoom, bounds, map]);
  return null;
}

const Map = ({ vehicles, selectedVehicle, history = [] }) => {
  const defaultCenter = [-23.5505, -46.6333]; // São Paulo
  const center = selectedVehicle && selectedVehicle.lat ? [selectedVehicle.lat, selectedVehicle.lng] : defaultCenter;
  const zoom = selectedVehicle ? 15 : 5;

  // Extrair coordenadas da trajetória do histórico (ignorando lat/lng nulas)
  const trajectoryCoords = history
    .filter(item => item.lat && item.lng)
    .map(item => [item.lat, item.lng]);

  let bounds = null;
  if (trajectoryCoords.length > 0) {
    bounds = L.latLngBounds(trajectoryCoords);
  }

  return (
    <div className="map-container">
      <MapContainer center={center} zoom={zoom} style={{ height: '100%', width: '100%' }}>
        <LayersControl position="topright">
          <LayersControl.BaseLayer checked name="Mapa (Rua)">
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            />
          </LayersControl.BaseLayer>
          <LayersControl.BaseLayer name="Satélite">
            <TileLayer
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              attribution='Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EAP, and the GIS User Community'
            />
          </LayersControl.BaseLayer>
        </LayersControl>

        {vehicles.map((vehicle) => (
          <Marker 
            key={vehicle.id} 
            position={[vehicle.lat, vehicle.lng]}
          >
            <Popup>
              <div style={{ color: 'var(--text-main)' }}>
                <strong>{vehicle.plate}</strong><br />
                Velocidade: {vehicle.speed} km/h<br />
                Status: {vehicle.ignition === '1' ? 'Ligado' : 'Desligado'}
              </div>
            </Popup>
          </Marker>
        ))}

        {trajectoryCoords.length > 0 && (
          <Polyline 
            positions={trajectoryCoords} 
            color="var(--primary)" 
            weight={4} 
            opacity={0.7} 
          />
        )}

        {selectedVehicle && <ChangeView center={center} zoom={15} bounds={bounds} />}
      </MapContainer>
    </div>
  );
};

export default Map;

