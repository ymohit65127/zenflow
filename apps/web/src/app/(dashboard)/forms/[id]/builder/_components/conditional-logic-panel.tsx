'use client';

import { useState } from 'react';
import { Plus, Trash2, X, GitBranch } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ConditionalRule, ConditionalOperator, ConditionalAction } from '@/lib/form-conditional-logic';

// ─── Types ────────────────────────────────────────────────────────────────────

interface FieldMeta {
  id: string;
  label: string;
  field_key?: string;
}

interface ConditionalLogicPanelProps {
  /** The ID of the field whose conditional rules we're editing */
  selectedFieldId: string;
  /** All fields in the form (for dropdowns) */
  allFields: FieldMeta[];
  /** Current rules array stored on the selected field */
  rules: ConditionalRule[];
  /** Called whenever rules change */
  onChange: (rules: ConditionalRule[]) => void;
  /** Close the panel */
  onClose: () => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const OPERATORS: { value: ConditionalOperator; label: string }[] = [
  { value: 'equals', label: 'Equals' },
  { value: 'not_equals', label: 'Not equals' },
  { value: 'contains', label: 'Contains' },
  { value: 'not_contains', label: 'Does not contain' },
  { value: 'is_empty', label: 'Is empty' },
  { value: 'is_not_empty', label: 'Is not empty' },
  { value: 'greater_than', label: 'Greater than' },
  { value: 'less_than', label: 'Less than' },
];

const ACTIONS: { value: ConditionalAction; label: string; color: string }[] = [
  { value: 'show', label: 'Show', color: 'text-green-600' },
  { value: 'hide', label: 'Hide', color: 'text-amber-600' },
  { value: 'require', label: 'Require', color: 'text-red-600' },
  { value: 'disable', label: 'Disable', color: 'text-gray-500' },
];

const NO_VALUE_OPERATORS: ConditionalOperator[] = ['is_empty', 'is_not_empty'];

// ─── Helper ───────────────────────────────────────────────────────────────────

function makeEmptyRule(allFields: FieldMeta[], selectedFieldId: string): ConditionalRule {
  const firstOther = allFields.find((f) => f.id !== selectedFieldId);
  return {
    if: { fieldId: firstOther?.id ?? '', operator: 'equals', value: '' },
    then: { action: 'show', fieldIds: [selectedFieldId] },
  };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function RuleRow({
  rule,
  index,
  allFields,
  selectedFieldId,
  onChange,
  onDelete,
}: {
  rule: ConditionalRule;
  index: number;
  allFields: FieldMeta[];
  selectedFieldId: string;
  onChange: (r: ConditionalRule) => void;
  onDelete: () => void;
}) {
  const noValue = NO_VALUE_OPERATORS.includes(rule.if.operator);
  const otherFields = allFields.filter((f) => f.id !== selectedFieldId);
  const targetableFields = allFields.filter((f) => f.id !== rule.if.fieldId);

  function toggleTargetField(fieldId: string) {
    const current = rule.then.fieldIds;
    const updated = current.includes(fieldId)
      ? current.filter((id) => id !== fieldId)
      : [...current, fieldId];
    onChange({ ...rule, then: { ...rule.then, fieldIds: updated } });
  }

  return (
    <div className="border border-border rounded-xl p-3 space-y-3 bg-muted/20">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Rule {index + 1}
        </span>
        <button
          onClick={onDelete}
          className="w-6 h-6 rounded-lg hover:bg-red-500/10 hover:text-red-500 flex items-center justify-center transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* IF row */}
      <div className="space-y-2">
        <span className="text-xs font-medium text-muted-foreground">IF</span>
        <div className="grid grid-cols-2 gap-2">
          {/* Source field */}
          <select
            value={rule.if.fieldId}
            onChange={(e) => onChange({ ...rule, if: { ...rule.if, fieldId: e.target.value } })}
            className="bg-muted border border-border rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500/50 col-span-2"
          >
            <option value="">Select field…</option>
            {otherFields.map((f) => (
              <option key={f.id} value={f.id}>{f.label}</option>
            ))}
          </select>

          {/* Operator */}
          <select
            value={rule.if.operator}
            onChange={(e) =>
              onChange({ ...rule, if: { ...rule.if, operator: e.target.value as ConditionalOperator } })
            }
            className="bg-muted border border-border rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500/50"
          >
            {OPERATORS.map((op) => (
              <option key={op.value} value={op.value}>{op.label}</option>
            ))}
          </select>

          {/* Value (hidden for is_empty / is_not_empty) */}
          {noValue ? (
            <div className="bg-muted/50 border border-dashed border-border rounded-lg px-2.5 py-1.5 text-xs text-muted-foreground flex items-center">
              (no value needed)
            </div>
          ) : (
            <input
              type="text"
              value={String(rule.if.value ?? '')}
              onChange={(e) => onChange({ ...rule, if: { ...rule.if, value: e.target.value } })}
              placeholder="Value…"
              className="bg-muted border border-border rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500/50"
            />
          )}
        </div>
      </div>

      {/* THEN row */}
      <div className="space-y-2">
        <span className="text-xs font-medium text-muted-foreground">THEN</span>
        <select
          value={rule.then.action}
          onChange={(e) =>
            onChange({ ...rule, then: { ...rule.then, action: e.target.value as ConditionalAction } })
          }
          className="w-full bg-muted border border-border rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500/50"
        >
          {ACTIONS.map((a) => (
            <option key={a.value} value={a.value}>{a.label}</option>
          ))}
        </select>

        {/* Target fields multi-select (checkboxes) */}
        <div className="space-y-1 max-h-28 overflow-y-auto">
          {targetableFields.map((f) => {
            const checked = rule.then.fieldIds.includes(f.id);
            return (
              <label
                key={f.id}
                className={cn(
                  'flex items-center gap-2 px-2 py-1 rounded-lg cursor-pointer text-xs transition-colors',
                  checked ? 'bg-brand-500/10 text-brand-600' : 'hover:bg-muted'
                )}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleTargetField(f.id)}
                  className="w-3.5 h-3.5 accent-brand-500"
                />
                <span className="truncate">{f.label}</span>
              </label>
            );
          })}
        </div>
        {rule.then.fieldIds.length === 0 && (
          <p className="text-xs text-amber-600">Select at least one target field.</p>
        )}
      </div>

      {/* Human-readable summary */}
      {rule.if.fieldId && rule.then.fieldIds.length > 0 && (
        <p className="text-xs text-muted-foreground border-t border-border pt-2 leading-relaxed">
          IF{' '}
          <span className="font-medium text-foreground">
            {allFields.find((f) => f.id === rule.if.fieldId)?.label ?? rule.if.fieldId}
          </span>{' '}
          <span className="italic">
            {OPERATORS.find((o) => o.value === rule.if.operator)?.label?.toLowerCase()}
          </span>
          {!noValue && (
            <>
              {' '}
              <span className="font-medium text-foreground">&quot;{String(rule.if.value ?? '')}&quot;</span>
            </>
          )}
          {' '}→{' '}
          <span className={ACTIONS.find((a) => a.value === rule.then.action)?.color}>
            {rule.then.action.toUpperCase()}
          </span>{' '}
          {rule.then.fieldIds
            .map((id) => allFields.find((f) => f.id === id)?.label ?? id)
            .join(', ')}
        </p>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function ConditionalLogicPanel({
  selectedFieldId,
  allFields,
  rules,
  onChange,
  onClose,
}: ConditionalLogicPanelProps) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(rules.length > 0 ? 0 : null);

  function addRule() {
    const newRule = makeEmptyRule(allFields, selectedFieldId);
    const updated = [...rules, newRule];
    onChange(updated);
    setExpandedIndex(updated.length - 1);
  }

  function updateRule(index: number, rule: ConditionalRule) {
    const updated = rules.map((r, i) => (i === index ? rule : r));
    onChange(updated);
  }

  function deleteRule(index: number) {
    const updated = rules.filter((_, i) => i !== index);
    onChange(updated);
    setExpandedIndex(null);
  }

  const selectedField = allFields.find((f) => f.id === selectedFieldId);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border flex-shrink-0">
        <div className="flex items-center gap-2">
          <GitBranch className="w-4 h-4 text-brand-500" />
          <div>
            <h3 className="text-sm font-semibold">Conditional Logic</h3>
            {selectedField && (
              <p className="text-xs text-muted-foreground truncate max-w-40">{selectedField.label}</p>
            )}
          </div>
        </div>
        <button
          onClick={onClose}
          className="w-7 h-7 rounded-lg hover:bg-muted flex items-center justify-center"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Rules list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {rules.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <GitBranch className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm font-medium">No rules yet</p>
            <p className="text-xs mt-1">
              Add a rule to show, hide, require, or disable fields based on this field&apos;s value.
            </p>
          </div>
        )}

        {rules.map((rule, index) => (
          <div key={index}>
            <button
              className="w-full flex items-center justify-between px-3 py-2 bg-card border border-border rounded-xl hover:bg-muted/50 transition-colors text-left"
              onClick={() => setExpandedIndex(expandedIndex === index ? null : index)}
            >
              <span className="text-xs font-medium">Rule {index + 1}</span>
              <span className="text-xs text-muted-foreground">
                {expandedIndex === index ? 'collapse' : 'edit'}
              </span>
            </button>
            {expandedIndex === index && (
              <div className="mt-2">
                <RuleRow
                  rule={rule}
                  index={index}
                  allFields={allFields}
                  selectedFieldId={selectedFieldId}
                  onChange={(r) => updateRule(index, r)}
                  onDelete={() => deleteRule(index)}
                />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Add rule */}
      <div className="p-4 border-t border-border flex-shrink-0">
        <button
          onClick={addRule}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 border-dashed border-border hover:border-brand-500/50 hover:bg-brand-500/5 hover:text-brand-500 text-sm text-muted-foreground transition-all"
        >
          <Plus className="w-4 h-4" />
          Add Rule
        </button>
      </div>
    </div>
  );
}
