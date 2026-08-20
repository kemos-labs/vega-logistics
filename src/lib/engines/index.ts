// VEGA Logistics OS — Engine Registry (2026)
// All engines are pure-function modules; the orchestrator wires them together.

import { generateCVSnapshot, type CVSnapshot } from './computerVision';
import {
  extractDocument,
  analyzeSentiment,
  ragAnswer,
  generateNLPOverview,
  type NLPOverview,
} from './nlp';
import {
  runAllScenarios,
  summarizeTwin,
} from './digitalTwin';
import { type TwinScenario } from '../types2026';
import {
  batchOptimize,
  generateTrainingStats,
  type RLBatchResult,
} from './rlRouteOptimizer';
import {
  generateFleetOverview,
  type FleetMaintenanceOverview,
} from './predictiveMaintenance';
import {
  generateCarbonOverview,
  type FleetEmissionsOverview,
} from './carbon';
import {
  generateAgentOverview,
  type AgentFleetOverview,
} from './agents';

export type { CVSnapshot, NLPOverview, TwinScenario, RLBatchResult, FleetMaintenanceOverview, FleetEmissionsOverview, AgentFleetOverview };

export interface EngineRegistry {
  computerVision: {
    snapshot: (vehicles: string[]) => CVSnapshot;
  };
  nlp: {
    overview: () => NLPOverview;
    extract: typeof extractDocument;
    sentiment: typeof analyzeSentiment;
    ask: typeof ragAnswer;
  };
  digitalTwin: {
    scenarios: () => TwinScenario[];
    summary: typeof summarizeTwin;
  };
  rlRoute: {
    batch: typeof batchOptimize;
    stats: typeof generateTrainingStats;
  };
  predictiveMaintenance: {
    overview: (vehicleIds: string[]) => FleetMaintenanceOverview;
  };
  carbon: {
    overview: (vehicleCount: number, warehouseCount: number, revenue: number, shipments: number) => FleetEmissionsOverview;
  };
  agents: {
    overview: () => AgentFleetOverview;
  };
}

export const engineRegistry: EngineRegistry = {
  computerVision: {
    snapshot: (vehicles) => generateCVSnapshot(vehicles),
  },
  nlp: {
    overview: () => generateNLPOverview(),
    extract: extractDocument,
    sentiment: analyzeSentiment,
    ask: ragAnswer,
  },
  digitalTwin: {
    scenarios: () => runAllScenarios(),
    summary: summarizeTwin,
  },
  rlRoute: {
    batch: batchOptimize,
    stats: generateTrainingStats,
  },
  predictiveMaintenance: {
    overview: (vehicleIds) => generateFleetOverview(vehicleIds),
  },
  carbon: {
    overview: (vehicleCount, warehouseCount, revenue, shipments) =>
      generateCarbonOverview(vehicleCount, warehouseCount, revenue, shipments),
  },
  agents: {
    overview: () => generateAgentOverview(),
  },
};

export const ENGINES_2026 = [
  { id: 'computerVision', name: 'Computer Vision', version: '2026.1.0' },
  { id: 'nlp', name: 'NLP & Document Intelligence', version: '2026.1.0' },
  { id: 'digitalTwin', name: 'Digital Twin Simulator', version: '2026.1.0' },
  { id: 'rlRoute', name: 'RL Route Optimizer', version: '2026.1.0' },
  { id: 'predictiveMaintenance', name: 'Predictive Maintenance', version: '2026.1.0' },
  { id: 'carbon', name: 'Carbon & Sustainability', version: '2026.1.0' },
  { id: 'agents', name: 'AI Agent Coordinator', version: '2026.1.0' },
] as const;
