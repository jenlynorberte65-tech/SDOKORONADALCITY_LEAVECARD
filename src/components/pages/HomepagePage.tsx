'use client';
import { useMemo, useEffect, useRef } from 'react';
import { useAppStore } from '@/hooks/useAppStore';
import { isUpdatedThisMonth, currentMonthLabel } from '@/components/StatsRow';

interface Props {
  showLeaveStats?: boolean; // true for admin/encoder, false for school admin
}

export default function HomepagePage({ showLeaveStats = true }: Props) {
  const { state } = useAppStore();
  const aboutRef  = useRef<HTMLDivElement>(null);

  const active        = useMemo(() => state.db.filter(e => !e.archived), [state.db]);
  const teaching      = useMemo(() => active.filter(e => e.status === 'Teaching').length,     [active]);
  const nonTeaching   = useMemo(() => active.filter(e => e.status === 'Non-Teaching').length, [active]);
  const updatedCount  = useMemo(() => active.filter(e => isUpdatedThisMonth(e.lastEditedAt)).length, [active]);
  const pendingCount  = active.length - updatedCount;
  const monthLabel    = currentMonthLabel();

  // Intersection observer for scroll-reveal
  useEffect(() => {
    const els = document.querySelectorAll('.hp-reveal');
    const obs = new IntersectionObserver(entries => {
      entries.forEach(en => { if (en.isIntersecting) { (en.target as HTMLElement).style.opacity = '1'; (en.target as HTMLElement).style.transform = 'translateY(0)'; } });
    }, { threshold: 0.12 });
    els.forEach(el => obs.observe(el));
    return () => obs.disconnect();
  }, []);

  const roleName =
    state.role === 'admin'       ? (state.adminCfg.name       || 'Administrator') :
    state.role === 'encoder'     ? (state.encoderCfg.name     || 'Encoder')       :
    state.role === 'school_admin'? (state.schoolAdminCfg.name || 'School Admin')  : 'User';

  return (
    <div style={{ fontFamily: "'Georgia', 'Times New Roman', serif" }}>

      {/* ── Hero Banner ─────────────────────────────────────── */}
      <div style={{
        position: 'relative', overflow: 'hidden', borderRadius: 16, marginBottom: 28,
        background: 'linear-gradient(135deg, #0a1f5c 0%, #1e3a8a 40%, #1e40af 70%, #1d4ed8 100%)',
        boxShadow: '0 8px 32px rgba(10,31,92,0.25)',
        minHeight: 220,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '36px 48px',
        gap: 24,
      }}>
        {/* Decorative circles */}
        <div style={{ position:'absolute', top:-60, right:-60, width:260, height:260, borderRadius:'50%', background:'rgba(255,255,255,0.04)', pointerEvents:'none' }} />
        <div style={{ position:'absolute', bottom:-80, left:200, width:320, height:320, borderRadius:'50%', background:'rgba(255,255,255,0.03)', pointerEvents:'none' }} />
        <div style={{ position:'absolute', top:20, left:'38%', width:2, height:'80%', background:'rgba(255,255,255,0.08)', pointerEvents:'none' }} />

        {/* Left — DepEd logo + text */}
        <div style={{ display:'flex', alignItems:'center', gap:24, zIndex:1, flex:1 }}>
          {/* DepEd seal placeholder */}
          <div style={{
            width: 90, height: 90, borderRadius: '50%',
            background: 'radial-gradient(circle, #fbbf24, #f59e0b)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 38, flexShrink: 0,
            boxShadow: '0 0 0 4px rgba(251,191,36,0.3)',
          }}>🎓</div>
          <div>
            <div style={{ color:'rgba(255,255,255,0.7)', fontSize:11, letterSpacing:3, textTransform:'uppercase', marginBottom:4, fontFamily:"'Georgia',serif" }}>
              Republic of the Philippines
            </div>
            <div style={{ color:'#fff', fontSize:22, fontWeight:700, lineHeight:1.2, fontFamily:"'Georgia',serif" }}>
              Department of Education
            </div>
            <div style={{ color:'#fbbf24', fontSize:14, fontWeight:600, marginTop:4, fontFamily:"'Georgia',serif" }}>
              Schools Division of Koronadal City
            </div>
            <div style={{ color:'rgba(255,255,255,0.55)', fontSize:11, marginTop:6, fontFamily:"'Georgia',serif" }}>
              Leave Management Information System
            </div>
          </div>
        </div>

        {/* Right — Welcome message */}
        <div style={{ textAlign:'right', zIndex:1, flexShrink:0 }}>
          <div style={{ color:'rgba(255,255,255,0.6)', fontSize:11, letterSpacing:2, textTransform:'uppercase', marginBottom:6 }}>Welcome back</div>
          <div style={{ color:'#fff', fontSize:20, fontWeight:700, fontFamily:"'Georgia',serif" }}>{roleName}</div>
          <div style={{ color:'rgba(255,255,255,0.5)', fontSize:11, marginTop:8 }}>
            {new Date().toLocaleDateString('en-PH', { weekday:'long', year:'numeric', month:'long', day:'numeric' })}
          </div>
        </div>
      </div>

      {/* ── Stats Cards ─────────────────────────────────────── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: showLeaveStats
          ? 'repeat(auto-fit, minmax(170px, 1fr))'
          : 'repeat(3, 1fr)',
        gap: 16, marginBottom: 28,
      }}>
        <StatCard icon="👥" value={active.length}  label="Total Encoded" color="#1e3a8a" bg="#eff6ff" delay={0} />
        <StatCard icon="📚" value={teaching}        label="Teaching"      color="#065f46" bg="#ecfdf5" delay={80} />
        <StatCard icon="🏢" value={nonTeaching}     label="Non-Teaching"  color="#92400e" bg="#fffbeb" delay={160} />
        {showLeaveStats && <>
          <StatCard icon="✅" value={updatedCount} label={`Updated (${monthLabel})`} color="#065f46" bg="#d1fae5" delay={240} />
          <StatCard icon="⏳" value={pendingCount} label="Not Yet Updated"           color="#9b1c1c" bg="#fee2e2" delay={320} />
        </>}
      </div>

      {/* ── DepEd Division Photo Section ────────────────────── */}
      <div className="hp-reveal" style={{
        borderRadius: 14, overflow:'hidden', marginBottom: 28,
        boxShadow: '0 4px 24px rgba(0,0,0,0.10)',
        opacity: 0, transform: 'translateY(24px)',
        transition: 'opacity 0.6s ease, transform 0.6s ease',
      }}>
        <div style={{
          background: 'linear-gradient(135deg, #0a1f5c, #1e3a8a)',
          padding: '18px 28px',
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <span style={{ fontSize: 22 }}>🏫</span>
          <span style={{ color:'#fff', fontWeight:700, fontSize:15, fontFamily:"'Georgia',serif" }}>
            SDO Koronadal City — Division Office
          </span>
        </div>
        {/* Photo placeholder — replace src with actual image path */}
        <div style={{
          background: 'linear-gradient(160deg, #dbeafe 0%, #eff6ff 50%, #e0f2fe 100%)',
          minHeight: 280,
          display: 'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
          gap: 12, padding: 40,
        }}>
          <div style={{ fontSize: 64 }}>🏛️</div>
          <div style={{ fontWeight: 700, fontSize: 18, color: '#1e3a8a', fontFamily:"'Georgia',serif", textAlign:'center' }}>
            Schools Division Office of Koronadal City
          </div>
          <div style={{ color: '#3b82f6', fontSize: 12, textAlign:'center', maxWidth: 480, lineHeight: 1.7 }}>
            Committed to providing quality, accessible, relevant, and liberating basic education<br/>
            for every Filipino child. — DepEd Mission
          </div>
          <div style={{ marginTop: 8, padding: '6px 20px', background: '#1e3a8a', color:'#fff', borderRadius: 20, fontSize: 11, letterSpacing: 1 }}>
            Koronadal City, South Cotabato
          </div>
          {/* 
            To use a real photo, replace the content above with:
            <img src="/images/sdo-koronadal.jpg" alt="SDO Koronadal City" style={{ width:'100%', objectFit:'cover', maxHeight:320 }} />
          */}
        </div>
      </div>

      {/* ── About Us ────────────────────────────────────────── */}
      <div ref={aboutRef} className="hp-reveal" style={{
        borderRadius: 14, overflow:'hidden', marginBottom: 12,
        boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
        opacity: 0, transform: 'translateY(24px)',
        transition: 'opacity 0.7s ease 0.1s, transform 0.7s ease 0.1s',
      }}>
        <div style={{
          background: 'linear-gradient(135deg, #1e3a8a, #1d4ed8)',
          padding: '18px 28px',
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <span style={{ fontSize: 22 }}>👩‍💻</span>
          <span style={{ color:'#fff', fontWeight:700, fontSize:15, fontFamily:"'Georgia',serif" }}>About the Developers</span>
        </div>

        <div style={{ background:'#f8fafc', padding: '32px 36px' }}>
          <p style={{ color:'#475569', fontSize:13, lineHeight:1.8, textAlign:'center', marginBottom:28, fontStyle:'italic' }}>
            This Leave Management Information System was developed as a capstone project by the following students of
            <strong> STI College of Koronadal</strong>, taking up
            <strong> Bachelor of Science in Information Technology</strong>.
          </p>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20 }}>
            <DeveloperCard
              name="Jeoan Gwyneth Dajay Gran"
              contact="09127977245"
              location="Koronadal City"
              emoji="👩‍🎓"
              color="#1e3a8a"
              delay={0}
            />
            <DeveloperCard
              name="Janice Luis Laveros"
              contact="09531989302"
              location="Isulan, Sultan Kudarat"
              emoji="👩‍🎓"
              color="#065f46"
              delay={100}
            />
          </div>

          <div style={{ marginTop: 24, textAlign:'center', padding:'16px 0', borderTop:'1px solid #e2e8f0' }}>
            <div style={{ color:'#94a3b8', fontSize:11, letterSpacing:1, textTransform:'uppercase' }}>
              STI College of Koronadal · Bachelor of Science in Information Technology
            </div>
            <div style={{ color:'#cbd5e1', fontSize:10, marginTop:4 }}>
              © {new Date().getFullYear()} SDO Koronadal City Leave Management System
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────

function StatCard({ icon, value, label, color, bg, delay }: {
  icon: string; value: number; label: string;
  color: string; bg: string; delay: number;
}) {
  return (
    <div className="hp-reveal" style={{
      background: bg, borderRadius: 12, padding: '20px 24px',
      display: 'flex', alignItems: 'center', gap: 16,
      boxShadow: '0 2px 12px rgba(0,0,0,0.07)',
      border: `1.5px solid ${color}22`,
      opacity: 0, transform: 'translateY(16px)',
      transition: `opacity 0.5s ease ${delay}ms, transform 0.5s ease ${delay}ms`,
    }}>
      <div style={{
        width: 48, height: 48, borderRadius: 12, background: `${color}18`,
        display:'flex', alignItems:'center', justifyContent:'center', fontSize: 22, flexShrink:0,
      }}>{icon}</div>
      <div>
        <div style={{ fontSize: 28, fontWeight: 800, color, lineHeight: 1, fontFamily:"'Georgia',serif" }}>{value}</div>
        <div style={{ fontSize: 11, color: `${color}aa`, marginTop: 3, fontWeight: 600, letterSpacing: 0.5 }}>{label}</div>
      </div>
    </div>
  );
}

function DeveloperCard({ name, contact, location, emoji, color, delay }: {
  name: string; contact: string; location: string;
  emoji: string; color: string; delay: number;
}) {
  return (
    <div style={{
      background: '#fff', borderRadius: 12, padding: '24px',
      border: `1.5px solid ${color}22`,
      boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
      display: 'flex', flexDirection:'column', alignItems:'center', gap: 10,
      textAlign:'center',
    }}>
      <div style={{
        width: 64, height: 64, borderRadius: '50%',
        background: `linear-gradient(135deg, ${color}22, ${color}44)`,
        display:'flex', alignItems:'center', justifyContent:'center',
        fontSize: 30,
      }}>{emoji}</div>
      <div style={{ fontWeight: 700, fontSize: 14, color: '#1e293b', fontFamily:"'Georgia',serif", lineHeight:1.3 }}>{name}</div>
      <div style={{ display:'flex', flexDirection:'column', gap:4, width:'100%' }}>
        <div style={{
          display:'flex', alignItems:'center', justifyContent:'center', gap:6,
          background: `${color}0d`, borderRadius:8, padding:'6px 12px',
        }}>
          <span style={{ fontSize:13 }}>📞</span>
          <span style={{ fontSize:12, color, fontWeight:600, fontFamily:"'Courier New',monospace" }}>{contact}</span>
        </div>
        <div style={{
          display:'flex', alignItems:'center', justifyContent:'center', gap:6,
          background:'#f1f5f9', borderRadius:8, padding:'6px 12px',
        }}>
          <span style={{ fontSize:13 }}>📍</span>
          <span style={{ fontSize:12, color:'#475569', fontWeight:500 }}>{location}</span>
        </div>
      </div>
      <div style={{
        fontSize:10, color:`${color}99`, letterSpacing:0.5,
        padding:'4px 12px', background:`${color}0d`, borderRadius:20,
      }}>
        BS Information Technology
      </div>
    </div>
  );
}
