import { describe, it, expect } from 'vitest';
import { createMockTelematicsAdapter, resolveTelematicsProvider } from '@/lib/platform/telematics';

describe('telematics seam', () => {
  it('mock adapter resolves vehicles and deterministic telemetry', async () => {
    const adapter = createMockTelematicsAdapter(['Car 1', 'Car 2']);
    expect(adapter.isLive).toBe(false);
    const vehicles = await adapter.listVehicles();
    expect(vehicles).toHaveLength(2);
    const a = await adapter.getVehicleTelemetry(vehicles[0].id, new Date('2026-08-22T10:00:00'));
    const b = await adapter.getVehicleTelemetry(vehicles[0].id, new Date('2026-08-22T10:00:00'));
    // Deterministic: same input → same ping (testable UI contract).
    expect(a).toEqual(b);
    expect(a.speedKmh).toBeGreaterThanOrEqual(0);
    expect(a.odometerKm).toBeGreaterThan(0);
  });

  it('driver day stats stay within sane bounds', async () => {
    const adapter = resolveTelematicsProvider(['Car 1']);
    const stats = await adapter.getDriverDayStats('mock-driver-1', '2026-08-22');
    expect(stats.distanceKm).toBeGreaterThanOrEqual(120);
    expect(stats.drivingMinutes).toBeGreaterThanOrEqual(stats.idleMinutes / 2);
  });

  it('factory falls back to the demo simulator when no vendor is configured', () => {
    const adapter = resolveTelematicsProvider();
    expect(adapter.id).toBe('mock');
    expect(adapter.label).toContain('simulator');
  });
});
