import type { FleetRole } from '@/lib/types2026';

/**
 * Shared permission vocabulary for API handlers and UI affordances.
 * This is a policy definition, not authentication: callers must still derive
 * the user and tenant from a server-validated session.
 */
export type OperationsPermission =
  | 'operations.read'
  | 'dispatch.create'
  | 'dispatch.assign'
  | 'delivery.resolve'
  | 'fleet.manage'
  | 'maintenance.manage'
  | 'fuel.read'
  | 'reports.read'
  | 'users.manage';

const ALL_PERMISSIONS: readonly OperationsPermission[] = [
  'operations.read',
  'dispatch.create',
  'dispatch.assign',
  'delivery.resolve',
  'fleet.manage',
  'maintenance.manage',
  'fuel.read',
  'reports.read',
  'users.manage',
];

export const ROLE_PERMISSIONS: Readonly<Record<FleetRole, readonly OperationsPermission[]>> = {
  super_admin: ALL_PERMISSIONS,
  fleet_manager: ['operations.read', 'dispatch.create', 'dispatch.assign', 'delivery.resolve', 'fleet.manage', 'maintenance.manage', 'fuel.read', 'reports.read'],
  dispatcher: ['operations.read', 'dispatch.create', 'dispatch.assign', 'delivery.resolve', 'fuel.read', 'reports.read'],
  driver: ['operations.read', 'delivery.resolve'],
  warehouse_operator: ['operations.read', 'delivery.resolve', 'fuel.read'],
  maintenance_tech: ['operations.read', 'fleet.manage', 'maintenance.manage', 'fuel.read'],
  customer_support: ['operations.read', 'delivery.resolve', 'reports.read'],
  executive: ['operations.read', 'fuel.read', 'reports.read'],
};

export interface AuthorizationContext {
  userId: string;
  tenantId: string;
  role: FleetRole;
}

export function hasPermission(role: FleetRole, permission: OperationsPermission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

export function requirePermission(context: AuthorizationContext, permission: OperationsPermission): void {
  if (!hasPermission(context.role, permission)) {
    throw new Error(`Forbidden: ${permission}`);
  }
}

export function requireTenant(context: AuthorizationContext, tenantId: string): void {
  if (context.tenantId !== tenantId) {
    throw new Error('Forbidden: tenant boundary');
  }
}
