import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { personnelRowToJs, rowToRecord } from '@/lib/recordToRow';
import type { RowDataPacket } from 'mysql2';

export async function GET() {
  try {
    // ── Fetch ALL personnel regardless of account_status ──────────────────
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

    // ── Attach records to each personnel ──────────────────────────────────
    const data = personnelRows.map(r => {
      const emp   = personnelRowToJs(r as Record<string, unknown>);
      const empId = String(emp.id);
      emp.records = recordsByEmp[empId] || [];
      return emp;
    });

    // ── Return with no-cache headers ──────────────────────────────────────
    // Prevents the browser from serving a stale 304 cached response,
    // which was causing only a partial employee list to be shown after login.
    return new NextResponse(JSON.stringify({ ok: true, data }), {
      status: 200,
      headers: {
        'Content-Type':  'application/json',
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma':        'no-cache',
        'Expires':       '0',
      },
    });

  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
