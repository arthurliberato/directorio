// Admin writes (SPEC §1: edit doctors, mark verification, toggle index status). Parameterized SQL only.
export type Run = (sql: string, params?: unknown[]) => Promise<any[]>;
export const INDEX_STATUSES = ['auto', 'force_index', 'force_noindex'] as const;

export async function setIndexStatus(run: Run, doctorId: number, status: string): Promise<void> {
  if (!(INDEX_STATUSES as readonly string[]).includes(status)) throw new Error(`invalid index_status: ${status}`);
  const rows = await run('update doctors set index_status = $1::index_status, updated_at = now() where id = $2 returning id', [status, doctorId]);
  if (!rows.length) throw new Error(`doctor ${doctorId} not found`);
}

/** Records a successful exequátur check: stamps the doctor and appends an auditable verification_log row. */
export async function markExequaturVerified(run: Run, doctorId: number, o: { checkedBy: string; method: string; result: string; evidenceHash: string }): Promise<void> {
  if (!o.checkedBy || !o.method || !/^[a-f0-9]{16,128}$/i.test(o.evidenceHash)) throw new Error('checkedBy, method and a hex evidenceHash are required');
  const rows = await run('update doctors set exequatur_verified_at = now(), data_verified_at = now(), updated_at = now() where id = $1 returning id', [doctorId]);
  if (!rows.length) throw new Error(`doctor ${doctorId} not found`);
  await run('insert into verification_log (doctor_id, type, method, result, evidence_hash, checked_by) values ($1, $2, $3, $4, $5, $6)', [doctorId, 'exequatur', o.method, o.result, o.evidenceHash, o.checkedBy]);
}
