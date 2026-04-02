import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { recordToRow } from '@/lib/recordToRow';
import type { RowDataPacket } from 'mysql2';
import type { LeaveRecord } from '@/types';
import type { ResultSetHeader } from 'mysql2';

export async function POST(req: Request) {
  try {
    const { employee_id, record } = await req.json();
    const [maxRow] = await pool.query<RowDataPacket[]>(
      'SELECT COALESCE(MAX(sort_order),0) AS m FROM leave_records WHERE employee_id=?', [employee_id]
    );
    const sortOrder = Number((maxRow as RowDataPacket[])[0].m) + 1;
    const row  = recordToRow(record as LeaveRecord, employee_id, sortOrder);
    const cols = Object.keys(row).map(k => `\`${k}\``).join(',');
    const phs  = Object.keys(row).map(() => '?').join(',');
    const [result] = await pool.query<ResultSetHeader>(`INSERT INTO leave_records (${cols}) VALUES (${phs})`, Object.values(row));
    await pool.query('UPDATE personnel SET last_edited_at=? WHERE employee_id=?',
      [new Date().toISOString().slice(0,19).replace('T',' '), employee_id]);
    return NextResponse.json({ ok: true, record_id: result.insertId });
  } catch (e) { return NextResponse.json({ ok: false, error: String(e) }, { status: 500 }); }
}
