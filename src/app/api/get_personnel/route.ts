import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { personnelRowToJs } from '@/lib/recordToRow';
import type { RowDataPacket } from 'mysql2';

export async function GET() {
  try {
    // ── Fetch ALL personnel only — no leave records ───────────────────────
    // Leave records are heavy and only needed when opening a specific
    // employee's leave card. They are fetched on-demand via get_records.
    // Loading all records here was causing "Out of Memory" browser crashes.
    const [personnelRows] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM personnel ORDER BY surname, given'
    );

    const data = personnelRows.map(r => {
      const emp = personnelRowToJs(r as Record<string, unknown>);
      emp.records = []; // ← always empty here; loaded on-demand per employee
      return emp;
    });

    // ── Return with no-cache headers ──────────────────────────────────────
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
