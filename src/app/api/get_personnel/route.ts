import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { personnelRowToJs } from '@/lib/recordToRow';
import type { RowDataPacket } from 'mysql2';

export async function GET(req: NextRequest) {
  try {
    const archived = req.nextUrl.searchParams.get('archived') === '1';
    const status   = archived ? 'inactive' : 'active';
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM personnel WHERE account_status=? ORDER BY surname,given', [status]
    );
    const data = rows.map(r => personnelRowToJs(r as Record<string, unknown>));
    return NextResponse.json({ ok: true, data });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
