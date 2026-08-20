import { describe, expect, it } from 'vitest';
import { hasPermission, requirePermission, requireTenant } from '../authorization';

const context = { userId: 'u-1', tenantId: 'tenant-a', role: 'dispatcher' as const };

describe('authorization policy', () => {
  it('allows dispatchers to create and assign work', () => {
    expect(hasPermission('dispatcher', 'dispatch.create')).toBe(true);
    expect(hasPermission('dispatcher', 'dispatch.assign')).toBe(true);
  });

  it('does not grant administrative permissions to operational roles', () => {
    expect(hasPermission('dispatcher', 'users.manage')).toBe(false);
    expect(hasPermission('driver', 'fleet.manage')).toBe(false);
  });

  it('throws on denied permissions and cross-tenant access', () => {
    expect(() => requirePermission(context, 'users.manage')).toThrow('Forbidden');
    expect(() => requireTenant(context, 'tenant-b')).toThrow('tenant boundary');
  });

  it('accepts an authorized permission and matching tenant', () => {
    expect(() => requirePermission(context, 'dispatch.create')).not.toThrow();
    expect(() => requireTenant(context, 'tenant-a')).not.toThrow();
  });
});
