import type { DriverDayStats, TelematicsAdapter, VehicleTelemetry } from './types';

/** Deterministic simulated adapter — the default when no vendor is
 *  configured. Same shape as a live adapter, so UI built against this keeps
 *  working the day real telematics plugs in. */
export function createMockTelematicsAdapter(vehicleNames: string[] = ['Car 1', 'Car 2']): TelematicsAdapter {
  const vehicles = vehicleNames.map((name, index) => ({ id: `mock-veh-${index + 1}`, name }));
  return {
    id: 'mock',
    label: 'Demo simulator',
    isLive: false,
    async listVehicles() {
      return vehicles;
    },
    async getVehicleTelemetry(vehicleId: string, at = new Date()): Promise<VehicleTelemetry> {
      const seed = [...vehicleId].reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
      const pseudo = (offset: number) => ((seed * 9301 + offset * 49297) % 233280) / 233280;
      return {
        vehicleId,
        at: at.toISOString(),
        // Riyadh-ish bounding box, deterministic jitter per vehicle.
        lat: 24.6 + pseudo(1) * 0.25,
        lng: 46.6 + pseudo(2) * 0.3,
        speedKmh: Math.round(pseudo(3) * 90),
        headingDeg: Math.round(pseudo(4) * 360),
        odometerKm: Math.round(10_000 + pseudo(5) * 5_000),
        fuelLitres: Number((pseudo(6) * 40).toFixed(1)),
      };
    },
    async getDriverDayStats(driverId: string, date: string): Promise<DriverDayStats> {
      const seed = [...(driverId + date)].reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
      const pseudo = (offset: number) => ((seed * 9301 + offset * 49297) % 233280) / 233280;
      return {
        driverId,
        date,
        distanceKm: Math.round(120 + pseudo(1) * 160),
        drivingMinutes: Math.round(300 + pseudo(2) * 180),
        idleMinutes: Math.round(30 + pseudo(3) * 60),
        harshBrakingEvents: Math.round(pseudo(4) * 6),
        speedingEvents: Math.round(pseudo(5) * 4),
      };
    },
  };
}
