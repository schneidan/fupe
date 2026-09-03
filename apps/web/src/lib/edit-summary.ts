import type { ProposedEditData, QueueEdit } from '@/lib/api';

export function summarizeEdit(edit: QueueEdit): string {
  const p = edit.proposed_data;
  if (p.create_entity) {
    const ce = p.create_entity;
    let s = `New entity “${ce.name}” (${ce.type.replace(/_/g, ' ')})`;
    if (p.ownership?.parent_id) {
      s += ` → parent ${p.ownership.parent_id}`;
    } else if (p.new_parent) {
      s += ` → new parent “${p.new_parent.name}”`;
    }
    return s;
  }
  if (p.ownership?.parent_id) {
    return `Link parent ${p.ownership.parent_id}${
      p.ownership.percentage != null ? ` (${p.ownership.percentage}%)` : ''
    }`;
  }
  if (p.new_parent) {
    return `New parent “${p.new_parent.name}” (${p.new_parent.type.replace(/_/g, ' ')})`;
  }
  if (p.entity) {
    return `Update entity${p.entity.name ? `: ${p.entity.name}` : ''}`;
  }
  return 'Edit';
}

export function isNewEntityEdit(proposed: ProposedEditData): boolean {
  return Boolean(proposed.create_entity);
}
