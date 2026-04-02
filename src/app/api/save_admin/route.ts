import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import type { RowDataPacket } from 'mysql2';

export async function POST(req: Request) {
  try {
    const p = await req.json();
    const name  = String(p.name ?? '').trim();
    const newId = String(p.login_id ?? '').trim().toLowerCase();
    const pw    = p.password ?? '';

    if (!name || !newId) return NextResponse.json({ ok: false, error: 'Name and login ID are required.' }, { status: 400 });
    if (!newId.endsWith('@deped.gov.ph')) return NextResponse.json({ ok: false, error: 'Login ID must use @deped.gov.ph domain.' }, { status: 400 });

    const [rows] = await pool.query<RowDataPacket[]>("SELECT * FROM admin_config WHERE role='admin' LIMIT 1");
    const row = (rows as RowDataPacket[])[0];
    if (row) {
      const finalPw = pw !== '' ? pw : row.password;
      await pool.query('UPDATE admin_config SET name=?, login_id=?, password=? WHERE id=?', [name, newId, finalPw, row.id]);
    } else {
      const finalPw = pw !== '' ? pw : 'admin123';
      await pool.query("INSERT INTO admin_config (login_id,password,name,role) VALUES (?,?,?,'admin')", [newId, finalPw, name]);
    }

    // Encoder section
    const encName = p.enc_name ?? '';
    const encId   = String(p.enc_login_id ?? '').toLowerCase();
    const encPw   = p.enc_password ?? '';

    if (encId && !encId.endsWith('@deped.gov.ph'))
      return NextResponse.json({ ok: false, error: 'Encoder Login ID must use @deped.gov.ph domain.' }, { status: 400 });

    const [encRows] = await pool.query<RowDataPacket[]>("SELECT * FROM admin_config WHERE role='encoder' LIMIT 1");
    const enc = (encRows as RowDataPacket[])[0];
    if (enc) {
      const updates: Record<string, string> = {};
      if (encName) updates.name     = encName;
      if (encId)   updates.login_id = encId;
      if (encPw)   updates.password = encPw;
      if (Object.keys(updates).length > 0) {
        const sets = Object.keys(updates).map(k => `\`${k}\`=?`).join(',');
        await pool.query(`UPDATE admin_config SET ${sets} WHERE id=?`, [...Object.values(updates), enc.id]);
      }
    } else if (encId) {
      const ePw = encPw || 'encoder123';
      await pool.query("INSERT INTO admin_config (login_id,password,name,role) VALUES (?,?,?,'encoder')", [encId, ePw, encName || 'Encoder']);
    }

    return NextResponse.json({ ok: true });
  } catch (e) { return NextResponse.json({ ok: false, error: String(e) }, { status: 500 }); }
}
