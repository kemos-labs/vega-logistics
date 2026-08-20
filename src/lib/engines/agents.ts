// VEGA Logistics OS — AI Agent Coordinator
// Multi-agent system: vision, nlp, routing, maintenance, carbon, twin — orchestrated.
// Each agent is a small specialist that can call other agents and share state.

import {
  AIAgent,
  AgentCapability,
  AgentTask,
  AgentCoordinationEvent,
} from '../types2026';

function rng(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

export const AGENT_DEFINITIONS: { id: string; name: string; role: string; capabilities: AgentCapability[]; description: string }[] = [
  {
    id: 'agent_vision',
    name: 'Vega-Vision',
    role: 'Computer Vision Specialist',
    capabilities: ['vision'],
    description: 'Reads dashcam + warehouse camera feeds. Detects damage, lane violations, plate OCR (EN/AR).',
  },
  {
    id: 'agent_nlp',
    name: 'Vega-Lingua',
    role: 'Document Intelligence Specialist',
    capabilities: ['nlp'],
    description: 'Bilingual (EN/AR) document extraction. Validates ZATCA invoices, customs, BOL.',
  },
  {
    id: 'agent_route',
    name: 'Vega-Pathfinder',
    role: 'RL Route Optimizer',
    capabilities: ['routing'],
    description: 'Q-learning dispatch policy. Reassigns, reroutes, swaps vehicles in real time.',
  },
  {
    id: 'agent_maint',
    name: 'Vega-Mechanic',
    role: 'Predictive Maintenance',
    capabilities: ['maintenance'],
    description: 'Telemetry-based RUL prediction. Schedules work before failure.',
  },
  {
    id: 'agent_carbon',
    name: 'Vega-Green',
    role: 'Sustainability Officer',
    capabilities: ['carbon'],
    description: 'Tracks Scope 1/2/3 emissions, suggests offsets, monitors Saudi Net-Zero 2060 progress.',
  },
  {
    id: 'agent_twin',
    name: 'Vega-Double',
    role: 'Digital Twin Simulator',
    capabilities: ['twin'],
    description: 'Runs what-if scenarios against the live fleet/warehouse model.',
  },
  {
    id: 'agent_oracle',
    name: 'Vega-Oracle',
    role: 'Strategic Orchestrator',
    capabilities: ['analytics', 'vision', 'nlp', 'routing', 'maintenance', 'carbon', 'twin'],
    description: 'Cross-domain coordinator. Receives signals from all specialists and arbitrates.',
  },
];

export function generateAgents(seed: number = Date.now()): AIAgent[] {
  const r = rng(seed);
  return AGENT_DEFINITIONS.map((def) => ({
    id: def.id,
    name: def.name,
    role: def.role,
    status: r() > 0.85 ? 'learning' : r() > 0.1 ? 'active' : 'idle',
    capabilities: def.capabilities,
    tasksCompleted: Math.floor(r() * 1000 + 50),
    averageLatencyMs: Math.floor(r() * 250 + 50),
    accuracy: Math.round((0.85 + r() * 0.13) * 1000) / 1000,
    lastActive: new Date(Date.now() - Math.floor(r() * 3600 * 1000)).toISOString(),
    description: def.description,
  }));
}

export function generateAgentTasks(count: number = 30, seed: number = Date.now()): AgentTask[] {
  const r = rng(seed);
  const tasks: AgentTask[] = [];
  const now = Date.now();
  const types = [
    'invoice_extract', 'plate_ocr', 'damage_assess', 'reroute',
    'maintenance_alert', 'emission_audit', 'twin_scenario', 'cross_domain_query',
  ];

  for (let i = 0; i < count; i++) {
    const agent = AGENT_DEFINITIONS[Math.floor(r() * AGENT_DEFINITIONS.length)];
    const status = r() > 0.85 ? 'failed' : r() > 0.7 ? 'complete' : r() > 0.4 ? 'running' : 'queued';
    const started = now - Math.floor(r() * 3600 * 1000);
    const completed = status === 'complete' || status === 'failed' ? started + Math.floor(r() * 3000) : undefined;
    tasks.push({
      id: `task_${i}`,
      agentId: agent.id,
      type: types[Math.floor(r() * types.length)],
      input: { sample: true, batch: Math.floor(r() * 100) },
      output: status === 'complete' ? { result: 'ok' } : undefined,
      status,
      startedAt: new Date(started).toISOString(),
      completedAt: completed ? new Date(completed).toISOString() : undefined,
      latencyMs: completed ? completed - started : undefined,
      error: status === 'failed' ? 'Transient upstream timeout' : undefined,
    });
  }
  return tasks.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}

export function generateCoordinationEvents(count: number = 20, seed: number = Date.now()): AgentCoordinationEvent[] {
  const r = rng(seed);
  const out: AgentCoordinationEvent[] = [];
  const now = Date.now();
  const eventTypes = [
    'damage_alert', 'invoice_validated', 'route_optimized', 'maintenance_scheduled',
    'emission_threshold_breach', 'twin_whatif', 'cross_domain_consensus',
  ];

  for (let i = 0; i < count; i++) {
    const src = AGENT_DEFINITIONS[Math.floor(r() * AGENT_DEFINITIONS.length)].id;
    const tgt = r() > 0.4 ? AGENT_DEFINITIONS[Math.floor(r() * AGENT_DEFINITIONS.length)].id : undefined;
    out.push({
      id: `evt_${i}`,
      timestamp: new Date(now - i * 60000 - Math.floor(r() * 30000)).toISOString(),
      sourceAgent: src,
      targetAgent: tgt,
      eventType: eventTypes[Math.floor(r() * eventTypes.length)],
      payload: { sample: true, severity: r() > 0.7 ? 'high' : 'normal' },
      consensus: r() > 0.15,
    });
  }
  return out;
}

export interface AgentFleetOverview {
  agents: AIAgent[];
  tasks: AgentTask[];
  events: AgentCoordinationEvent[];
  metrics: {
    totalTasks: number;
    successRate: number;
    avgLatency: number;
    consensusRate: number;
    activeAgents: number;
  };
}

export function generateAgentOverview(seed: number = Date.now()): AgentFleetOverview {
  const agents = generateAgents(seed);
  const tasks = generateAgentTasks(30, seed + 1);
  const events = generateCoordinationEvents(20, seed + 2);

  const completed = tasks.filter((t) => t.status === 'complete').length;
  const failed = tasks.filter((t) => t.status === 'failed').length;
  const finished = completed + failed;
  const successRate = finished > 0 ? completed / finished : 1;
  const latencies = tasks.filter((t) => t.latencyMs !== undefined).map((t) => t.latencyMs!);
  const avgLatency = latencies.length ? Math.round(latencies.reduce((s, n) => s + n, 0) / latencies.length) : 0;
  const consensusRate = events.length ? events.filter((e) => e.consensus).length / events.length : 1;

  return {
    agents,
    tasks,
    events,
    metrics: {
      totalTasks: tasks.length,
      successRate: Math.round(successRate * 1000) / 1000,
      avgLatency,
      consensusRate: Math.round(consensusRate * 1000) / 1000,
      activeAgents: agents.filter((a) => a.status === 'active').length,
    },
  };
}
