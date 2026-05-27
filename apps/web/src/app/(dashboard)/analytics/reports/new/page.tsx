// @ts-nocheck
﻿'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/trpc/react';

const DATA_SOURCES = [
  { id: 'crm_deals', label: 'CRM â€” Deals' },
  { id: 'crm_contacts', label: 'CRM â€” Contacts' },
  { id: 'crm_leads', label: 'CRM â€” Leads' },
  { id: 'projects_tasks', label: 'Projects â€” Tasks' },
  { id: 'hr_employees', label: 'HR â€” Employees' },
  { id: 'hr_leave', label: 'HR â€” Leave Requests' },
  { id: 'helpdesk_tickets', label: 'Help Desk â€” Tickets' },
  { id: 'accounting_invoices', label: 'Accounting â€” Invoices' },
  { id: 'inventory_products', label: 'Inventory â€” Products' },
  { id: 'forms_submissions', label: 'Forms â€” Submissions' },
  { id: 'workflow_runs', label: 'Workflows â€” Runs' },
];

const REPORT_TYPES = [
  { id: 'chart', label: 'Chart', desc: 'Visualize data with line, bar, or pie charts' },
  { id: 'table', label: 'Table', desc: 'Tabular data with sorting and pagination' },
  { id: 'kpi', label: 'KPI', desc: 'Single metric with trend comparison' },
  { id: 'pivot', label: 'Pivot', desc: 'Cross-tabulation of dimensions and measures' },
  { id: 'funnel', label: 'Funnel', desc: 'Multi-stage conversion funnel analysis' },
  { id: 'cohort', label: 'Cohort', desc: 'Retention and cohort analysis over time' },
];

const AGGREGATIONS = ['count', 'sum', 'avg', 'min', 'max'] as const;

type Step = 'source' | 'configure' | 'visualize' | 'save';

export default function NewReportPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('source');

  // Step 1
  const [dataSource, setDataSource] = useState('crm_deals');
  const [reportType, setReportType] = useState<'table' | 'chart' | 'pivot' | 'funnel' | 'cohort' | 'kpi'>('chart');

  // Step 2
  const { data: dataSources } = api.analytics.query.dataSources.useQuery();
  const currentModule = dataSources?.find((m) => m.id === dataSource);

  const [selectedDimensions, setSelectedDimensions] = useState<string[]>([]);
  const [selectedMeasures, setSelectedMeasures] = useState<{ field: string; aggregation: 'sum' | 'count' | 'avg' | 'min' | 'max' }[]>([]);
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [dateField, setDateField] = useState('created_at');

  // Step 3
  const [chartType, setChartType] = useState<'bar' | 'line' | 'pie' | 'area' | 'donut'>('bar');
  const [xAxis, setXAxis] = useState('');
  const [yAxis, setYAxis] = useState('');

  // Step 4
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');

  // Preview
  const [previewQuery, setPreviewQuery] = useState<null | {
    dataSource: string;
    dimensions: string[];
    measures: { field: string; aggregation: 'sum' | 'count' | 'avg' | 'min' | 'max' }[];
    filters: [];
    dateRange: { field: string; from: string; to: string };
    limit: number;
  }>(null);

  const previewResult = api.analytics.query.run.useQuery(
    previewQuery ?? { dataSource: 'crm_deals', dimensions: [], measures: [], filters: [], dateRange: { field: 'created_at', from: dateFrom, to: dateTo }, limit: 10 },
    { enabled: !!previewQuery }
  );

  const createMutation = api.analytics.reportsV2.create.useMutation({
    onSuccess: (report) => router.push(`/analytics/reports/${report.id}`),
  });

  function toggleDimension(field: string) {
    setSelectedDimensions((prev) =>
      prev.includes(field) ? prev.filter((f) => f !== field) : [...prev, field]
    );
  }

  function toggleMeasure(field: string, agg: 'sum' | 'count' | 'avg' | 'min' | 'max') {
    const key = `${field}:${agg}`;
    const exists = selectedMeasures.some((m) => m.field === field && m.aggregation === agg);
    if (exists) {
      setSelectedMeasures((prev) => prev.filter((m) => !(m.field === field && m.aggregation === agg)));
    } else {
      setSelectedMeasures((prev) => [...prev, { field, aggregation: agg }]);
    }
  }

  function runPreview() {
    setPreviewQuery({
      dataSource,
      dimensions: selectedDimensions,
      measures: selectedMeasures,
      filters: [],
      dateRange: { field: dateField, from: dateFrom + 'T00:00:00Z', to: dateTo + 'T23:59:59Z' },
      limit: 10,
    });
  }

  async function handleSave() {
    if (!name.trim()) return;
    await createMutation.mutateAsync({
      name: name.trim(),
      description: description || undefined,
      report_type: reportType,
      data_source: {
        module: dataSource,
        dimensions: selectedDimensions.map((f) => ({ field: f })),
        measures: selectedMeasures,
        filters: [],
        date_filter: { field: dateField, from: dateFrom, to: dateTo },
        limit: 100,
      },
      visualization_config: {
        chart_type: chartType,
        x_axis: xAxis || undefined,
        y_axis: yAxis || undefined,
        show_legend: true,
        show_data_labels: false,
        color_palette: 'default' as const,
        funnel_stages: [],
      },
      tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
    });
  }

  const steps: { id: Step; label: string }[] = [
    { id: 'source', label: '1. Data Source' },
    { id: 'configure', label: '2. Configure' },
    { id: 'visualize', label: '3. Visualize' },
    { id: 'save', label: '4. Save' },
  ];

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">New Report</h1>
        <p className="text-sm text-gray-500 mt-1">Build a custom analytics report</p>
      </div>

      {/* Step Indicator */}
      <div className="flex gap-1 mb-8">
        {steps.map((s, i) => (
          <div key={s.id} className="flex items-center gap-1">
            <button
              onClick={() => setStep(s.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                step === s.id
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {s.label}
            </button>
            {i < steps.length - 1 && <span className="text-gray-300">â€º</span>}
          </div>
        ))}
      </div>

      {/* Step 1: Data Source */}
      {step === 'source' && (
        <div>
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Choose Data Source</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
            {DATA_SOURCES.map((ds) => (
              <button
                key={ds.id}
                onClick={() => { setDataSource(ds.id); setSelectedDimensions([]); setSelectedMeasures([]); }}
                className={`p-4 rounded-xl border-2 text-left transition-all ${
                  dataSource === ds.id
                    ? 'border-indigo-500 bg-indigo-50'
                    : 'border-gray-200 hover:border-gray-300 bg-white'
                }`}
              >
                <p className="font-medium text-gray-900 text-sm">{ds.label}</p>
              </button>
            ))}
          </div>

          <h2 className="text-lg font-semibold text-gray-800 mb-4">Report Type</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-8">
            {REPORT_TYPES.map((rt) => (
              <button
                key={rt.id}
                onClick={() => setReportType(rt.id as typeof reportType)}
                className={`p-4 rounded-xl border-2 text-left transition-all ${
                  reportType === rt.id
                    ? 'border-indigo-500 bg-indigo-50'
                    : 'border-gray-200 hover:border-gray-300 bg-white'
                }`}
              >
                <p className="font-semibold text-gray-900 text-sm">{rt.label}</p>
                <p className="text-xs text-gray-500 mt-1">{rt.desc}</p>
              </button>
            ))}
          </div>

          <button
            onClick={() => setStep('configure')}
            className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-indigo-700 transition-colors"
          >
            Next: Configure
          </button>
        </div>
      )}

      {/* Step 2: Configure dimensions/measures */}
      {step === 'configure' && (
        <div>
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Configure Query</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <h3 className="font-medium text-gray-700 mb-3 text-sm">Dimensions (Group By)</h3>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {currentModule?.dimensions.map((dim) => (
                  <label key={dim.field} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedDimensions.includes(dim.field)}
                      onChange={() => toggleDimension(dim.field)}
                      className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <div>
                      <p className="text-sm font-medium text-gray-900">{dim.label}</p>
                      <p className="text-xs text-gray-400">{dim.type} Â· {dim.field}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <h3 className="font-medium text-gray-700 mb-3 text-sm">Measures (Aggregations)</h3>
              <div className="space-y-3 max-h-60 overflow-y-auto">
                {currentModule?.measures.map((m) => (
                  <div key={m.field}>
                    <p className="text-sm font-medium text-gray-900 mb-1">{m.label}</p>
                    <div className="flex flex-wrap gap-1">
                      {AGGREGATIONS.filter((a) => m.func.includes(a)).map((agg) => (
                        <button
                          key={agg}
                          onClick={() => toggleMeasure(m.field, agg)}
                          className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${
                            selectedMeasures.some((sm) => sm.field === m.field && sm.aggregation === agg)
                              ? 'bg-indigo-600 text-white'
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                        >
                          {agg.toUpperCase()}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Date Range */}
          <div className="bg-gray-50 rounded-xl p-4 mb-6">
            <h3 className="font-medium text-gray-700 mb-3 text-sm">Date Range</h3>
            <div className="flex flex-wrap gap-3">
              <div>
                <label className="text-xs text-gray-500 block mb-1">Date Field</label>
                <select
                  value={dateField}
                  onChange={(e) => setDateField(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                >
                  {currentModule?.date_fields.map((f) => (
                    <option key={f} value={f}>{f}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">From</label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">To</label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                />
              </div>
            </div>
          </div>

          {/* Preview */}
          <div className="mb-6">
            <button
              onClick={runPreview}
              disabled={previewResult.isFetching}
              className="bg-gray-800 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-900 disabled:opacity-50 transition-colors mb-3"
            >
              {previewResult.isFetching ? 'Running...' : 'Preview Results'}
            </button>
            {previewResult.data && (
              <div className="bg-white border border-gray-200 rounded-xl overflow-auto max-h-64">
                <p className="text-xs text-gray-500 px-4 py-2 border-b">
                  {previewResult.data.meta.row_count} rows Â· {previewResult.data.meta.duration_ms}ms
                </p>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-gray-50">
                      {previewResult.data.rows[0] &&
                        Object.keys(previewResult.data.rows[0] as object).map((col) => (
                          <th key={col} className="px-3 py-2 text-left font-medium text-gray-600">{col}</th>
                        ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(previewResult.data.rows as Record<string, unknown>[]).map((row, i) => (
                      <tr key={i} className="border-t border-gray-100">
                        {Object.values(row).map((val, j) => (
                          <td key={j} className="px-3 py-2 text-gray-700">{String(val ?? '')}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <button onClick={() => setStep('source')} className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50">Back</button>
            <button onClick={() => setStep('visualize')} className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-indigo-700 transition-colors">Next: Visualize</button>
          </div>
        </div>
      )}

      {/* Step 3: Visualization */}
      {step === 'visualize' && (
        <div>
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Visualization Settings</h2>

          <div className="mb-6">
            <label className="text-sm font-medium text-gray-700 block mb-2">Chart Type</label>
            <div className="flex flex-wrap gap-2">
              {(['bar', 'line', 'area', 'pie', 'donut'] as const).map((ct) => (
                <button
                  key={ct}
                  onClick={() => setChartType(ct)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium border-2 transition-all capitalize ${
                    chartType === ct
                      ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  {ct}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-2">X Axis</label>
              <select
                value={xAxis}
                onChange={(e) => setXAxis(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
              >
                <option value="">Select field...</option>
                {selectedDimensions.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-2">Y Axis</label>
              <select
                value={yAxis}
                onChange={(e) => setYAxis(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
              >
                <option value="">Select measure...</option>
                {selectedMeasures.map((m) => (
                  <option key={`${m.field}_${m.aggregation}`} value={`${m.aggregation}_${m.field}`}>
                    {m.aggregation.toUpperCase()}({m.field})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex gap-3">
            <button onClick={() => setStep('configure')} className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50">Back</button>
            <button onClick={() => setStep('save')} className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-indigo-700 transition-colors">Next: Save</button>
          </div>
        </div>
      )}

      {/* Step 4: Save */}
      {step === 'save' && (
        <div>
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Save Report</h2>
          <div className="space-y-4 max-w-lg">
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Report Name *</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Monthly Deal Pipeline"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional description..."
                rows={3}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none resize-none"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Tags (comma separated)</label>
              <input
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="e.g. crm, sales, monthly"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
              />
            </div>
          </div>

          <div className="flex gap-3 mt-6">
            <button onClick={() => setStep('visualize')} className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50">Back</button>
            <button
              onClick={handleSave}
              disabled={!name.trim() || createMutation.isPending}
              className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {createMutation.isPending ? 'Creating...' : 'Create Report'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

