import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import type { RowDataPacket } from 'mysql2';

export async function GET() {
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      "SELECT * FROM admin_config WHERE role IN ('admin','encoder')"
    );
    const admin   = rows.find(r => r.role === 'admin');
    const encoder = rows.find(r => r.role === 'encoder');
    return NextResponse.json({
      ok: true,
      admin:   admin   ? { login_id: admin.login_id,   name: admin.name }   : null,
      encoder: encoder ? { login_id: encoder.login_id, name: encoder.name } : null,
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
