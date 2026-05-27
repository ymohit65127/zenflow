/**
 * Forms v2 — Conditional Logic Engine
 *
 * Evaluates a set of ConditionalRule[] against the current form values
 * and returns the computed visibility / required / disabled state for
 * every field that has rules targeting it.
 */

export type ConditionalOperator =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'not_contains'
  | 'is_empty'
  | 'is_not_empty'
  | 'greater_than'
  | 'less_than'
  // Extended operators from spec
  | 'eq'
  | 'neq'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'starts_with'
  | 'ends_with'
  | 'in'
  | 'not_in';

export type ConditionalAction = 'show' | 'hide' | 'require' | 'disable';

export type ConditionalRule = {
  if: {
    fieldId: string;
    operator: ConditionalOperator;
    value: unknown;
  };
  then: {
    action: ConditionalAction;
    fieldIds: string[];
  };
};

export type FieldState = {
  visible: boolean;
  required: boolean;
  disabled: boolean;
};

// ─── Single condition evaluator ───────────────────────────────────────────────

function evaluateSingleCondition(
  operator: ConditionalOperator,
  fieldValue: unknown,
  ruleValue: unknown
): boolean {
  const strField = String(fieldValue ?? '');
  const strRule = String(ruleValue ?? '');

  switch (operator) {
    // Friendly aliases (spec UI labels)
    case 'equals':
    case 'eq':
      return strField === strRule;

    case 'not_equals':
    case 'neq':
      return strField !== strRule;

    case 'contains':
      return strField.includes(strRule);

    case 'not_contains':
      return !strField.includes(strRule);

    case 'is_empty':
      return (
        fieldValue === null ||
        fieldValue === undefined ||
        fieldValue === '' ||
        (Array.isArray(fieldValue) && fieldValue.length === 0)
      );

    case 'is_not_empty':
      return !(
        fieldValue === null ||
        fieldValue === undefined ||
        fieldValue === '' ||
        (Array.isArray(fieldValue) && fieldValue.length === 0)
      );

    case 'greater_than':
    case 'gt':
      return Number(fieldValue) > Number(ruleValue);

    case 'gte':
      return Number(fieldValue) >= Number(ruleValue);

    case 'less_than':
    case 'lt':
      return Number(fieldValue) < Number(ruleValue);

    case 'lte':
      return Number(fieldValue) <= Number(ruleValue);

    case 'starts_with':
      return strField.startsWith(strRule);

    case 'ends_with':
      return strField.endsWith(strRule);

    case 'in':
      return Array.isArray(ruleValue) && (ruleValue as unknown[]).includes(fieldValue);

    case 'not_in':
      return Array.isArray(ruleValue) && !(ruleValue as unknown[]).includes(fieldValue);

    default:
      return false;
  }
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Evaluate all conditional rules against the current form values.
 *
 * Default state for all fields is: visible=true, required=false, disabled=false.
 * Rules are applied in order; later rules for the same field+property override earlier ones.
 *
 * @param rules   Array of ConditionalRule objects (field-level conditional logic)
 * @param formValues  Current form values keyed by fieldId
 * @returns  Map of fieldId → computed { visible, required, disabled }
 */
export function evaluateConditionalRules(
  rules: ConditionalRule[],
  formValues: Record<string, unknown>
): Record<string, FieldState> {
  // Collect all target fieldIds so we can initialise defaults
  const allTargetIds = new Set<string>();
  for (const rule of rules) {
    for (const fId of rule.then.fieldIds) {
      allTargetIds.add(fId);
    }
  }

  // Build initial state map (everything visible, not required, not disabled)
  const stateMap: Record<string, FieldState> = {};
  for (const fId of allTargetIds) {
    stateMap[fId] = { visible: true, required: false, disabled: false };
  }

  // Apply each rule
  for (const rule of rules) {
    const { if: condition, then: outcome } = rule;
    const fieldValue = formValues[condition.fieldId];
    const conditionMet = evaluateSingleCondition(
      condition.operator,
      fieldValue,
      condition.value
    );

    for (const targetId of outcome.fieldIds) {
      if (!stateMap[targetId]) {
        stateMap[targetId] = { visible: true, required: false, disabled: false };
      }

      const state = stateMap[targetId]!;

      switch (outcome.action) {
        case 'show':
          state.visible = conditionMet;
          break;
        case 'hide':
          state.visible = !conditionMet;
          break;
        case 'require':
          state.required = conditionMet;
          break;
        case 'disable':
          state.disabled = conditionMet;
          break;
      }
    }
  }

  return stateMap;
}

// ─── Helper: build a default FieldState for fields not in any rule ────────────

export function defaultFieldState(): FieldState {
  return { visible: true, required: false, disabled: false };
}

// ─── Helper: merge base required with rule-computed required ─────────────────

/**
 * Merge the computed state with a field's own `required` property.
 * A field is required if either its schema marks it required AND it is visible,
 * OR a conditional rule requires it.
 */
export function mergeRequiredState(
  schemaRequired: boolean,
  computed: FieldState
): FieldState {
  return {
    ...computed,
    required: computed.visible && (schemaRequired || computed.required),
  };
}
