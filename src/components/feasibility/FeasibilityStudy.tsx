'use client';

import { useMemo } from 'react';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { useTranslation } from 'react-i18next';
import {
  calculateFeasibility,
  FeasibilityInput,
  DEFAULT_FEASIBILITY_INPUT,
} from '@/lib/feasibilityEngine';
import { exportToExcel, exportToPDF } from '@/lib/exportUtils';
import {
  CheckCircle,
  Download,
  FileText,
  BarChart3,
  Shield,
} from 'lucide-react';

interface EditableRowProps {
  label: string;
  value: number;
  onChange: (v: number) => void;
  unit: string;
  step?: number;
}

function EditableRow({ label, value, onChange, unit, step = 1 }: EditableRowProps) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-[#2a2a33]/40 last:border-0">
      <span className="text-[11px] text-[#a1a1aa]">{label}</span>
      <div className="flex items-center gap-2">
        <input
          type="number"
          value={value}
          onChange={(e) => {
              const val = parseFloat(e.target.value);
              if (!isNaN(val) && val >= 0 && val < 100000000) {
                onChange(val);
              }
            }}
          step={step}
          className="w-24 bg-[#0a0a0b] border border-[#2a2a33] rounded px-2 py-1 text-xs font-mono-data text-[#e4e4e7] text-right focus:border-[#3b82f6] focus:outline-none"
        />
        <span className="text-[10px] text-[#52525b] w-16">{unit}</span>
      </div>
    </div>
  );
}

export default function FeasibilityStudy() {
  const { t } = useTranslation();
  const [input, setInput] = useLocalStorage<FeasibilityInput>('vega-feasibility-study-v1', DEFAULT_FEASIBILITY_INPUT);

  const feasibility = useMemo(() => calculateFeasibility(input), [input]);

  const updateInput = (key: keyof FeasibilityInput) => (val: number) => {
    if (isNaN(val) || val < 0 || val > 100000000) return;
    // Apply field-specific limits
    const clamped = (() => {
      switch (key) {
        case 'initialFleetSize': return Math.min(Math.max(1, Math.round(val)), 1000);
        case 'deliveriesPerVanPerDay': return Math.min(Math.max(1, Math.round(val)), 500);
        case 'workingDaysPerMonth': return Math.min(Math.max(1, Math.round(val)), 31);
        case 'projectionMonths': return Math.min(Math.max(1, Math.round(val)), 120);
        case 'targetMargin': return Math.min(Math.max(0, val), 100);
        default: return val;
      }
    })();
    setInput((prev) => ({ ...prev, [key]: clamped }));
  };

  const handleExportPDF = async () => {
    try {
      await exportToPDF('feasibility-report', {
        filename: 'feasibility-study.pdf',
        title: 'Levered Beta Logistics - Feasibility Study',
      });
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

  const handleExportExcel = () => {
    try {
      const data = feasibility.cashFlowProjection.map((cf) => ({
        Month: cf.month,
        Revenue: Math.round(cf.revenue),
        Costs: Math.round(cf.costs),
        Profit: Math.round(cf.profit),
        'Cumulative Cash': Math.round(cf.cumulativeCash),
      }));
      exportToExcel(data, { filename: 'feasibility-study.xlsx' });
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'low':
        return '#22c55e';
      case 'medium':
        return '#eab308';
      case 'high':
        return '#f97316';
      case 'critical':
        return '#ef4444';
      default:
        return '#e4e4e7';
    }
  };

  return (
    <div className="p-4 overflow-y-auto flex-1 max-w-6xl mx-auto space-y-4" id="feasibility-report">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-lg font-semibold text-[#e4e4e7] flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-[#3b82f6]" />
            {t('feasibility.title')}
          </h2>
          <p className="text-xs text-[#71717a] mt-0.5">{t('feasibility.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportPDF}
            className="flex items-center gap-2 px-3 py-1.5 bg-[#3b82f6] text-white rounded text-xs font-medium hover:bg-[#2563eb] transition-all"
          >
            <FileText className="w-3.5 h-3.5" />
            {t('buttons.exportPDF')}
          </button>
          <button
            onClick={handleExportExcel}
            className="flex items-center gap-2 px-3 py-1.5 bg-[#22c55e] text-white rounded text-xs font-medium hover:bg-[#16a34a] transition-all"
          >
            <Download className="w-3.5 h-3.5" />
            {t('buttons.exportExcel')}
          </button>
        </div>
      </div>

      {/* Input Parameters */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-[#18181c] border border-[#2a2a33] rounded-lg p-4">
          <h3 className="text-xs font-semibold text-[#e4e4e7] uppercase tracking-wider mb-3">
            Startup Parameters
          </h3>
          <EditableRow
            label="Initial Fleet Size"
            value={input.initialFleetSize}
            onChange={updateInput('initialFleetSize')}
            unit="vans"
          />
          <EditableRow
            label="Van Purchase Price"
            value={input.vanPurchasePrice}
            onChange={updateInput('vanPurchasePrice')}
            unit="SAR"
            step={1000}
          />
          <EditableRow
            label="Monthly Fixed Costs"
            value={input.monthlyFixedCosts}
            onChange={updateInput('monthlyFixedCosts')}
            unit="SAR"
            step={500}
          />
          <EditableRow
            label="Monthly Variable Cost/Van"
            value={input.monthlyVariableCostPerVan}
            onChange={updateInput('monthlyVariableCostPerVan')}
            unit="SAR"
            step={100}
          />
          <EditableRow
            label="Revenue Per Delivery"
            value={input.revenuePerDelivery}
            onChange={updateInput('revenuePerDelivery')}
            unit="SAR"
            step={0.5}
          />
          <EditableRow
            label="Deliveries/Van/Day"
            value={input.deliveriesPerVanPerDay}
            onChange={updateInput('deliveriesPerVanPerDay')}
            unit="deliveries"
            step={1}
          />
        </div>

        <div className="bg-[#18181c] border border-[#2a2a33] rounded-lg p-4">
          <h3 className="text-xs font-semibold text-[#e4e4e7] uppercase tracking-wider mb-3">
            More Parameters
          </h3>
          <EditableRow
            label="Working Days/Month"
            value={input.workingDaysPerMonth}
            onChange={updateInput('workingDaysPerMonth')}
            unit="days"
            step={1}
          />
          <EditableRow
            label="Projection Months"
            value={input.projectionMonths}
            onChange={updateInput('projectionMonths')}
            unit="months"
            step={1}
          />
          <EditableRow
            label="Startup Capital"
            value={input.startupCapital}
            onChange={updateInput('startupCapital')}
            unit="SAR"
            step={10000}
          />
          <EditableRow
            label="Target Margin"
            value={input.targetMargin}
            onChange={updateInput('targetMargin')}
            unit="%"
            step={1}
          />
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-4 gap-3">
        <div className="bg-[#18181c] border border-[#2a2a33] rounded-lg p-3">
          <div className="text-[10px] text-[#71717a] uppercase tracking-wider mb-1">
            {t('feasibility.breakEvenMonths')}
          </div>
          <div className="font-mono-data text-lg font-bold text-[#3b82f6]">
            {feasibility.breakEvenMonths === 0 ? 'Immediate' : `${feasibility.breakEvenMonths} mo`}
          </div>
          <div className="text-[10px] text-[#52525b] mt-1">Time to profitability</div>
        </div>

        <div className="bg-[#18181c] border border-[#2a2a33] rounded-lg p-3">
          <div className="text-[10px] text-[#71717a] uppercase tracking-wider mb-1">
            {t('feasibility.paybackPeriod')}
          </div>
          <div className="font-mono-data text-lg font-bold text-[#22c55e]">
            {feasibility.paybackPeriod === Infinity ? '∞' : `${feasibility.paybackPeriod.toFixed(1)} mo`}
          </div>
          <div className="text-[10px] text-[#52525b] mt-1">Investment recovery</div>
        </div>

        <div className="bg-[#18181c] border border-[#2a2a33] rounded-lg p-3">
          <div className="text-[10px] text-[#71717a] uppercase tracking-wider mb-1">
            {t('feasibility.profitabilityScore')}
          </div>
          <div
            className="font-mono-data text-lg font-bold"
            style={{ color: getRiskColor(feasibility.riskLevel) }}
          >
            {feasibility.profitabilityScore.toFixed(0)}/100
          </div>
          <div className="text-[10px] text-[#52525b] mt-1">Overall viability</div>
        </div>

        <div className="bg-[#18181c] border border-[#2a2a33] rounded-lg p-3">
          <div className="text-[10px] text-[#71717a] uppercase tracking-wider mb-1">
            {t('feasibility.riskLevel')}
          </div>
          <div
            className="font-mono-data text-lg font-bold uppercase"
            style={{ color: getRiskColor(feasibility.riskLevel) }}
          >
            {feasibility.riskLevel}
          </div>
          <div className="text-[10px] text-[#52525b] mt-1">Risk assessment</div>
        </div>
      </div>

      {/* Financial Projection */}
      <div className="bg-[#18181c] border border-[#2a2a33] rounded-lg p-4">
        <h3 className="text-xs font-semibold text-[#e4e4e7] uppercase tracking-wider mb-3">
          {t('feasibility.financialProjection')} - Monthly Breakdown
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-[10px]">
            <thead>
              <tr className="border-b border-[#2a2a33]">
                <th className="text-left py-2 px-2 text-[#71717a]">Month</th>
                <th className="text-right py-2 px-2 text-[#71717a]">Revenue</th>
                <th className="text-right py-2 px-2 text-[#71717a]">Costs</th>
                <th className="text-right py-2 px-2 text-[#71717a]">Profit</th>
                <th className="text-right py-2 px-2 text-[#71717a]">Cumulative</th>
              </tr>
            </thead>
            <tbody>
              {feasibility.cashFlowProjection.slice(0, 12).map((cf) => (
                <tr key={cf.month} className="border-b border-[#2a2a33]/40 hover:bg-[#0a0a0b]">
                  <td className="py-2 px-2 text-[#a1a1aa]">M{cf.month}</td>
                  <td className="text-right py-2 px-2 font-mono-data text-[#22c55e]">
                    SAR {(cf.revenue / 1000).toFixed(1)}K
                  </td>
                  <td className="text-right py-2 px-2 font-mono-data text-[#f97316]">
                    SAR {(cf.costs / 1000).toFixed(1)}K
                  </td>
                  <td
                    className="text-right py-2 px-2 font-mono-data"
                    style={{ color: cf.profit >= 0 ? '#22c55e' : '#ef4444' }}
                  >
                    SAR {(cf.profit / 1000).toFixed(1)}K
                  </td>
                  <td
                    className="text-right py-2 px-2 font-mono-data font-bold"
                    style={{ color: cf.cumulativeCash >= 0 ? '#3b82f6' : '#ef4444' }}
                  >
                    SAR {(cf.cumulativeCash / 1000).toFixed(1)}K
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Risk Assessment */}
      <div className="bg-[#18181c] border border-[#2a2a33] rounded-lg p-4">
        <h3 className="text-xs font-semibold text-[#e4e4e7] uppercase tracking-wider mb-3 flex items-center gap-2">
          <Shield className="w-4 h-4" />
          {t('feasibility.riskAssessment')}
        </h3>
        <div className="space-y-2">
          {feasibility.riskFactors.map((risk, i) => (
            <div
              key={i}
              className="bg-[#0a0a0b] rounded p-3 border border-[#2a2a33]/40"
              style={{
                borderLeftColor: getRiskColor(risk.severity),
                borderLeftWidth: '3px',
              }}
            >
              <div className="flex items-start justify-between mb-1">
                <span className="text-xs font-semibold text-[#e4e4e7]">{risk.name}</span>
                <span
                  className="text-[10px] font-bold uppercase px-2 py-0.5 rounded"
                  style={{
                    backgroundColor: `${getRiskColor(risk.severity)}20`,
                    color: getRiskColor(risk.severity),
                  }}
                >
                  {risk.severity}
                </span>
              </div>
              <div className="text-[10px] text-[#a1a1aa] mb-1">
                Probability: {(risk.probability * 100).toFixed(0)}% | Impact: {(risk.impact * 100).toFixed(0)}%
              </div>
              <div className="text-[10px] text-[#71717a]">
                <strong>Mitigation:</strong> {risk.mitigation}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recommendations */}
      <div className="bg-[#18181c] border border-[#2a2a33] rounded-lg p-4">
        <h3 className="text-xs font-semibold text-[#e4e4e7] uppercase tracking-wider mb-3 flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-[#22c55e]" />
          {t('feasibility.recommendations')}
        </h3>
        <ul className="space-y-2">
          {feasibility.recommendations.map((rec, i) => (
            <li key={i} className="flex items-start gap-2 text-[11px] text-[#a1a1aa]">
              <span className="text-[#3b82f6] font-bold mt-0.5">→</span>
              <span>{rec}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Capital Requirements */}
      <div className="bg-[#18181c] border border-[#2a2a33] rounded-lg p-4">
        <h3 className="text-xs font-semibold text-[#e4e4e7] uppercase tracking-wider mb-3">
          Capital Requirements
        </h3>
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-[#0a0a0b] rounded p-3 text-center">
            <div className="text-[10px] text-[#71717a] mb-1">Base Capital</div>
            <div className="font-mono-data text-lg font-bold text-[#3b82f6]">
              SAR {(feasibility.startupCapitalRequired / 1000).toFixed(0)}K
            </div>
          </div>
          <div className="bg-[#0a0a0b] rounded p-3 text-center">
            <div className="text-[10px] text-[#71717a] mb-1">Safety Buffer (20%)</div>
            <div className="font-mono-data text-lg font-bold text-[#f97316]">
              SAR {(feasibility.bufferCapital / 1000).toFixed(0)}K
            </div>
          </div>
          <div className="bg-[#0a0a0b] rounded p-3 text-center">
            <div className="text-[10px] text-[#71717a] mb-1">Total Required</div>
            <div className="font-mono-data text-lg font-bold text-[#22c55e]">
              SAR {((feasibility.startupCapitalRequired + feasibility.bufferCapital) / 1000).toFixed(0)}K
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
