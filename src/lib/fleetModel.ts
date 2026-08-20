import type { VehicleClass } from './types';

/** Resize the enabled fleet to an exact total while preserving its current mix. */
export function resizeVehicleFleet(rows: VehicleClass[], requestedTotal: number): VehicleClass[] {
  const target = Math.max(0, Math.round(requestedTotal));
  const enabled = rows.filter(row => row.enabled);
  if (!enabled.length) return rows;

  const currentTotal = enabled.reduce((sum, row) => sum + Math.max(0, row.quantity), 0);
  if (currentTotal === 0) {
    return rows.map((row, index) => row.enabled && index === rows.findIndex(item => item.enabled)
      ? { ...row, quantity: target }
      : row);
  }

  const allocations = enabled.map(row => {
    const exact = target * Math.max(0, row.quantity) / currentTotal;
    return { id: row.id, quantity: Math.floor(exact), fraction: exact - Math.floor(exact) };
  });
  let remainder = target - allocations.reduce((sum, item) => sum + item.quantity, 0);
  allocations.sort((a, b) => b.fraction - a.fraction);
  for (let index = 0; index < allocations.length && remainder > 0; index += 1, remainder -= 1) {
    allocations[index].quantity += 1;
  }
  const quantities = new Map(allocations.map(item => [item.id, item.quantity]));
  return rows.map(row => row.enabled ? { ...row, quantity: quantities.get(row.id) ?? 0 } : row);
}
