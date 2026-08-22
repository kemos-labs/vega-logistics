import { createMockTelematicsAdapter } from './mock';
import type { TelematicsAdapter } from './types';

export type { DriverDayStats, TelematicsAdapter, VehicleTelemetry } from './types';
export { createMockTelematicsAdapter } from './mock';

/**
 * Resolve the active telematics provider. Vendor adapters (Samsara/Geotab)
 * register here when credentials exist; until then the deterministic demo
 * simulator answers so the UI has a stable contract.
 *
 * Env contract for future live adapters:
 *   NEXT_PUBLIC_TELEMATICS=samsara|geotab
 *   TELEMATICS_API_TOKEN=...        (server-only)
 */
export function resolveTelematicsProvider(vehicleNames: string[] = []): TelematicsAdapter {
  const vendor = process.env.NEXT_PUBLIC_TELEMATICS;
  // Live vendor branches land here; each returns its own adapter or falls
  // through to the mock when unconfigured/unauthenticated.
  void vendor;
  return createMockTelematicsAdapter(vehicleNames.length > 0 ? vehicleNames : ['Car 1', 'Car 2']);
}
