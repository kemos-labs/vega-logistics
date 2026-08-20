import type { FleetKPIs } from '@/lib/engines/kpi50';
import type { FleetSnapshot } from '@/lib/engines/mockData50';
import type { DataFreshness, DataMode } from './data-source';

export interface ApiErrorResponse {
  error: string;
  message: string;
  requestId?: string;
}

export interface OperationsSnapshotResponse {
  dataMode: DataMode;
  freshness: DataFreshness;
  snapshot: FleetSnapshot;
  kpis: FleetKPIs;
}
