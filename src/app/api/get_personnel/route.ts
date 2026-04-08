import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { personnelRowToJs, rowToRecord } from '@/lib/recordToRow';
import type { RowDataPacket } from 'mysql2';

export async function GET() {
  try {
    // ── Fetch ALL personnel regardless of account_status ──────────────────
    // Inactive employees must still appear in the list (just marked inactive).
    // The UI is responsible for visually distinguishing inactive employees
    // and for blocking their login — not this query.
    const [personnelRows] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM personnel ORDER BY surname, given'
    );

    // ── Fetch ALL leave records in one query ──────────────────────────────
    const [recordRows] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM leave_records ORDER BY employee_id, sort_order ASC, record_id ASC'
    );

    // ── Group records by employee_id ──────────────────────────────────────
    const recordsByEmp: Record<string, ReturnType<typeof rowToRecord>[]> = {};
    for (const row of recordRows as RowDataPacket[]) {
      const empId = String(row.employee_id);
      if (!recordsByEmp[empId]) recordsByEmp[empId] = [];
      recordsByEmp[empId].push(rowToRecord(row as Record<string, unknown>));
    }

    // ── Attach records to each personnel ─────────────────────────────────
    const data = personnelRows.map(r => {
      const emp   = personnelRowToJs(r as Record<string, unknown>);
      const empId = String(emp.id);
      emp.records = recordsByEmp[empId] || [];
      return emp;
    });

    return NextResponse.json({ ok: true, data });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
