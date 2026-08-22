/**
 * Telematics provider seam — step toward real vehicle data (Samsara, Geotab,
 * or any GPS API). The app never imports a vendor SDK directly; everything
 * goes through this interface so adapters are swappable and testable.
 *
 * Integration spine position (docs/logistics-deep-research.md):
 *   dispatch/driver app ↔ telematics → POD
 */

export interface VehicleTelemetry {
  vehicleId: string;
  /** ISO timestamp of the last GPS ping. */
  at: string;
  lat: number;
  lng: number;
  speedKmh: number;
  headingDeg: number;
  odometerKm: number;
  fuelLitres?: number;
}

export interface DriverDayStats {
  driverId: string;
  date: string;
  distanceKm: number;
  drivingMinutes: number;
  idleMinutes: number;
  harshBrakingEvents: number;
  speedingEvents: number;
}

export interface TelematicsAdapter {
  readonly id: string;
  readonly label: string;
  readonly isLive: boolean;
  listVehicles(): Promise<Array<{ id: string; name: string }>>;
  getVehicleTelemetry(vehicleId: string, at?: Date): Promise<VehicleTelemetry>;
  getDriverDayStats(driverId: string, date: string): Promise<DriverDayStats>;
}
