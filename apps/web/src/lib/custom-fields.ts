// Custom fields helper — uses existing CustomField model
// Fields: id, organization_id, module, entity_type, label, field_key, field_type, options, is_required, sort_order
// Values are stored as JSON on entity records (e.g., crm_contact.custom_fields)

export async function getCustomFieldDefinitions(
  prisma: any,
  orgId: string,
  module: string,
  entityType: string
) {
  return prisma.customField.findMany({
    where: { organization_id: orgId, module, entity_type: entityType },
    orderBy: { sort_order: "asc" },
  });
}

export async function getCustomFieldValues(
  prisma: any,
  entityType: string,
  entityId: string,
  orgId: string
) {
  // Custom field values are stored as JSON on entity records directly
  // This function retrieves definitions + entity's custom_fields JSON
  const definitions = await getCustomFieldDefinitions(
    prisma,
    orgId,
    entityType.split("_")[0] ?? entityType, // derive module from entity type
    entityType
  );

  // Return definitions with value = null (actual values live on entity record)
  return definitions.map((def: any) => ({
    ...def,
    value: null, // caller should merge with entity.custom_fields[def.field_key]
  }));
}

export async function setCustomFieldValue(
  prisma: any,
  params: {
    definitionId: string;
    entityId: string;
    entityModel: string; // prisma model name e.g. "crmContact"
    fieldKey: string;
    value: unknown;
  }
) {
  // Update entity's custom_fields JSON
  const entity = await (prisma[params.entityModel] as any).findUnique({
    where: { id: params.entityId },
    select: { custom_fields: true },
  });

  const existing = (entity?.custom_fields as Record<string, unknown>) ?? {};
  return (prisma[params.entityModel] as any).update({
    where: { id: params.entityId },
    data: {
      custom_fields: { ...existing, [params.fieldKey]: params.value },
    },
  });
}
