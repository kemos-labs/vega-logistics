'use client';

import { useState, useMemo } from 'react';
import { FinancialInput, FinancialOutput, KPIData } from '@/lib/types';
import { AdvancedKPIs } from '@/lib/advancedKPIs';
import { runFMEA, calculateVaR, calculateSCRS } from '@/lib/advancedRisk';
import {  Printer } from 'lucide-react';

// ─── Props ───

interface PDFReportProps {
  financialInput: FinancialInput;
  financialOutput: FinancialOutput;
  kpis: KPIData[];
  advancedKpis?: AdvancedKPIs;
}

// ─── Formatting ───


function formatCurrency(value: number): string {
  return `SAR ${value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

// ─── Component ───

export default function PDFReport({ financialInput, financialOutput, advancedKpis }: PDFReportProps) {
  const [isPrinting, setIsPrinting] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  // Compute risk data for report
  const fmeaData = useMemo(() => runFMEA(), []);
  const varData = useMemo(() => calculateVaR(financialOutput.totalRevenue, 15), [financialOutput.totalRevenue]);
  const scrsData = useMemo(() => calculateSCRS(), []);


  const handleExport = () => {
    setIsPrinting(true);
    setShowPreview(true);
    setTimeout(() => {
      window.print();
      setIsPrinting(false);
    }, 300);
  };

  return (
    <>
      {/* Print Preview Area */}
      {showPreview && (
        <div className="print-only print-container">
          <style>{`
            @media print {
              body * { visibility: hidden; }
              .print-container, .print-container * { visibility: visible; }
              .print-container { position: absolute; left: 0; top: 0; width: 100%; }
              .no-print { display: none !important; }
              @page { margin: 1.5cm 1cm; size: A4; }
            }
            @media screen {
              .print-only { display: none; }
            }
          `}</style>

          <div className="max-w-[210mm] mx-auto bg-white text-black p-8 font-sans text-sm leading-relaxed">

            {/* ── Header ── */}
            <div className="border-b-2 border-gray-800 pb-4 mb-6">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
                    VEGA Logistics OS
                  </h1>
                  <p className="text-base text-gray-600 font-medium mt-1">
                    Risk &amp; Cost Report
                  </p>
                </div>
                <div className="text-right text-gray-600 text-sm">
                  <p>{new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                  <p>Riyadh, Saudi Arabia</p>
                </div>
              </div>
            </div>

            {/* ── Executive Summary ── */}
            <div className="mb-6">
              <h2 className="text-lg font-bold text-gray-900 border-b border-gray-300 pb-1 mb-3">
                Executive Summary
              </h2>
              <p className="text-gray-700 text-sm leading-relaxed">
                VEGA Logistics OS operating analysis for a fleet of {financialInput.vehicleClasses.filter((c) => c.enabled).reduce((s, c) => s + c.quantity, 0)} vehicles
                processing {financialOutput.totalDailyShipments} daily shipments across Riyadh metro zones.
                Monthly revenue is {formatCurrency(financialOutput.totalRevenue)} with total costs of{' '}
                {formatCurrency(financialOutput.totalCost)}, yielding a net margin of{' '}
                {financialOutput.netMarginPercent.toFixed(1)}%. The cash runway stands at{' '}
                {financialOutput.cashRunway.toFixed(1)} months at current burn rate. Fleet utilization is{' '}
                {financialOutput.fleetUtilization.toFixed(0)}% with {financialInput.failedDeliveryRate.toFixed(1)}%
                failed deliveries. The SCRS Resilience Score is <strong>{scrsData.overallScore}/100</strong> ({scrsData.level}),
                indicating {scrsData.level === 'Strong' ? 'robust' : scrsData.level === 'Adequate' ? 'acceptable' : 'concerning'} supply chain resilience.
                {financialOutput.netMarginPercent < 15 && (
                  <span className="text-red-700 font-medium"> Margins require attention — cost optimization recommended.</span>
                )}
              </p>
            </div>

            {/* ── Cost Breakdown ── */}
            <div className="mb-6">
              <h2 className="text-lg font-bold text-gray-900 border-b border-gray-300 pb-1 mb-3">
                Cost Breakdown
              </h2>
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="text-left px-3 py-2 border border-gray-300 font-semibold text-gray-800">Cost Category</th>
                    <th className="text-right px-3 py-2 border border-gray-300 font-semibold text-gray-800">Monthly (SAR)</th>
                    <th className="text-right px-3 py-2 border border-gray-300 font-semibold text-gray-800">% of Total</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { label: 'Vehicle Ownership', value: financialOutput.costBreakdown.vehicleOwnership },
                    { label: 'Vehicle Running', value: financialOutput.costBreakdown.vehicleRunning },
                    { label: 'People', value: financialOutput.costBreakdown.people },
                    { label: 'Facilities', value: financialOutput.costBreakdown.facilities },
                    { label: 'Per-Shipment', value: financialOutput.costBreakdown.perShipment },
                    { label: 'Other', value: financialOutput.costBreakdown.other },
                  ].map((row, idx) => (
                    <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-3 py-1.5 border border-gray-300 text-gray-700">{row.label}</td>
                      <td className="px-3 py-1.5 border border-gray-300 text-right font-mono text-gray-900">
                        {formatCurrency(row.value)}
                      </td>
                      <td className="px-3 py-1.5 border border-gray-300 text-right font-mono text-gray-700">
                        {financialOutput.totalCost > 0
                          ? ((row.value / financialOutput.totalCost) * 100).toFixed(1) + '%'
                          : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-200 font-bold">
                    <td className="px-3 py-2 border border-gray-300 text-gray-900">TOTAL</td>
                    <td className="px-3 py-2 border border-gray-300 text-right font-mono text-gray-900">
                      {formatCurrency(financialOutput.totalCost)}
                    </td>
                    <td className="px-3 py-2 border border-gray-300 text-right font-mono text-gray-900">100%</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* ── FMEA Summary ── */}
            <div className="mb-6">
              <h2 className="text-lg font-bold text-gray-900 border-b border-gray-300 pb-1 mb-3">
                FMEA Risk Matrix
              </h2>
              <div className="grid grid-cols-3 gap-4 mb-3">
                <div className="border border-gray-300 rounded p-3 text-center">
                  <div className="text-xs text-gray-500 uppercase mb-1">Total Items</div>
                  <div className="text-2xl font-bold text-gray-900">{fmeaData.items.length}</div>
                </div>
                <div className="border border-gray-300 rounded p-3 text-center">
                  <div className="text-xs text-gray-500 uppercase mb-1">Total RPN</div>
                  <div className="text-2xl font-bold text-gray-900">{fmeaData.totalRPN.toLocaleString()}</div>
                </div>
                <div className="border border-red-300 bg-red-50 rounded p-3 text-center">
                  <div className="text-xs text-red-600 uppercase mb-1">Critical Items</div>
                  <div className="text-2xl font-bold text-red-700">{fmeaData.criticalItems.length}</div>
                </div>
              </div>

              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="text-left px-2 py-1.5 border border-gray-300 text-gray-800 text-xs">Node</th>
                    <th className="text-left px-2 py-1.5 border border-gray-300 text-gray-800 text-xs">Failure Mode</th>
                    <th className="text-center px-2 py-1.5 border border-gray-300 text-gray-800 text-xs w-10">S</th>
                    <th className="text-center px-2 py-1.5 border border-gray-300 text-gray-800 text-xs w-10">O</th>
                    <th className="text-center px-2 py-1.5 border border-gray-300 text-gray-800 text-xs w-10">D</th>
                    <th className="text-center px-2 py-1.5 border border-gray-300 text-gray-800 text-xs w-14">RPN</th>
                  </tr>
                </thead>
                <tbody>
                  {fmeaData.items.map((item, idx) => {
                    const rpn = item.severity * item.occurrence * item.detectability;
                    const isCritical = rpn > 200;
                    return (
                      <tr key={idx} className={isCritical ? 'bg-red-50' : idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        <td className="px-2 py-1 border border-gray-300 text-gray-700 text-xs">{item.node}</td>
                        <td className="px-2 py-1 border border-gray-300 text-gray-700 text-xs">{item.failureMode}</td>
                        <td className="px-2 py-1 border border-gray-300 text-center text-xs text-gray-900">{item.severity}</td>
                        <td className="px-2 py-1 border border-gray-300 text-center text-xs text-gray-900">{item.occurrence}</td>
                        <td className="px-2 py-1 border border-gray-300 text-center text-xs text-gray-900">{item.detectability}</td>
                        <td className={`px-2 py-1 border border-gray-300 text-center text-xs font-bold ${isCritical ? 'text-red-700' : 'text-gray-900'}`}>
                          {rpn}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* ── VaR Summary ── */}
            <div className="mb-6">
              <h2 className="text-lg font-bold text-gray-900 border-b border-gray-300 pb-1 mb-3">
                Value at Risk (VaR)
              </h2>
              <div className="grid grid-cols-2 gap-4">
                <div className="border border-gray-300 rounded p-3">
                  <div className="text-xs text-gray-500 uppercase mb-1">VaR @ 95% Confidence</div>
                  <div className="text-xl font-bold text-amber-700">{formatCurrency(varData.confidence95)}</div>
                  <div className="text-xs text-gray-600 mt-1">
                    {varData.monthlyRevenue > 0
                      ? ((varData.confidence95 / varData.monthlyRevenue) * 100).toFixed(1) + '% of monthly revenue'
                      : '-'}
                  </div>
                </div>
                <div className="border border-gray-300 rounded p-3">
                  <div className="text-xs text-gray-500 uppercase mb-1">VaR @ 99% Confidence</div>
                  <div className="text-xl font-bold text-red-700">{formatCurrency(varData.confidence99)}</div>
                  <div className="text-xs text-gray-600 mt-1">
                    {varData.monthlyRevenue > 0
                      ? ((varData.confidence99 / varData.monthlyRevenue) * 100).toFixed(1) + '% of monthly revenue'
                      : '-'}
                  </div>
                </div>
              </div>
              <p className="text-xs text-gray-600 mt-2 italic">{varData.interpretation}</p>
            </div>

            {/* ── SCRS Resilience ── */}
            <div className="mb-6">
              <h2 className="text-lg font-bold text-gray-900 border-b border-gray-300 pb-1 mb-3">
                SCRS Resilience Score
              </h2>
              <div className="flex items-center gap-4 mb-3">
                <div className="border border-gray-300 rounded p-4 text-center">
                  <div className="text-xs text-gray-500 uppercase mb-1">Overall Score</div>
                  <div
                    className={`text-3xl font-bold ${
                      scrsData.overallScore >= 70 ? 'text-green-700' :
                      scrsData.overallScore >= 50 ? 'text-amber-700' :
                      scrsData.overallScore >= 30 ? 'text-orange-700' : 'text-red-700'
                    }`}
                  >
                    {scrsData.overallScore}/100
                  </div>
                  <div className="text-sm font-semibold">{scrsData.level}</div>
                </div>
                <div className="flex-1 space-y-2">
                  {scrsData.factors.map((factor, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <span className="text-xs text-gray-700 w-40">{factor.name}</span>
                      <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${factor.score}%`,
                            backgroundColor: factor.score >= 70 ? '#16a34a' : factor.score >= 50 ? '#ca8a04' : '#ea580c',
                          }}
                        />
                      </div>
                      <span className="text-xs font-mono text-gray-900 w-10 text-right">{factor.score}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* ─── Advanced KPIs Table ─── */}
            <div className="mb-6">
              <h2 className="text-lg font-bold text-gray-900 border-b border-gray-300 pb-1 mb-3">
                Advanced KPIs
              </h2>

              {advancedKpis ? (
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="text-left px-3 py-2 border border-gray-300 font-semibold text-gray-800">KPI</th>
                      <th className="text-right px-3 py-2 border border-gray-300 font-semibold text-gray-800">Value</th>
                      <th className="text-right px-3 py-2 border border-gray-300 font-semibold text-gray-800">Benchmark</th>
                      <th className="text-center px-3 py-2 border border-gray-300 font-semibold text-gray-800">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="bg-white">
                      <td className="px-3 py-1.5 border border-gray-300 text-gray-700">OTIF Rate</td>
                      <td className="px-3 py-1.5 border border-gray-300 text-right font-mono text-gray-900">{advancedKpis.otif.rate}%</td>
                      <td className="px-3 py-1.5 border border-gray-300 text-right font-mono text-gray-500">92%</td>
                      <td className="px-3 py-1.5 border border-gray-300 text-center">
                        <span className={`text-xs px-2 py-0.5 rounded ${advancedKpis.otif.rate >= 92 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                          {advancedKpis.otif.rate >= 92 ? '✓' : '⚠'}
                        </span>
                      </td>
                    </tr>
                    <tr className="bg-gray-50">
                      <td className="px-3 py-1.5 border border-gray-300 text-gray-700">Cost per Order</td>
                      <td className="px-3 py-1.5 border border-gray-300 text-right font-mono text-gray-900">SAR {advancedKpis.cpo.value.toFixed(2)}</td>
                      <td className="px-3 py-1.5 border border-gray-300 text-right font-mono text-gray-500">SAR 38.00</td>
                      <td className="px-3 py-1.5 border border-gray-300 text-center">
                        <span className={`text-xs px-2 py-0.5 rounded ${advancedKpis.cpo.value <= 38 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                          {advancedKpis.cpo.value <= 38 ? '✓' : '⚠'}
                        </span>
                      </td>
                    </tr>
                    <tr className="bg-white">
                      <td className="px-3 py-1.5 border border-gray-300 text-gray-700">Cost per Km</td>
                      <td className="px-3 py-1.5 border border-gray-300 text-right font-mono text-gray-900">SAR {advancedKpis.cpoPerKm.value.toFixed(2)}</td>
                      <td className="px-3 py-1.5 border border-gray-300 text-right font-mono text-gray-500">SAR 4.50</td>
                      <td className="px-3 py-1.5 border border-gray-300 text-center">
                        <span className={`text-xs px-2 py-0.5 rounded ${advancedKpis.cpoPerKm.value <= 4.5 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                          {advancedKpis.cpoPerKm.value <= 4.5 ? '✓' : '⚠'}
                        </span>
                      </td>
                    </tr>
                    <tr className="bg-gray-50">
                      <td className="px-3 py-1.5 border border-gray-300 text-gray-700">Cash-to-Cash Cycle</td>
                      <td className="px-3 py-1.5 border border-gray-300 text-right font-mono text-gray-900">{advancedKpis.cashToCashCycle.days} days</td>
                      <td className="px-3 py-1.5 border border-gray-300 text-right font-mono text-gray-500">45 days</td>
                      <td className="px-3 py-1.5 border border-gray-300 text-center">
                        <span className={`text-xs px-2 py-0.5 rounded ${advancedKpis.cashToCashCycle.days <= 45 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                          {advancedKpis.cashToCashCycle.days <= 45 ? '✓' : '⚠'}
                        </span>
                      </td>
                    </tr>
                    <tr className="bg-white">
                      <td className="px-3 py-1.5 border border-gray-300 text-gray-700">Inventory Turnover</td>
                      <td className="px-3 py-1.5 border border-gray-300 text-right font-mono text-gray-900">{advancedKpis.inventoryTurnover.ratio.toFixed(1)}x</td>
                      <td className="px-3 py-1.5 border border-gray-300 text-right font-mono text-gray-500">8.0x</td>
                      <td className="px-3 py-1.5 border border-gray-300 text-center">
                        <span className={`text-xs px-2 py-0.5 rounded ${advancedKpis.inventoryTurnover.ratio >= 8 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                          {advancedKpis.inventoryTurnover.ratio >= 8 ? '✓' : '⚠'}
                        </span>
                      </td>
                    </tr>
                    <tr className="bg-gray-50">
                      <td className="px-3 py-1.5 border border-gray-300 text-gray-700">Warehouse Utilization</td>
                      <td className="px-3 py-1.5 border border-gray-300 text-right font-mono text-gray-900">{advancedKpis.warehouseUtilization.rate}%</td>
                      <td className="px-3 py-1.5 border border-gray-300 text-right font-mono text-gray-500">80% target</td>
                      <td className="px-3 py-1.5 border border-gray-300 text-center">
                        <span className={`text-xs px-2 py-0.5 rounded ${advancedKpis.warehouseUtilization.rate <= 85 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                          {advancedKpis.warehouseUtilization.rate <= 85 ? '✓' : '⚠'}
                        </span>
                      </td>
                    </tr>
                    <tr className="bg-white">
                      <td className="px-3 py-1.5 border border-gray-300 text-gray-700">Contribution Margin</td>
                      <td className="px-3 py-1.5 border border-gray-300 text-right font-mono text-gray-900">{advancedKpis.contributionMargin.overall}%</td>
                      <td className="px-3 py-1.5 border border-gray-300 text-right font-mono text-gray-500">≥15%</td>
                      <td className="px-3 py-1.5 border border-gray-300 text-center">
                        <span className={`text-xs px-2 py-0.5 rounded ${advancedKpis.contributionMargin.overall >= 15 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                          {advancedKpis.contributionMargin.overall >= 15 ? '✓' : '⚠'}
                        </span>
                      </td>
                    </tr>
                    <tr className="bg-gray-50">
                      <td className="px-3 py-1.5 border border-gray-300 text-gray-700">Damage &amp; Loss Rate</td>
                      <td className="px-3 py-1.5 border border-gray-300 text-right font-mono text-gray-900">{advancedKpis.damageLossRate.rate}%</td>
                      <td className="px-3 py-1.5 border border-gray-300 text-right font-mono text-gray-500">&lt;2%</td>
                      <td className="px-3 py-1.5 border border-gray-300 text-center">
                        <span className={`text-xs px-2 py-0.5 rounded ${advancedKpis.damageLossRate.rate <= 2 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                          {advancedKpis.damageLossRate.rate <= 2 ? '✓' : '⚠'}
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              ) : (
                <p className="text-gray-500 text-xs italic">Advanced KPIs not available</p>
              )}
            </div>

            {/* ── Footer ── */}
            <div className="border-t border-gray-300 pt-4 mt-8 text-xs text-gray-500">
              <p>Report generated by VEGA Logistics OS · Confidential · For internal use only</p>
              <p>Data as of {new Date().toLocaleString('en-US')} · {financialInput.vehicleClasses.filter((c) => c.enabled).reduce((s, c) => s + c.quantity, 0)} vehicles · {financialOutput.totalDailyShipments} daily shipments</p>
            </div>
          </div>
        </div>
      )}

      {/* Export Button */}
      <button
        onClick={handleExport}
        disabled={isPrinting}
        className={`flex items-center gap-2 px-4 py-2 rounded text-xs font-medium transition-all no-print ${
          isPrinting
            ? 'bg-[#2a2a33] text-[#52525b] cursor-not-allowed'
            : 'bg-[#22c55e]/10 text-[#22c55e] border border-[#22c55e]/30 hover:bg-[#22c55e]/20 hover:border-[#22c55e]/50'
        }`}
      >
        <Printer size={14} />
        {isPrinting ? 'Preparing...' : 'Export PDF Report'}
      </button>
    </>
  );
}
