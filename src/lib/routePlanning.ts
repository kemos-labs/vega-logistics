// Deterministic, review-first geographic clustering. This proposes a split;
// it never writes assignments or treats district names as coordinates.

import { isValidCoordinatePair, type StopRecord } from '@/lib/stops';

export interface GeographicDriver {
  id: string;
  fullName: string;
  vehicle: string;
  carNumber?: string;
  plateNumber?: string;
}

export interface GeographicClusterSuggestion {
  driver: GeographicDriver;
  stopIds: string[];
}

export interface GeographicPlanSuggestion {
  clusters: GeographicClusterSuggestion[];
  missingCoordinateStopIds: string[];
  rationale: 'two-coordinate-clusters' | 'not-enough-drivers' | 'not-enough-coordinates';
}

function distance(a: StopRecord, b: { lat: number; lng: number }): number {
  const lat = (a.lat as number) - b.lat;
  const lng = (a.lng as number) - b.lng;
  return lat * lat + lng * lng;
}

/**
 * Propose two geographically compact driver groups using deterministic
 * 2-means. Seeds are the west-most and east-most valid stops; ties use id.
 * Stops without coordinates stay outside the proposal for explicit review.
 */
export function suggestGeographicDriverPlan(stops: StopRecord[], drivers: GeographicDriver[]): GeographicPlanSuggestion {
  const selected = drivers.slice(0, 2);
  const valid = stops.filter(stop => stop.lat !== undefined && stop.lng !== undefined && isValidCoordinatePair(stop.lat, stop.lng));
  const missingCoordinateStopIds = stops.filter(stop => !valid.includes(stop)).map(stop => stop.id);
  if (selected.length < 2) return { clusters: [], missingCoordinateStopIds, rationale: 'not-enough-drivers' };
  if (valid.length < 2) return { clusters: selected.map(driver => ({ driver, stopIds: [] })), missingCoordinateStopIds, rationale: 'not-enough-coordinates' };
  const sorted = [...valid].sort((a, b) => (a.lng as number) - (b.lng as number) || a.id.localeCompare(b.id));
  let centroids = [
    { lat: sorted[0].lat as number, lng: sorted[0].lng as number },
    { lat: sorted[sorted.length - 1].lat as number, lng: sorted[sorted.length - 1].lng as number },
  ];
  let assignments = new Map<string, number>();
  for (let iteration = 0; iteration < 12; iteration += 1) {
    assignments = new Map(valid.map(stop => {
      const first = distance(stop, centroids[0]);
      const second = distance(stop, centroids[1]);
      return [stop.id, first <= second ? 0 : 1];
    }));
    centroids = [0, 1].map(cluster => {
      const group = valid.filter(stop => assignments.get(stop.id) === cluster);
      return group.length === 0 ? centroids[cluster] : {
        lat: group.reduce((sum, stop) => sum + (stop.lat as number), 0) / group.length,
        lng: group.reduce((sum, stop) => sum + (stop.lng as number), 0) / group.length,
      };
    });
  }
  return {
    clusters: selected.map((driver, index) => ({ driver, stopIds: valid.filter(stop => assignments.get(stop.id) === index).map(stop => stop.id) })),
    missingCoordinateStopIds,
    rationale: 'two-coordinate-clusters',
  };
}
