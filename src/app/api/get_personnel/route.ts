import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { personnelRowToJs, rowToRecord } from '@/lib/recordToRow';
import type { RowDataPacket } from 'mysql2';

export async function GET(req: NextRequest) {
  try {
    const archived = req.nextUrl.searchParams.get('archived') === '1';
    const status   = archived ? 'inactive' : 'active';

    // Fetch all personnel
    const [personnelRows] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM personnel WHERE account_status=? ORDER BY surname,given', [status]
    );

    // Fetch ALL leave records for all employees in one query
    const [recordRows] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM leave_records ORDER BY employee_id, sort_order ASC, record_id ASC'
    );

    // Group records by employee_id
    const recordsByEmp: Record<string, ReturnType<typeof rowToRecord>[]> = {};
    for (const row of recordRows as RowDataPacket[]) {
      const empId = String(row.employee_id);
      if (!recordsByEmp[empId]) recordsByEmp[empId] = [];
      recordsByEmp[empId].push(rowToRecord(row as Record<string, unknown>));
    }

    // Attach records to each personnel
    const data = personnelRows.map(r => {
      const emp = personnelRowToJs(r as Record<string, unknown>);
      const empId = String(emp.id);
      emp.records = recordsByEmp[empId] || [];
      return emp;
    });

    return NextResponse.json({ ok: true, data });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
