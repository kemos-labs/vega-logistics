'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { VehicleLocation, ZoneDensity } from '@/lib/types';
import { Navigation, Gauge, Package, Fuel } from 'lucide-react';

// Dynamically import map to avoid SSR issues
const MapContainer = dynamic(
  () => import('react-leaflet').then((m) => m.MapContainer),
  { ssr: false }
);
const TileLayer = dynamic(
  () => import('react-leaflet').then((m) => m.TileLayer),
  { ssr: false }
);
const Popup = dynamic(
  () => import('react-leaflet').then((m) => m.Popup),
  { ssr: false }
);
const CircleMarker = dynamic(
  () => import('react-leaflet').then((m) => m.CircleMarker),
  { ssr: false }
);

interface FleetMapProps {
  vehicles: VehicleLocation[];
  zones: ZoneDensity[];
}

const statusColors: Record<string, string> = {
  active: '#22c55e',
  idle: '#eab308',
  maintenance: '#71717a',
  returning: '#3b82f6',
};

const densityColors: Record<string, string> = {
  high: '#22c55e',
  medium: '#eab308',
  low: '#f97316',
  dead: '#ef4444',
};

const densityOpacity: Record<string, number> = {
  high: 0.25,
  medium: 0.2,
  low: 0.15,
  dead: 0.08,
};

function VehiclePopup({ v }: { v: VehicleLocation }) {
  return (
    <div className="text-xs p-1 min-w-[160px]" style={{ color: '#e4e4e7' }}>
      <div className="font-bold text-sm mb-1">{v.id}</div>
      <div className="text-[#a1a1aa]">{v.driverName}</div>
      <div className="text-[#71717a]">{v.plate}</div>
      <hr className="my-1.5 border-[#2a2a33]" />
      <div className="grid grid-cols-2 gap-x-3 gap-y-1">
        <span className="text-[#71717a]">Status:</span>
        <span style={{ color: statusColors[v.status] }} className="capitalize font-medium">
          {v.status}
        </span>
        <span className="text-[#71717a]">Speed:</span>
        <span>{v.speed} km/h</span>
        <span className="text-[#71717a]">Deliveries:</span>
        <span>{v.deliveriesCompleted}/{v.deliveriesTotal}</span>
        <span className="text-[#71717a]">Fuel:</span>
        <span>{v.fuelLevel}%</span>
        <span className="text-[#71717a]">ETA:</span>
        <span>{v.eta}</span>
        <span className="text-[#71717a]">Zone:</span>
        <span>{v.zone}</span>
        <span className="text-[#71717a]">Profit:</span>
        <span className="text-emerald-400">SAR {v.profitability.toLocaleString()}</span>
      </div>
    </div>
  );
}

export default function FleetMap({ vehicles, zones }: FleetMapProps) {
  const [selectedVehicle, setSelectedVehicle] = useState<VehicleLocation | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Browser-only Leaflet mount guard.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="bg-[#18181c] border border-[#2a2a33] rounded-lg h-[500px] flex items-center justify-center">
        <span className="text-[#52525b] text-sm">Loading map...</span>
      </div>
    );
  }

  const riyadhCenter: [number, number] = [24.7136, 46.6753];


  return (
    <div className="bg-[#18181c] border border-[#2a2a33] rounded-lg overflow-hidden">
      {/* Map Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#2a2a33]">
        <div className="flex items-center gap-3">
          <Navigation className="w-4 h-4 text-[#3b82f6]" />
          <h3 className="text-sm font-semibold text-[#e4e4e7] uppercase tracking-wider">
            Fleet Operations — Riyadh
          </h3>
        </div>
        <div className="flex items-center gap-3 text-[10px] text-[#71717a]">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-[#22c55e]" /> Active
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-[#eab308]" /> Idle
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-[#3b82f6]" /> Returning
          </span>
        </div>
      </div>

      <div className="flex">
        {/* Map */}
        <div className="flex-1 h-[420px]">
          <MapContainer
            center={riyadhCenter}
            zoom={12}
            className="h-full w-full"
            zoomControl={true}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            />

            {/* Zone density circles */}
            {zones.map((zone) => (
              <CircleMarker
                key={zone.id}
                center={[zone.lat, zone.lng]}
                radius={Math.min(zone.shipmentCount * 15, 800)}
                pathOptions={{
                  color: densityColors[zone.density],
                  fillColor: densityColors[zone.density],
                  fillOpacity: densityOpacity[zone.density],
                  weight: 1,
                }}
              >
                <Popup>
                  <div className="text-xs" style={{ color: '#e4e4e7' }}>
                    <div className="font-bold text-sm mb-1">{zone.name}</div>
                    <div>
                      Shipments: <span className="font-mono-data">{zone.shipmentCount}</span>
                    </div>
                    <div>
                      Density: <span className="capitalize" style={{ color: densityColors[zone.density] }}>{zone.density}</span>
                    </div>
                    <div>Avg Revenue: SAR {zone.avgRevenue.toLocaleString()}</div>
                    <div>Failed Rate: {zone.failedRate}%</div>
                  </div>
                </Popup>
              </CircleMarker>
            ))}

            {/* Vehicle markers */}
            {vehicles.map((v) => (
              <CircleMarker
                key={v.id}
                center={[v.lat, v.lng]}
                radius={6}
                pathOptions={{
                  color: statusColors[v.status],
                  fillColor: statusColors[v.status],
                  fillOpacity: 0.8,
                  weight: 2,
                }}
                eventHandlers={{
                  click: () => setSelectedVehicle(v),
                }}
              >
                <Popup>
                  <VehiclePopup v={v} />
                </Popup>
              </CircleMarker>
            ))}
          </MapContainer>
        </div>

        {/* Vehicle Detail Panel */}
        <div className="w-72 border-l border-[#2a2a33] p-3 overflow-y-auto max-h-[420px]">
          {selectedVehicle ? (
            <div className="space-y-3 animate-fade-in-up">
              <div className="flex items-center justify-between">
                <div className="font-mono-data text-sm font-bold text-[#e4e4e7]">
                  {selectedVehicle.id}
                </div>
                <div
                  className="text-[10px] px-2 py-0.5 rounded-full font-medium capitalize"
                  style={{
                    color: statusColors[selectedVehicle.status],
                    backgroundColor: `${statusColors[selectedVehicle.status]}15`,
                  }}
                >
                  {selectedVehicle.status}
                </div>
              </div>

              <div className="text-xs text-[#a1a1aa]">{selectedVehicle.driverName}</div>
              <div className="text-[10px] text-[#52525b]">{selectedVehicle.plate} · {selectedVehicle.zone}</div>

              <div className="grid grid-cols-2 gap-2">
                <StatBox icon={Gauge} label="Speed" value={`${selectedVehicle.speed} km/h`} />
                <StatBox icon={Package} label="Deliveries" value={`${selectedVehicle.deliveriesCompleted}/${selectedVehicle.deliveriesTotal}`} />
                <StatBox icon={Fuel} label="Fuel" value={`${selectedVehicle.fuelLevel}%`} />
                <StatBox icon={Navigation} label="ETA" value={selectedVehicle.eta} />
              </div>

              <div className="bg-[#0a0a0b] rounded p-2">
                <div className="text-[10px] text-[#52525b] mb-1">Monthly Profitability</div>
                <div className="font-mono-data text-lg font-bold text-emerald-400">
                  SAR {selectedVehicle.profitability.toLocaleString()}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-[#52525b] text-xs">
              Click a vehicle to view details
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const StatBox = ({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) => {
  return (
    <div className="bg-[#0a0a0b] rounded p-2">
      <div className="flex items-center gap-1 text-[10px] text-[#52525b] mb-0.5">
        <Icon className="w-3 h-3" />
        {label}
      </div>
      <div className="text-xs font-mono-data text-[#e4e4e7]">{value}</div>
    </div>
  );
}
