'use client';

import { useState, useEffect } from 'react';
import { api } from '@/trpc/react';
import { useRouter } from 'next/navigation';
import {
  Type, AlignLeft, Mail, Phone, Hash, Calendar, Clock, Columns,
  ChevronDown, CheckSquare, ToggleLeft, Upload, Star, SlidersHorizontal,
  LayoutGrid, Heading, AlignCenter, PenLine, Minus,
  GripVertical, Trash2, Settings, Plus, Eye, Save, Globe,
  ArrowLeft, X, ChevronUp,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

type FieldType =
  | 'SHORT_TEXT' | 'LONG_TEXT' | 'EMAIL' | 'PHONE' | 'NUMBER'
  | 'DATE' | 'TIME' | 'DATETIME' | 'DROPDOWN' | 'MULTI_SELECT'
  | 'RADIO' | 'CHECKBOX' | 'FILE_UPLOAD' | 'RATING' | 'SCALE'
  | 'MATRIX' | 'DIVIDER' | 'HEADING' | 'PARAGRAPH' | 'SIGNATURE';

interface FieldOption {
  label: string;
  value: string;
}

interface FormFieldLocal {
  id?: string;
  localId: string;
  type: FieldType;
  label: string;
  placeholder: string;
  description: string;
  field_key: string;
  is_required: boolean;
  is_hidden: boolean;
  sort_order: number;
  options: FieldOption[];
  settings: Record<string, unknown>;
}

// ─── Field type definitions ────────────────────────────────────────────────

interface FieldTypeDef {
  type: FieldType;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  group: string;
}

const FIELD_TYPES: FieldTypeDef[] = [
  { type: 'SHORT_TEXT', label: 'Short Text', icon: Type, group: 'Basic' },
  { type: 'LONG_TEXT', label: 'Long Text', icon: AlignLeft, group: 'Basic' },
  { type: 'EMAIL', label: 'Email', icon: Mail, group: 'Basic' },
  { type: 'PHONE', label: 'Phone', icon: Phone, group: 'Basic' },
  { type: 'NUMBER', label: 'Number', icon: Hash, group: 'Basic' },
  { type: 'DATE', label: 'Date', icon: Calendar, group: 'Basic' },
  { type: 'TIME', label: 'Time', icon: Clock, group: 'Basic' },
  { type: 'DATETIME', label: 'Date & Time', icon: Calendar, group: 'Basic' },
  { type: 'DROPDOWN', label: 'Dropdown', icon: ChevronDown, group: 'Choice' },
  { type: 'MULTI_SELECT', label: 'Multi Select', icon: Columns, group: 'Choice' },
  { type: 'RADIO', label: 'Radio', icon: ToggleLeft, group: 'Choice' },
  { type: 'CHECKBOX', label: 'Checkbox', icon: CheckSquare, group: 'Choice' },
  { type: 'FILE_UPLOAD', label: 'File Upload', icon: Upload, group: 'Advanced' },
  { type: 'RATING', label: 'Rating', icon: Star, group: 'Advanced' },
  { type: 'SCALE', label: 'Scale', icon: SlidersHorizontal, group: 'Advanced' },
  { type: 'MATRIX', label: 'Matrix', icon: LayoutGrid, group: 'Advanced' },
  { type: 'SIGNATURE', label: 'Signature', icon: PenLine, group: 'Advanced' },
  { type: 'HEADING', label: 'Heading', icon: Heading, group: 'Layout' },
  { type: 'PARAGRAPH', label: 'Paragraph', icon: AlignCenter, group: 'Layout' },
  { type: 'DIVIDER', label: 'Divider', icon: Minus, group: 'Layout' },
];

const FIELD_GROUPS = ['Basic', 'Choice', 'Advanced', 'Layout'];

const HAS_OPTIONS: FieldType[] = ['DROPDOWN', 'MULTI_SELECT', 'RADIO', 'CHECKBOX'];
const HAS_PLACEHOLDER: FieldType[] = ['SHORT_TEXT', 'LONG_TEXT', 'EMAIL', 'PHONE', 'NUMBER'];
const IS_LAYOUT: FieldType[] = ['DIVIDER', 'HEADING', 'PARAGRAPH'];

function generateLocalId() {
  return `field_${Math.random().toString(36).slice(2, 9)}`;
}

function fieldKeyFromLabel(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'field';
}

function makeDefaultField(type: FieldType, order: number): FormFieldLocal {
  return {
    localId: generateLocalId(),
    type,
    label: FIELD_TYPES.find((f) => f.type === type)?.label ?? type,
    placeholder: '',
    description: '',
    field_key: fieldKeyFromLabel(FIELD_TYPES.find((f) => f.type === type)?.label ?? type) + `_${order}`,
    is_required: false,
    is_hidden: false,
    sort_order: order,
    options: HAS_OPTIONS.includes(type) ? [{ label: 'Option 1', value: 'option_1' }] : [],
    settings: {},
  };
}

// ─── Sub-components ────────────────────────────────────────────────────────

function FieldTypeButton({ def, onClick }: { def: FieldTypeDef; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2.5 w-full px-3 py-2 rounded-xl hover:bg-brand-500/10 hover:text-brand-500 transition-colors text-left group"
    >
      <def.icon className="w-4 h-4 text-muted-foreground group-hover:text-brand-500 flex-shrink-0" />
      <span className="text-sm font-medium">{def.label}</span>
    </button>
  );
}

function FieldCard({
  field,
  isSelected,
  onSelect,
  onDelete,
  onMoveUp,
  onMoveDown,
  isFirst,
  isLast,
}: {
  field: FormFieldLocal;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  isFirst: boolean;
  isLast: boolean;
}) {
  const def = FIELD_TYPES.find((f) => f.type === field.type);

  return (
    <div
      onClick={onSelect}
      className={cn(
        'border rounded-2xl p-4 cursor-pointer transition-all group',
        isSelected
          ? 'border-brand-500 bg-brand-500/5 shadow-sm'
          : 'border-border bg-card hover:border-brand-500/40 hover:shadow-sm'
      )}
    >
      <div className="flex items-center gap-3">
        <GripVertical className="w-4 h-4 text-muted-foreground/50 flex-shrink-0 cursor-grab" />
        {def && <def.icon className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium truncate">
              {field.type === 'HEADING' || field.type === 'PARAGRAPH'
                ? field.label
                : field.label || <span className="text-muted-foreground italic">Untitled</span>}
            </span>
            {field.is_required && (
              <span className="text-xs px-1.5 py-0.5 rounded-full bg-red-500/10 text-red-500 font-medium flex-shrink-0">
                Required
              </span>
            )}
          </div>
          <span className="text-xs text-muted-foreground">{def?.label ?? field.type}</span>
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => { e.stopPropagation(); onMoveUp(); }}
            disabled={isFirst}
            className="w-6 h-6 rounded-lg hover:bg-muted flex items-center justify-center disabled:opacity-30"
          >
            <ChevronUp className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onMoveDown(); }}
            disabled={isLast}
            className="w-6 h-6 rounded-lg hover:bg-muted flex items-center justify-center disabled:opacity-30"
          >
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onSelect(); }}
            className="w-6 h-6 rounded-lg hover:bg-brand-500/10 hover:text-brand-500 flex items-center justify-center"
          >
            <Settings className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="w-6 h-6 rounded-lg hover:bg-red-500/10 hover:text-red-500 flex items-center justify-center"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

function FieldProperties({
  field,
  onChange,
  onClose,
}: {
  field: FormFieldLocal;
  onChange: (updates: Partial<FormFieldLocal>) => void;
  onClose: () => void;
}) {
  const isLayout = IS_LAYOUT.includes(field.type);
  const hasOptions = HAS_OPTIONS.includes(field.type);
  const hasPlaceholder = HAS_PLACEHOLDER.includes(field.type);

  function updateOption(index: number, key: 'label' | 'value', val: string) {
    const newOptions = field.options.map((o, i) => (i === index ? { ...o, [key]: val } : o));
    onChange({ options: newOptions });
  }

  function addOption() {
    const n = field.options.length + 1;
    onChange({
      options: [...field.options, { label: `Option ${n}`, value: `option_${n}` }],
    });
  }

  function removeOption(index: number) {
    onChange({ options: field.options.filter((_, i) => i !== index) });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm">Field Properties</h3>
        <button onClick={onClose} className="w-7 h-7 rounded-lg hover:bg-muted flex items-center justify-center">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1.5">Label</label>
        <input
          type="text"
          value={field.label}
          onChange={(e) => onChange({ label: e.target.value })}
          className="w-full bg-muted border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50"
        />
      </div>

      {!isLayout && (
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">Field Key</label>
          <input
            type="text"
            value={field.field_key}
            onChange={(e) => onChange({ field_key: e.target.value })}
            className="w-full bg-muted border border-border rounded-xl px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-500/50"
          />
        </div>
      )}

      {hasPlaceholder && (
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">Placeholder</label>
          <input
            type="text"
            value={field.placeholder}
            onChange={(e) => onChange({ placeholder: e.target.value })}
            className="w-full bg-muted border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50"
          />
        </div>
      )}

      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1.5">Description</label>
        <textarea
          value={field.description}
          onChange={(e) => onChange({ description: e.target.value })}
          rows={2}
          placeholder="Help text shown below the field"
          className="w-full bg-muted border border-border rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-brand-500/50"
        />
      </div>

      {!isLayout && (
        <div className="flex items-center justify-between py-2 border-t border-border">
          <div>
            <p className="text-sm font-medium">Required</p>
            <p className="text-xs text-muted-foreground">Must be filled before submitting</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={field.is_required}
              onChange={(e) => onChange({ is_required: e.target.checked })}
              className="sr-only peer"
            />
            <div className="w-9 h-5 bg-muted rounded-full peer peer-checked:bg-brand-500 transition-colors relative after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-4" />
          </label>
        </div>
      )}

      {hasOptions && (
        <div className="border-t border-border pt-4">
          <label className="block text-xs font-medium text-muted-foreground mb-2">Options</label>
          <div className="space-y-2">
            {field.options.map((opt, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  type="text"
                  value={opt.label}
                  onChange={(e) => {
                    updateOption(i, 'label', e.target.value);
                    updateOption(i, 'value', fieldKeyFromLabel(e.target.value) + `_${i}`);
                  }}
                  placeholder={`Option ${i + 1}`}
                  className="flex-1 bg-muted border border-border rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50"
                />
                <button
                  onClick={() => removeOption(i)}
                  disabled={field.options.length <= 1}
                  className="w-7 h-7 rounded-lg hover:bg-red-500/10 hover:text-red-500 flex items-center justify-center disabled:opacity-30 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
            <button
              onClick={addOption}
              className="flex items-center gap-1.5 text-xs text-brand-500 hover:underline mt-1"
            >
              <Plus className="w-3.5 h-3.5" />
              Add option
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Builder Component ───────────────────────────────────────────────────

export function FormBuilderClient({ formId }: { formId: string }) {
  const router = useRouter();
  const utils = api.useUtils();

  const formQuery = api.forms.get.useQuery({ id: formId });

  const [fields, setFields] = useState<FormFieldLocal[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [formTitle, setFormTitle] = useState('');
  const [editingTitle, setEditingTitle] = useState(false);
  const [savedStatus, setSavedStatus] = useState<'saved' | 'unsaved' | 'saving'>('saved');

  // Sync from DB on load
  useEffect(() => {
    if (formQuery.data) {
      setFormTitle(formQuery.data.title);
      const loaded: FormFieldLocal[] = formQuery.data.fields.map((f) => ({
        id: f.id,
        localId: f.id,
        type: f.type as FieldType,
        label: f.label,
        placeholder: f.placeholder ?? '',
        description: f.description ?? '',
        field_key: f.field_key,
        is_required: f.is_required,
        is_hidden: f.is_hidden,
        sort_order: f.sort_order,
        options: Array.isArray(f.options) ? (f.options as unknown as FieldOption[]) : [],
        settings: (f.settings as Record<string, unknown>) ?? {},
      }));
      setFields(loaded);
    }
  }, [formQuery.data]);

  const updateFormMutation = api.forms.update.useMutation({
    onSuccess: () => void utils.forms.get.invalidate({ id: formId }),
    onError: (e) => toast.error(e.message),
  });

  const saveFieldsMutation = api.forms.fields.save.useMutation({
    onSuccess: () => {
      setSavedStatus('saved');
      void utils.forms.get.invalidate({ id: formId });
    },
    onError: (e) => {
      setSavedStatus('unsaved');
      toast.error(e.message);
    },
  });

  const publishMutation = api.forms.publish.useMutation({
    onSuccess: () => {
      toast.success('Form published successfully');
      void utils.forms.get.invalidate({ id: formId });
    },
    onError: (e) => toast.error(e.message),
  });

  const unpublishMutation = api.forms.unpublish.useMutation({
    onSuccess: () => {
      toast.success('Form unpublished');
      void utils.forms.get.invalidate({ id: formId });
    },
    onError: (e) => toast.error(e.message),
  });

  function addField(type: FieldType) {
    const newField = makeDefaultField(type, fields.length);
    setFields((prev) => [...prev, newField]);
    setSelectedId(newField.localId);
    setSavedStatus('unsaved');
  }

  function updateField(localId: string, updates: Partial<FormFieldLocal>) {
    setFields((prev) => prev.map((f) => (f.localId === localId ? { ...f, ...updates } : f)));
    setSavedStatus('unsaved');
  }

  function deleteField(localId: string) {
    setFields((prev) => prev.filter((f) => f.localId !== localId));
    if (selectedId === localId) setSelectedId(null);
    setSavedStatus('unsaved');
  }

  function moveField(localId: string, direction: 'up' | 'down') {
    setFields((prev) => {
      const idx = prev.findIndex((f) => f.localId === localId);
      if (idx < 0) return prev;
      const next = [...prev];
      const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= next.length) return prev;
      const tmp = next[idx]!;
      next[idx] = next[swapIdx]!;
      next[swapIdx] = tmp;
      return next.map((f, i) => ({ ...f, sort_order: i }));
    });
    setSavedStatus('unsaved');
  }

  function handleSave() {
    setSavedStatus('saving');
    // Save title if changed
    if (formTitle !== formQuery.data?.title) {
      updateFormMutation.mutate({ id: formId, title: formTitle });
    }
    // Save fields
    saveFieldsMutation.mutate({
      form_id: formId,
      fields: fields.map((f, i) => ({
        type: f.type,
        label: f.label || (FIELD_TYPES.find((ft) => ft.type === f.type)?.label ?? f.type),
        placeholder: f.placeholder || undefined,
        description: f.description || undefined,
        field_key: f.field_key || fieldKeyFromLabel(f.label) + `_${i}`,
        is_required: f.is_required,
        is_hidden: f.is_hidden,
        sort_order: i,
        options: f.options.length > 0 ? f.options : undefined,
        settings: f.settings,
      })),
    });
  }

  const selectedField = fields.find((f) => f.localId === selectedId) ?? null;
  const status = formQuery.data?.status ?? 'DRAFT';

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Top Bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-card border-b border-border flex-shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/forms')}
            className="w-8 h-8 rounded-lg hover:bg-muted flex items-center justify-center"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          {editingTitle ? (
            <input
              autoFocus
              type="text"
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
              onBlur={() => setEditingTitle(false)}
              onKeyDown={(e) => { if (e.key === 'Enter') setEditingTitle(false); }}
              className="text-sm font-semibold bg-muted border border-border rounded-lg px-2.5 py-1 focus:outline-none focus:ring-2 focus:ring-brand-500/50 min-w-40"
            />
          ) : (
            <button
              onClick={() => setEditingTitle(true)}
              className="text-sm font-semibold hover:text-brand-500 transition-colors"
            >
              {formTitle || 'Untitled Form'}
            </button>
          )}
          <span className={cn(
            'text-xs px-2 py-0.5 rounded-full font-medium',
            status === 'PUBLISHED' ? 'bg-green-500/10 text-green-600' :
            status === 'DRAFT' ? 'bg-gray-500/10 text-gray-500' :
            'bg-orange-500/10 text-orange-600'
          )}>
            {status}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {savedStatus === 'unsaved' && (
            <span className="text-xs text-amber-600 font-medium">Unsaved changes</span>
          )}
          {savedStatus === 'saving' && (
            <span className="text-xs text-muted-foreground">Saving…</span>
          )}
          {savedStatus === 'saved' && (
            <span className="text-xs text-green-600">Saved</span>
          )}
          {formQuery.data?.is_public && status === 'PUBLISHED' && (
            <a
              href={`/f/${formQuery.data.slug}`}
              target="_blank"
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border hover:bg-muted text-sm font-medium transition-colors"
            >
              <Eye className="w-4 h-4" />
              Preview
            </a>
          )}
          <button
            onClick={handleSave}
            disabled={saveFieldsMutation.isPending}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-muted hover:bg-muted/80 text-sm font-medium transition-colors disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            Save
          </button>
          {status === 'DRAFT' ? (
            <button
              onClick={() => {
                handleSave();
                setTimeout(() => publishMutation.mutate({ id: formId }), 600);
              }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium transition-colors"
            >
              <Globe className="w-4 h-4" />
              Publish
            </button>
          ) : (
            <button
              onClick={() => unpublishMutation.mutate({ id: formId })}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium transition-colors"
            >
              Unpublish
            </button>
          )}
        </div>
      </div>

      {/* Builder Body */}
      <div className="flex flex-1 min-h-0">
        {/* Left: Field Type Palette */}
        <div className="w-60 border-r border-border bg-card flex flex-col flex-shrink-0 overflow-y-auto">
          <div className="p-4 border-b border-border">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Add Fields</p>
          </div>
          <div className="p-3 flex-1">
            {FIELD_GROUPS.map((group) => (
              <div key={group} className="mb-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-3 mb-1">{group}</p>
                {FIELD_TYPES.filter((f) => f.group === group).map((def) => (
                  <FieldTypeButton
                    key={def.type}
                    def={def}
                    onClick={() => addField(def.type)}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* Center: Form Canvas */}
        <div className="flex-1 overflow-y-auto bg-muted/30 p-6">
          <div className="max-w-2xl mx-auto">
            {/* Form title preview */}
            <div className="bg-card border border-border rounded-2xl p-6 mb-4">
              <h2 className="text-xl font-bold">{formTitle || 'Untitled Form'}</h2>
              {formQuery.data?.description && (
                <p className="text-muted-foreground mt-1 text-sm">{formQuery.data.description}</p>
              )}
            </div>

            {/* Fields */}
            <div className="space-y-3">
              {fields.length === 0 ? (
                <div className="bg-card border-2 border-dashed border-border rounded-2xl p-12 text-center">
                  <Plus className="w-8 h-8 text-muted-foreground mx-auto mb-3 opacity-50" />
                  <p className="font-medium text-muted-foreground">No fields yet</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Click a field type on the left to add it here
                  </p>
                </div>
              ) : (
                fields.map((field, index) => (
                  <FieldCard
                    key={field.localId}
                    field={field}
                    isSelected={selectedId === field.localId}
                    onSelect={() => setSelectedId(selectedId === field.localId ? null : field.localId)}
                    onDelete={() => deleteField(field.localId)}
                    onMoveUp={() => moveField(field.localId, 'up')}
                    onMoveDown={() => moveField(field.localId, 'down')}
                    isFirst={index === 0}
                    isLast={index === fields.length - 1}
                  />
                ))
              )}
            </div>

            {/* Add field button */}
            <button
              onClick={() => addField('SHORT_TEXT')}
              className="mt-4 w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-border rounded-2xl text-sm text-muted-foreground hover:text-brand-500 hover:border-brand-500/50 hover:bg-brand-500/5 transition-all"
            >
              <Plus className="w-4 h-4" />
              Add Field
            </button>
          </div>
        </div>

        {/* Right: Properties Panel */}
        <div className="w-72 border-l border-border bg-card flex-shrink-0 overflow-y-auto">
          {selectedField ? (
            <div className="p-4">
              <FieldProperties
                field={selectedField}
                onChange={(updates) => updateField(selectedField.localId, updates)}
                onClose={() => setSelectedId(null)}
              />
            </div>
          ) : (
            <div className="p-6 flex flex-col items-center justify-center h-full text-center">
              <Settings className="w-8 h-8 text-muted-foreground/40 mb-3" />
              <p className="text-sm text-muted-foreground font-medium">Field Properties</p>
              <p className="text-xs text-muted-foreground mt-1">
                Click any field to edit its properties
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
