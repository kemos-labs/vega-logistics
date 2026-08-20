'use client';

import { useState, useMemo } from 'react';
import {
  CheckCircle, TrendingUp, Users, Zap, BarChart3,
  ArrowRight, Calendar, DollarSign, Target, Shield,
} from 'lucide-react';

interface RecommendationItem {
  id: string;
  category: 'partnership' | 'technology' | 'financial' | 'operational';
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  effort: 'high' | 'medium' | 'low';
  timeline: string;
  expectedBenefit: string;
  icon: React.ReactNode;
  completed: boolean;
}

interface FeasibilityRecommendationsProps {
  monthlyProfit: number;
  margin: number;
  paybackMonths: number;
  riskLevel: string;
}

export default function FeasibilityRecommendations({
  monthlyProfit,
  
  paybackMonths,
  riskLevel,
}: FeasibilityRecommendationsProps) {
  const [completedItems, setCompletedItems] = useState<Set<string>>(new Set());

  const recommendations: RecommendationItem[] = useMemo(
    () => [
      {
        id: 'partnership-ecommerce',
        category: 'partnership',
        title: 'Establish E-Commerce Platform Partnerships',
        description:
          'Secure partnerships with Noon, Amazon, and local e-commerce platforms for guaranteed delivery volume. Lock in minimum monthly deliveries at premium rates.',
        impact: 'high',
        effort: 'medium',
        timeline: '1-2 months',
        expectedBenefit: `+${Math.round(monthlyProfit * 0.25)}/month from guaranteed volume · Reduces demand risk by 40%`,
        icon: <Users className="w-5 h-5" />,
        completed: completedItems.has('partnership-ecommerce'),
      },
      {
        id: 'partnership-logistics-network',
        category: 'partnership',
        title: 'Join Regional Logistics Network',
        description:
          'Partner with established logistics networks (SMSA, DHL, Aramex) for load-sharing and back-haul optimization. Reduce idle capacity and increase utilization.',
        impact: 'high',
        effort: 'medium',
        timeline: '2-3 months',
        expectedBenefit: `+${Math.round(monthlyProfit * 0.15)}/month · Utilization up to 95%+`,
        icon: <TrendingUp className="w-5 h-5" />,
        completed: completedItems.has('partnership-logistics-network'),
      },
      {
        id: 'tech-real-time-tracking',
        category: 'technology',
        title: 'Implement Real-Time Tracking & Route Optimization',
        description:
          'Deploy GPS tracking, IoT sensors, and AI-powered route optimization (e.g., Google Maps API, Optimo, or custom ML). Reduce fuel consumption by 8-12% and improve delivery speed.',
        impact: 'high',
        effort: 'high',
        timeline: '2-4 months',
        expectedBenefit: `−${Math.round(monthlyProfit * 0.08)}/month fuel savings · +15% delivery speed`,
        icon: <Zap className="w-5 h-5" />,
        completed: completedItems.has('tech-real-time-tracking'),
      },
      {
        id: 'tech-predictive-maintenance',
        category: 'technology',
        title: 'Predictive Maintenance System',
        description:
          'Use IoT sensors and predictive analytics to forecast vehicle maintenance needs. Reduce unexpected breakdowns by 60% and maintenance costs by 20%.',
        impact: 'medium',
        effort: 'medium',
        timeline: '1-2 months',
        expectedBenefit: `−${Math.round(monthlyProfit * 0.03)}/month maintenance savings · 99.5% fleet uptime`,
        icon: <Shield className="w-5 h-5" />,
        completed: completedItems.has('tech-predictive-maintenance'),
      },
      {
        id: 'financial-reserve',
        category: 'financial',
        title: 'Establish 6-Month Operating Expense Reserve',
        description:
          'Build and maintain a cash reserve equal to 6 months of operating expenses (SAR ${Math.round((monthlyProfit * 0.5) * 6)}K). Protects against demand shocks and market volatility.',
        impact: 'high',
        effort: 'low',
        timeline: 'Ongoing',
        expectedBenefit: 'Business continuity · Investor confidence · Risk mitigation',
        icon: <DollarSign className="w-5 h-5" />,
        completed: completedItems.has('financial-reserve'),
      },
      {
        id: 'financial-dynamic-pricing',
        category: 'financial',
        title: 'Implement Dynamic Pricing Strategy',
        description:
          'Use demand-based and time-of-day pricing. Premium rates during peak hours (9-11 AM, 4-6 PM) and off-peak discounts. Increase average revenue per delivery by 8-12%.',
        impact: 'medium',
        effort: 'low',
        timeline: '1 month',
        expectedBenefit: `+${Math.round(monthlyProfit * 0.1)}/month from pricing optimization`,
        icon: <BarChart3 className="w-5 h-5" />,
        completed: completedItems.has('financial-dynamic-pricing'),
      },
      {
        id: 'operational-driver-retention',
        category: 'operational',
        title: 'Driver Retention & Training Program',
        description:
          'Offer competitive salaries (SAR 3,500–4,200/month), performance bonuses, and professional development. Reduce turnover from 35% to <10% annually.',
        impact: 'high',
        effort: 'medium',
        timeline: 'Immediate',
        expectedBenefit: '−30% recruitment costs · +20% delivery quality · Reduced training overhead',
        icon: <Users className="w-5 h-5" />,
        completed: completedItems.has('operational-driver-retention'),
      },
      {
        id: 'operational-zone-optimization',
        category: 'operational',
        title: 'Zone-Based Operations & Micro-Fulfillment',
        description:
          'Divide Riyadh into 5-6 delivery zones with dedicated teams. Establish micro-fulfillment centers in high-density areas. Increase deliveries per van by 15-20%.',
        impact: 'high',
        effort: 'high',
        timeline: '3-4 months',
        expectedBenefit: `+${Math.round(monthlyProfit * 0.18)}/month · Delivery speed +25%`,
        icon: <Target className="w-5 h-5" />,
        completed: completedItems.has('operational-zone-optimization'),
      },
      {
        id: 'operational-compliance',
        category: 'operational',
        title: 'Regulatory Compliance & TGA Registration',
        description:
          'Ensure full compliance with Saudi TGA (General Authority for Civil Aviation) regulations. Maintain proper licensing, insurance, and safety certifications.',
        impact: 'medium',
        effort: 'low',
        timeline: '1 month',
        expectedBenefit: 'Legal protection · Access to premium contracts · Reduced liability',
        icon: <Shield className="w-5 h-5" />,
        completed: completedItems.has('operational-compliance'),
      },
    ],
    [monthlyProfit, completedItems]
  );

  const toggleCompletion = (id: string) => {
    const newSet = new Set(completedItems);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setCompletedItems(newSet);
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'partnership':
        return '#3b82f6';
      case 'technology':
        return '#8b5cf6';
      case 'financial':
        return '#22c55e';
      case 'operational':
        return '#f97316';
      default:
        return '#e4e4e7';
    }
  };

  const getCategoryLabel = (category: string) => {
    switch (category) {
      case 'partnership':
        return 'Partnership';
      case 'technology':
        return 'Technology';
      case 'financial':
        return 'Financial';
      case 'operational':
        return 'Operational';
      default:
        return category;
    }
  };

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case 'high':
        return '#ef4444';
      case 'medium':
        return '#f97316';
      case 'low':
        return '#eab308';
      default:
        return '#e4e4e7';
    }
  };

  const getEffortColor = (effort: string) => {
    switch (effort) {
      case 'high':
        return '#ef4444';
      case 'medium':
        return '#f97316';
      case 'low':
        return '#22c55e';
      default:
        return '#e4e4e7';
    }
  };

  const completionRate = (completedItems.size / recommendations.length) * 100;

  return (
    <div className="space-y-4">
      {/* ─── HEADER & PROGRESS ────────────────────────────────────────────── */}
      <div className="bg-[#18181c] border border-[#2a2a33] rounded-lg p-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-[#e4e4e7] flex items-center gap-2 mb-1">
              <Target className="w-5 h-5 text-[#3b82f6]" />
              Feasibility Recommendations & Action Plan
            </h2>
            <p className="text-xs text-[#71717a]">
              Strategic initiatives to improve profitability, reduce risk, and scale operations
            </p>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-[#a1a1aa]">Implementation Progress</span>
            <span className="text-xs font-mono-data text-[#3b82f6] font-bold">
              {completedItems.size} / {recommendations.length} ({completionRate.toFixed(0)}%)
            </span>
          </div>
          <div className="h-2 bg-[#0a0a0b] rounded-full overflow-hidden border border-[#2a2a33]">
            <div
              className="h-full bg-gradient-to-r from-[#3b82f6] to-[#22c55e] transition-all duration-500"
              style={{ width: `${completionRate}%` }}
            />
          </div>
        </div>
      </div>

      {/* ─── RECOMMENDATIONS GRID ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {recommendations.map((rec) => (
          <div
            key={rec.id}
            className={`bg-[#18181c] border border-[#2a2a33] rounded-lg p-4 transition-all cursor-pointer hover:border-[#3d3d4a] ${
              rec.completed ? 'opacity-75' : ''
            }`}
            onClick={() => toggleCompletion(rec.id)}
          >
            {/* Header */}
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-start gap-3 flex-1">
                <div
                  className="p-2 rounded-lg mt-0.5"
                  style={{ backgroundColor: `${getCategoryColor(rec.category)}20` }}
                >
                  {rec.icon}
                </div>
                <div className="flex-1">
                  <h3 className={`text-sm font-semibold mb-1 ${rec.completed ? 'line-through text-[#71717a]' : 'text-[#e4e4e7]'}`}>
                    {rec.title}
                  </h3>
                  <div className="flex items-center gap-2 mb-2">
                    <span
                      className="text-[10px] font-bold uppercase px-2 py-0.5 rounded"
                      style={{
                        backgroundColor: `${getCategoryColor(rec.category)}20`,
                        color: getCategoryColor(rec.category),
                      }}
                    >
                      {getCategoryLabel(rec.category)}
                    </span>
                  </div>
                </div>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleCompletion(rec.id);
                }}
                className="flex-shrink-0"
              >
                {rec.completed ? (
                  <CheckCircle className="w-5 h-5 text-[#22c55e]" />
                ) : (
                  <div className="w-5 h-5 border-2 border-[#2a2a33] rounded-full" />
                )}
              </button>
            </div>

            {/* Description */}
            <p className="text-xs text-[#a1a1aa] mb-3">{rec.description}</p>

            {/* Metrics */}
            <div className="grid grid-cols-3 gap-2 mb-3 text-[10px]">
              <div className="bg-[#0a0a0b] rounded p-2 text-center">
                <div className="text-[#71717a] mb-0.5">Impact</div>
                <div
                  className="font-bold"
                  style={{ color: getImpactColor(rec.impact) }}
                >
                  {rec.impact.charAt(0).toUpperCase() + rec.impact.slice(1)}
                </div>
              </div>
              <div className="bg-[#0a0a0b] rounded p-2 text-center">
                <div className="text-[#71717a] mb-0.5">Effort</div>
                <div
                  className="font-bold"
                  style={{ color: getEffortColor(rec.effort) }}
                >
                  {rec.effort.charAt(0).toUpperCase() + rec.effort.slice(1)}
                </div>
              </div>
              <div className="bg-[#0a0a0b] rounded p-2 text-center">
                <div className="text-[#71717a] mb-0.5">Timeline</div>
                <div className="font-bold text-[#3b82f6]">{rec.timeline}</div>
              </div>
            </div>

            {/* Benefit */}
            <div className="bg-[#0a0a0b] rounded p-3 border-l-2" style={{ borderLeftColor: getCategoryColor(rec.category) }}>
              <div className="text-[10px] text-[#71717a] mb-1 flex items-center gap-1">
                <ArrowRight className="w-3 h-3" />
                Expected Benefit
              </div>
              <div className="text-xs text-[#22c55e] font-semibold">{rec.expectedBenefit}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ─── IMPLEMENTATION ROADMAP ───────────────────────────────────────── */}
      <div className="bg-[#18181c] border border-[#2a2a33] rounded-lg p-4">
        <h3 className="text-xs font-semibold text-[#e4e4e7] uppercase tracking-wider mb-4 flex items-center gap-2">
          <Calendar className="w-4 h-4 text-[#3b82f6]" />
          Implementation Roadmap
        </h3>

        <div className="space-y-3">
          {/* Phase 1: Immediate (0-1 month) */}
          <div className="bg-[#0a0a0b] rounded p-3 border-l-4" style={{ borderLeftColor: '#ef4444' }}>
            <div className="text-xs font-semibold text-[#e4e4e7] mb-2">Phase 1: Immediate (0–1 month)</div>
            <ul className="text-[10px] text-[#a1a1aa] space-y-1">
              <li>✓ Establish 6-month operating reserve</li>
              <li>✓ Launch driver retention program</li>
              <li>✓ Implement dynamic pricing strategy</li>
              <li>✓ Ensure TGA compliance & licensing</li>
            </ul>
          </div>

          {/* Phase 2: Short-term (1-3 months) */}
          <div className="bg-[#0a0a0b] rounded p-3 border-l-4" style={{ borderLeftColor: '#f97316' }}>
            <div className="text-xs font-semibold text-[#e4e4e7] mb-2">Phase 2: Short-term (1–3 months)</div>
            <ul className="text-[10px] text-[#a1a1aa] space-y-1">
              <li>✓ Secure e-commerce platform partnerships (Noon, Amazon)</li>
              <li>✓ Join regional logistics network</li>
              <li>✓ Deploy predictive maintenance system</li>
              <li>✓ Begin zone-based operations planning</li>
            </ul>
          </div>

          {/* Phase 3: Medium-term (3-6 months) */}
          <div className="bg-[#0a0a0b] rounded p-3 border-l-4" style={{ borderLeftColor: '#eab308' }}>
            <div className="text-xs font-semibold text-[#e4e4e7] mb-2">Phase 3: Medium-term (3–6 months)</div>
            <ul className="text-[10px] text-[#a1a1aa] space-y-1">
              <li>✓ Implement real-time tracking & route optimization</li>
              <li>✓ Establish micro-fulfillment centers</li>
              <li>✓ Launch zone-based operations (5-6 zones)</li>
              <li>✓ Expand fleet to 8-10 vans (based on demand)</li>
            </ul>
          </div>

          {/* Phase 4: Long-term (6+ months) */}
          <div className="bg-[#0a0a0b] rounded p-3 border-l-4" style={{ borderLeftColor: '#22c55e' }}>
            <div className="text-xs font-semibold text-[#e4e4e7] mb-2">Phase 4: Long-term (6+ months)</div>
            <ul className="text-[10px] text-[#a1a1aa] space-y-1">
              <li>✓ Scale to 15+ vans across multiple cities</li>
              <li>✓ Integrate AI-powered demand forecasting</li>
              <li>✓ Explore B2B partnerships & white-label services</li>
              <li>✓ Consider acquisition or IPO pathway</li>
            </ul>
          </div>
        </div>
      </div>

      {/* ─── RISK MITIGATION SUMMARY ──────────────────────────────────────── */}
      <div className="bg-[#18181c] border border-[#2a2a33] rounded-lg p-4">
        <h3 className="text-xs font-semibold text-[#e4e4e7] uppercase tracking-wider mb-3 flex items-center gap-2">
          <Shield className="w-4 h-4 text-[#3b82f6]" />
          Risk Mitigation Summary
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="bg-[#0a0a0b] rounded p-3">
            <div className="text-[10px] text-[#71717a] mb-2">Current Risk Level</div>
            <div
              className="text-lg font-bold uppercase"
              style={{
                color:
                  riskLevel === 'critical'
                    ? '#ef4444'
                    : riskLevel === 'high'
                      ? '#f97316'
                      : riskLevel === 'medium'
                        ? '#eab308'
                        : '#22c55e',
              }}
            >
              {riskLevel}
            </div>
          </div>
          <div className="bg-[#0a0a0b] rounded p-3">
            <div className="text-[10px] text-[#71717a] mb-2">Payback Period</div>
            <div className="text-lg font-bold text-[#3b82f6]">
              {paybackMonths.toFixed(1)} months
            </div>
          </div>
          <div className="bg-[#0a0a0b] rounded p-3">
            <div className="text-[10px] text-[#71717a] mb-2">Projected Risk Reduction</div>
            <div className="text-lg font-bold text-[#22c55e]">−60% after Phase 2</div>
          </div>
        </div>
      </div>
    </div>
  );
}
