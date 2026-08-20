/**
 * Stable boundary between the operations UI and its source of truth.
 *
 * The current demo uses the simulation adapter. A production adapter should
 * implement this contract for API/WebSocket-backed data without changing the
 * command-center components.
 */
export type DataMode = 'simulation' | 'live' | 'delayed' | 'offline';

export interface DataFreshness {
  mode: DataMode;
  source: string;
  asOf: string;
  receivedAt?: string;
  lagSeconds?: number;
}

export interface OperationsSnapshot<TSnapshot> {
  snapshot: TSnapshot;
  freshness: DataFreshness;
}

export interface OperationsReadModel<TSnapshot, TKpis> extends OperationsSnapshot<TSnapshot> {
  kpis: TKpis;
}

export interface OperationsDataSource<TSnapshot, TKpis = unknown> {
  readonly mode: DataMode;
  getSnapshot(signal?: AbortSignal): Promise<OperationsReadModel<TSnapshot, TKpis>>;
  refresh(signal?: AbortSignal): Promise<OperationsReadModel<TSnapshot, TKpis>>;
}

export function createOperationsApiDataSource<TSnapshot, TKpis>(
  endpoint: string,
  mode: DataMode = 'live',
): OperationsDataSource<TSnapshot, TKpis> {
  const read = async (signal?: AbortSignal): Promise<OperationsReadModel<TSnapshot, TKpis>> => {
    const response = await fetch(endpoint, {
      method: 'GET',
      cache: 'no-store',
      signal,
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) {
      throw new Error(`Operations snapshot request failed (${response.status})`);
    }

    const payload: unknown = await response.json();
    if (!isOperationsReadModel<TSnapshot, TKpis>(payload)) {
      throw new Error('Operations snapshot response failed contract validation');
    }

    return payload;
  };

  return {
    mode,
    getSnapshot: read,
    refresh: read,
  };
}

function isOperationsReadModel<TSnapshot, TKpis>(value: unknown): value is OperationsReadModel<TSnapshot, TKpis> {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  const freshness = candidate.freshness;
  return Boolean(candidate.snapshot && candidate.kpis && freshness && typeof freshness === 'object');
}

export function simulationFreshness(asOf = new Date().toISOString()): DataFreshness {
  return {
    mode: 'simulation',
    source: 'deterministic mock generator',
    asOf,
  };
}
