import { Pool } from 'pg';

export type AdminAuditAction =
  | 'tier_override'
  | 'user_update'
  | 'key_revoke'
  | 'ingest_resolve'
  | 'edit_review'
  | 'edit_reopen';

export async function writeAdminAudit(
  pool: Pool,
  params: {
    actorId: string | null;
    action: AdminAuditAction | string;
    targetType: string;
    targetId: string;
    previousState?: unknown;
    newState?: unknown;
    note?: string | null;
  },
): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO public.admin_audit_log
         (actor_id, action, target_type, target_id, previous_state, new_state, note)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7)`,
      [
        params.actorId,
        params.action,
        params.targetType,
        params.targetId,
        params.previousState != null
          ? JSON.stringify(params.previousState)
          : null,
        params.newState != null ? JSON.stringify(params.newState) : null,
        params.note ?? null,
      ],
    );
  } catch {
    // Audit must not fail the primary action.
  }
}
