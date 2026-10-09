import { migrateMaintenanceState, validateMaintenanceState, type MaintenanceState } from '@/lib/vehicleMaintenance';
import { getSupabaseClient, type SupabaseQueryClient } from './db/client';

/** Explicit opt-in seam. Callers use authenticated ownership; no UI activation. */
export class SupabaseMaintenanceRepository {
  constructor(private readonly client: SupabaseQueryClient, private readonly userId: string) {
    if (!userId.trim()) throw new Error('Maintenance repository requires an authenticated owner');
  }

  static async create(): Promise<SupabaseMaintenanceRepository | null> {
    const client = await getSupabaseClient();
    if (!client) return null;
    const { data, error } = await client.auth.getSession();
    if (error) throw new Error(`Maintenance session error: ${error.message}`);
    const userId = data?.session?.user.id;
    return userId ? new SupabaseMaintenanceRepository(client, userId) : null;
  }

  async load(): Promise<MaintenanceState | null> {
    const { data, error } = await this.client.from('maintenance_state').select('data').eq('user_id', this.userId);
    if (error) throw new Error(`Maintenance repository error: ${error.message}`);
    if (!Array.isArray(data)) throw new Error('Invalid maintenance response');
    if (data.length === 0) return null;
    if (data.length !== 1 || !data[0] || typeof data[0] !== 'object') throw new Error('Invalid maintenance response');
    const state = migrateMaintenanceState(data[0].data);
    if (!state) throw new Error('Invalid maintenance state');
    return state;
  }

  async save(state: MaintenanceState): Promise<void> {
    if (!validateMaintenanceState(state)) throw new Error('Invalid maintenance state');
    const { error } = await this.client.from('maintenance_state').upsert({ user_id: this.userId, data: structuredClone(state), updated_at: new Date().toISOString() });
    if (error) throw new Error(`Maintenance repository error: ${error.message}`);
  }
}
