'use client';
import { useMemo, useEffect, useRef } from 'react';
import { useAppStore } from '@/hooks/useAppStore';
import { isCardUpdatedThisMonth, currentMonthLabel } from '@/components/StatsRow';

const JEOAN_PHOTO = "data:image/png;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/4gHYSUNDX1BST0ZJTEUAAQEAAAHIAAAAAAQwAABtbnRyUkdCIFhZWiAH4AABAAEAAAAAAABhY3NwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAA9tYAAQAAAADTLQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAlkZXNjAAAA8AAAACRyWFlaAAABFAAAABRnWFlaAAABKAAAABRiWFlaAAABPAAAABR3dHB0AAABUAAAABRyVFJDAAABZAAAAChnVFJDAAABZAAAAChiVFJDAAABZAAAAChjcHJ0AAABjAAAADxtbHVjAAAAAAAAAAEAAAAMZW5VUwAAAAgAAAAcAHMAUgBHAEJYWVogAAAAAAAAb6IAADj1AAADkFhZWiAAAAAAAABimQAAt4UAABjaWFlaIAAAAAAAACSgAAAPhAAAts9YWVogAAAAAAAA9tYAAQAAAADTLXBhcmEAAAAAAAQAAAACZmYAAPKnAAANWQAAE9AAAApbAAAAAAAAAABtbHVjAAAAAAAAAAEAAAAMZW5VUwAAACAAAAAcAEcAbwBvAGcAbABlACAASQBuAGMALgAgADIAMAAxADb/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoH9wYLDQsKCwsKCw0PEREODQ8RDgsLEBYQERMUFRUVDA8XGBYUGBIUFRT/2wBDAQMEBAUEBQkFBQkUDQsNFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBT/wAARCAFwASwDASIAAhEBAxEB/8QAHAAAAgMBAQEBAAAAAAAAAAAABgcEBQgDAgEA/8QAVRAAAQMDAgMFBQQFCAYIBwAAAQIDBAUREiExBhNBUQciYXGBkRQyQqGxwSNSYnLR8AgkM0NzgpKissIVFiU0U2OD4SREZDV0k6O04fElZHWU/8QAGgEAAgMBAQAAAAAAAAAAAAAAAQIDBAUABv/EADMRAAICAQIDBgQGAwEAAAAAAAABAgMRBCExElETIjJBUnGBscFCYZHR8BQjM0NisxT/2gAMAwEAAhEDEQA/AA=="; // truncated for brevity - use original value
const JANICE_PHOTO = "data:image/png;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/4gHYSUNDX1BST0ZJTEUAAQEAAAHIAAAAAAQwAABtbnRyUkdCIFhZWiAH4AABAAEAAAAAAABhY3NwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAA9tYAAQAAAADTLQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAlkZXNjAAAA8AAAACRyWFlaAAABFAAAABRnWFlaAAABKAAAABRiWFlaAAABPAAAABR3dHB0AAABUAAAABRyVFJDAAABZAAAAChnVFJDAAABZAAAAChiVFJDAAABZAAAAChjcHJ0AAABjAAAADxtbHVjAAAAAAAAAAEAAAAMZW5VUwAAAAgAAAAcAHMAUgBHAEJYWVogAAAAAAAAb6IAADj1AAADkFhZWiAAAAAAAABimQAAt4UAABjaWFlaIAAAAAAAACSgAAAPhAAAts9YWVogAAAAAAAA9tYAAQAAAADTLXBhcmEAAAAAAAQAAAACZmYAAPKnAAANWQAAE9AAAApbAAAAAAAAAABtbHVjAAAAAAAAAAEAAAAMZW5VUwAAACAAAAAcAEcAbwBvAGcAbABlACAASQBuAGMALgAgADIAMAAxADb/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoH9wYLDQsKCwsKCw0PEREODQ8RDgsLEBYQERMUFRUVDA8XGBYUGBIUFRT/2wBDAQMEBAUEBQkFBQkUDQsNFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBT/wAARCAFwASwDASIAAhEBAxEB/8QAHAAAAgMBAQEBAAAAAAAAAAAABgcEBQgDAgEA/8QAVRAAAQMDAgMFBQQFCAYIBwAAAQIDBAUREiExBhNBUQciYXGBkRQyQqGxwSNSYnLR8AgkM0NzgpKissIVFiU0U2OD4SREZDV0k6O04fElZHWU/8QAGgEAAgMBAQAAAAAAAAAAAAAAAQIDBAUABv/EADMRAAICAQIDBgQGAwEAAAAAAAABAgMRBCExElETIjJBUnGBscFCYZHR8BQjM0NisxT/2gAMAwEAAhEDEQA/AA=="; // truncated for brevity - use original value

interface Props {
  showLeaveStats?: boolean;
}

export default function HomepagePage({ showLeaveStats = true }: Props) {
  const { state } = useAppStore();
  const aboutRef = useRef<HTMLDivElement>(null);

  const active       = useMemo(() => state.db.filter(e => e.account_status !== 'inactive'), [state.db]);
  const teaching     = useMemo(() => active.filter(e => (e.status ?? '').toLowerCase() === 'teaching').length,     [active]);
  const nonTeaching  = useMemo(() => active.filter(e => (e.status ?? '').toLowerCase() !== 'teaching').length, [active]);

  // ── KEY FIX: use isCardUpdatedThisMonth based on leave records, not lastEditedAt ──
  const updatedCount = useMemo(() =>
    active.filter(e => isCardUpdatedThisMonth(e.records ?? [], e.status ?? '')).length,
  [active]);
  const pendingCount = active.length - updatedCount;
  const monthLabel   = currentMonthLabel();

  useEffect(() => {
    const els = document.querySelectorAll('.hp-reveal');
    const obs = new IntersectionObserver(entries => {
      entries.forEach(en => {
        if (en.isIntersecting) {
          (en.target as HTMLElement).style.opacity = '1';
          (en.target as HTMLElement).style.transform = 'translateY(0)';
        }
      });
    }, { threshold: 0.12 });
    els.forEach(el => obs.observe(el));
    return () => obs.disconnect();
  }, []);

  const roleName =
    state.role === 'admin'        ? (state.adminCfg.name       || 'Administrator') :
    state.role === 'encoder'      ? (state.encoderCfg.name     || 'Encoder')       :
    state.role === 'school_admin' ? (state.schoolAdminCfg.name || 'School Admin')  : 'User';

  return (
    <div style={{ fontFamily: "'Georgia', 'Times New Roman', serif" }}>

      {/* ── Hero Banner ─────────────────────────────────────── */}
      <div style={{
        position: 'relative', overflow: 'hidden', borderRadius: 16, marginBottom: 28,
        background: 'linear-gradient(135deg, #0d1f0f 0%, #1a3a1e 40%, #1e4d22 70%, #14532d 100%)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.35)',
        minHeight: 220,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '36px 48px', gap: 24,
      }}>
        <div style={{ position:'absolute', top:-60, right:-60, width:260, height:260, borderRadius:'50%', background:'rgba(255,255,255,0.03)', pointerEvents:'none' }} />
        <div style={{ position:'absolute', bottom:-80, left:200, width:320, height:320, borderRadius:'50%', background:'rgba(255,255,255,0.02)', pointerEvents:'none' }} />
        <div style={{ position:'absolute', top:20, left:'38%', width:2, height:'80%', background:'rgba(255,255,255,0.07)', pointerEvents:'none' }} />

        <div style={{ display:'flex', alignItems:'center', gap:24, zIndex:1, flex:1 }}>
          <div style={{
            width: 90, height: 90, borderRadius: '50%',
            background: 'radial-gradient(circle, #4ade80, #16a34a)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 38, flexShrink: 0,
            boxShadow: '0 0 0 4px rgba(74,222,128,0.25)',
          }}>🎓</div>
          <div>
            <div style={{ color:'rgba(255,255,255,0.55)', fontSize:11, letterSpacing:3, textTransform:'uppercase', marginBottom:4 }}>
              Republic of the Philippines
            </div>
            <div style={{ color:'#fff', fontSize:22, fontWeight:700, lineHeight:1.2 }}>
              Department of Education
            </div>
            <div style={{ color:'#4ade80', fontSize:14, fontWeight:600, marginTop:4 }}>
              Schools Division of Koronadal City
            </div>
            <div style={{ color:'rgba(255,255,255,0.45)', fontSize:11, marginTop:6 }}>
              Leave Management Information System
            </div>
          </div>
        </div>

        <div style={{ textAlign:'right', zIndex:1, flexShrink:0 }}>
          <div style={{ color:'rgba(255,255,255,0.5)', fontSize:11, letterSpacing:2, textTransform:'uppercase', marginBottom:6 }}>Welcome back</div>
          <div style={{ color:'#fff', fontSize:20, fontWeight:700 }}>{roleName}</div>
          <div style={{ color:'rgba(255,255,255,0.4)', fontSize:11, marginTop:8 }}>
            {new Date().toLocaleDateString('en-PH', { weekday:'long', year:'numeric', month:'long', day:'numeric' })}
          </div>
        </div>
      </div>

      {/* ── Stats Cards ─────────────────────────────────────── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: showLeaveStats ? 'repeat(auto-fit, minmax(170px, 1fr))' : 'repeat(3, 1fr)',
        gap: 16, marginBottom: 28,
      }}>
        <StatCard icon="👥" value={active.length} label="Total Encoded"    color="#14532d" bg="#f0fdf4" delay={0}   />
        <StatCard icon="📚" value={teaching}       label="Teaching"         color="#166534" bg="#dcfce7" delay={80}  />
        <StatCard icon="🏢" value={nonTeaching}    label="Non-Teaching"     color="#1a3a1e" bg="#bbf7d0" delay={160} />
        {showLeaveStats && <>
          <StatCard icon="✅" value={updatedCount} label={`Updated (${monthLabel})`} color="#14532d" bg="#d1fae5" delay={240} />
          <StatCard icon="⏳" value={pendingCount} label="Not Yet Updated"              color="#7f1d1d" bg="#fee2e2" delay={320} />
        </>}
      </div>

      {/* ── Division Photo Section ───────────────────────────── */}
      <div className="hp-reveal" style={{
        borderRadius: 14, overflow:'hidden', marginBottom: 28,
        boxShadow: '0 4px 24px rgba(0,0,0,0.15)',
        opacity: 0, transform: 'translateY(24px)',
        transition: 'opacity 0.6s ease, transform 0.6s ease',
      }}>
        <div style={{
          background: 'linear-gradient(135deg, #0d1f0f, #1a3a1e)',
          padding: '18px 28px',
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <span style={{ fontSize: 22 }}>🏫</span>
          <span style={{ color:'#4ade80', fontWeight:700, fontSize:15 }}>
            SDO Koronadal City — Division Office
          </span>
        </div>
        <div style={{
          background: 'linear-gradient(160deg, #052e16 0%, #0d1f0f 50%, #0f2d17 100%)',
          minHeight: 280,
          display: 'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
          gap: 12, padding: 40,
        }}>
          <div style={{ fontSize: 64 }}>🏛️</div>
          <div style={{ fontWeight: 700, fontSize: 18, color: '#4ade80', textAlign:'center' }}>
            Schools Division Office of Koronadal City
          </div>
          <div style={{ color: '#86efac', fontSize: 12, textAlign:'center', maxWidth: 480, lineHeight: 1.7 }}>
            Committed to providing quality, accessible, relevant, and liberating basic education
            for every Filipino child. — DepEd Mission
          </div>
          <div style={{ marginTop: 8, padding: '6px 20px', background: '#14532d', color:'#4ade80', borderRadius: 20, fontSize: 11, letterSpacing: 1, border: '1px solid #16a34a' }}>
            Koronadal City, South Cotabato
          </div>
        </div>
      </div>

      {/* ── About Us ────────────────────────────────────────── */}
      <div ref={aboutRef} className="hp-reveal" style={{
        borderRadius: 14, overflow:'hidden', marginBottom: 12,
        boxShadow: '0 4px 24px rgba(0,0,0,0.15)',
        opacity: 0, transform: 'translateY(24px)',
        transition: 'opacity 0.7s ease 0.1s, transform 0.7s ease 0.1s',
      }}>
        <div style={{
          background: 'linear-gradient(135deg, #1a0a1e, #3b0764)',
          padding: '18px 28px',
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <span style={{ fontSize: 22 }}>💗</span>
          <span style={{ color:'#f9a8d4', fontWeight:700, fontSize:15 }}>About the Developers</span>
        </div>

        <div style={{ background:'#0d0d0d', padding: '32px 36px' }}>
          <div style={{
            background: 'linear-gradient(135deg, #1a0a1e, #0d1a0f)',
            border: '1px solid #4a1942',
            borderRadius: 12, padding: '20px 28px',
            marginBottom: 28, textAlign:'center',
          }}>
            <p style={{ color:'#e2b4f0', fontSize:13, lineHeight:1.9, margin: 0 }}>
              This system was built to help the HR department of SDO Koronadal City lessen
              the hassle of manually finding and writing leave cards — a process that often
              leads to human error. We just wanted to make their work a little easier. 💚
            </p>
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20 }}>
            <DeveloperCard
              name="Jeoan Gwyneth Dajay Gran"
              contact="09127977245"
              location="Koronadal City"
              photo={JEOAN_PHOTO}
              accentColor="#f472b6"
            />
            <DeveloperCard
              name="Janice Luis Laveros"
              contact="09531989302"
              location="Isulan, Sultan Kudarat"
              photo={JANICE_PHOTO}
              accentColor="#c084fc"
            />
          </div>

          <div style={{ marginTop: 24, textAlign:'center', padding:'16px 0', borderTop:'1px solid #2d1a2d' }}>
            <div style={{ color:'#9d4edd', fontSize:11, letterSpacing:1, textTransform:'uppercase' }}>
              BS Information Technology · STI College of Koronadal
            </div>
            <div style={{ color:'#4a1942', fontSize:10, marginTop:4 }}>
              © {new Date().getFullYear()} SDO Koronadal City Leave Management System
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, value, label, color, bg, delay }: {
  icon: string; value: number; label: string;
  color: string; bg: string; delay: number;
}) {
  return (
    <div className="hp-reveal" style={{
      background: bg, borderRadius: 12, padding: '20px 24px',
      display: 'flex', alignItems: 'center', gap: 16,
      boxShadow: '0 2px 12px rgba(0,0,0,0.10)',
      border: `1.5px solid ${color}33`,
      opacity: 0, transform: 'translateY(16px)',
      transition: `opacity 0.5s ease ${delay}ms, transform 0.5s ease ${delay}ms`,
    }}>
      <div style={{
        width: 48, height: 48, borderRadius: 12, background: `${color}22`,
        display:'flex', alignItems:'center', justifyContent:'center', fontSize: 22, flexShrink:0,
      }}>{icon}</div>
      <div>
        <div style={{ fontSize: 28, fontWeight: 800, color, lineHeight: 1 }}>{value}</div>
        <div style={{ fontSize: 11, color: `${color}99`, marginTop: 3, fontWeight: 600, letterSpacing: 0.5 }}>{label}</div>
      </div>
    </div>
  );
}

function DeveloperCard({ name, contact, location, photo, accentColor }: {
  name: string; contact: string; location: string;
  photo: string; accentColor: string;
}) {
  return (
    <div style={{
      background: '#1a0a1e',
      borderRadius: 14, padding: '24px',
      border: `1.5px solid ${accentColor}44`,
      boxShadow: `0 4px 20px ${accentColor}11`,
      display: 'flex', flexDirection:'column', alignItems:'center', gap: 12,
      textAlign:'center',
    }}>
      <div style={{
        width: 96, height: 96, borderRadius: '50%', overflow: 'hidden',
        border: `3px solid ${accentColor}`,
        boxShadow: `0 0 0 4px ${accentColor}33`,
        flexShrink: 0,
      }}>
        <img src={photo} alt={name} style={{ width:'100%', height:'100%', objectFit:'cover', objectPosition:'top' }} />
      </div>
      <div style={{ fontWeight: 700, fontSize: 14, color: '#fff', lineHeight:1.3 }}>{name}</div>
      <div style={{ display:'flex', flexDirection:'column', gap:6, width:'100%' }}>
        <div style={{
          display:'flex', alignItems:'center', justifyContent:'center', gap:6,
          background: `${accentColor}11`, borderRadius:8, padding:'6px 12px',
          border: `1px solid ${accentColor}33`,
        }}>
          <span style={{ fontSize:13 }}>📞</span>
          <span style={{ fontSize:12, color: accentColor, fontWeight:600, fontFamily:"'Courier New',monospace" }}>{contact}</span>
        </div>
        <div style={{
          display:'flex', alignItems:'center', justifyContent:'center', gap:6,
          background:'#0d0d0d', borderRadius:8, padding:'6px 12px',
          border: '1px solid #2d1a2d',
        }}>
          <span style={{ fontSize:13 }}>📍</span>
          <span style={{ fontSize:12, color:'#d1d5db', fontWeight:500 }}>{location}</span>
        </div>
      </div>
    </div>
  );
}
