import { describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from './route';

describe('GET /api/v1/operations/snapshot', () => {
  it('returns a typed simulation read model for a valid seed', async () => {
    const response = await GET(new NextRequest('http://localhost/api/v1/operations/snapshot?seed=42'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(body.dataMode).toBe('simulation');
    expect(body.freshness.source).toBe('deterministic mock generator');
    expect(body.snapshot.vehicles.length).toBeGreaterThan(0);
    expect(body.kpis.fleetSize).toBe(body.snapshot.vehicles.length);
  });

  it('rejects invalid seeds without generating a snapshot', async () => {
    const response = await GET(new NextRequest('http://localhost/api/v1/operations/snapshot?seed=not-a-number'));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({
      error: 'invalid_seed',
      message: 'seed must be an integer from 0 to 999999',
    });
  });
});
