import React, { useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useDqlQuery } from '@dynatrace-sdk/react-hooks';
import { BaseLayer, MapView } from '@dynatrace/strato-geo';
import {
  ACCENT, ACCENT_BLUE, COMPANY, LIVE_POLL_MS,
  tfToDql, fmtNum,
  DASHBOARD_BG_STYLE, PULSE_KEYFRAME,
  useActiveRaceId, raceBase,
  type Timeframe,
} from './VCARBShared';

/* ═══════════════════════════════════════════════════════════════
   VCARB RACE HUB — Parent Navigation Dashboard
   Linz geo-map, race weekend overview, links to
   Pre-Race (Steps 1-5) and Live Race (Steps 6-8) sub-dashboards
   ═══════════════════════════════════════════════════════════════ */

const RACE_SCHEDULE = [
  { step: 1, label: 'Freight & Garage Build', day: 'WED', color: '#f5a623', icon: '📦', group: 'pre' },
  { step: 2, label: 'Car Setup & Config',     day: 'THU', color: '#1e90ff', icon: '🔧', group: 'pre' },
  { step: 3, label: 'Practice Sessions',      day: 'FRI-SAT', color: '#00d4aa', icon: '📡', group: 'pre' },
  { step: 4, label: 'Qualifying',             day: 'SAT', color: '#a78bfa', icon: '⏱️', group: 'pre' },
  { step: 5, label: 'Race Day Preparation',   day: 'SUN AM', color: '#ff6b9d', icon: '✅', group: 'pre' },
  { step: 6, label: 'LINZ GRAND PRIX',         day: 'SUN 14:00', color: ACCENT, icon: '🏁', group: 'race' },
  { step: 7, label: 'Pit Stops',              day: 'IN RACE', color: '#ffd700', icon: '🔧', group: 'race' },
  { step: 8, label: 'Post-Race Debrief',      day: 'SUN EVE', color: '#00bcd4', icon: '📊', group: 'race' },
];

export function VCARBDashboard() {
  const { raceId, isLoading: raceIdLoading } = useActiveRaceId();
  const from = tfToDql('24h');
  const B = raceBase(raceId, from);

  /* ── Summary metrics ── */
  const { data: summaryData, refetch: refetchSummary } = useDqlQuery({ body: { query: `${B}\n| summarize totalOps = count(), errors = countIf(json.hasError == true), laps = max(toDouble(additionalfields.lapNumber)), avgLap = round(avg(toDouble(additionalfields.lapTimeSec)), decimals:2)` } });
  useEffect(() => { const id = setInterval(() => refetchSummary(), LIVE_POLL_MS); return () => clearInterval(id); }, [refetchSummary]);
  const summary = useMemo(() => {
    if (!summaryData?.records?.[0]) return { totalOps: 0, errors: 0, laps: 0, avgLap: 0 };
    const r = summaryData.records[0]!;
    return {
      totalOps: Number(r['totalOps']) || 0,
      errors: Number(r['errors']) || 0,
      laps: Math.min(Number(r['laps']) || 0, 52),
      avgLap: Number(r['avgLap']) || 0,
    };
  }, [summaryData]);

  /* ── Step counts ── */
  const { data: stepCountData, refetch: refetchStepCounts } = useDqlQuery({ body: { query: `${B}\n| summarize count = count(), by:{stepName = json.stepName}\n| sort count desc` } });
  useEffect(() => { const id = setInterval(() => refetchStepCounts(), LIVE_POLL_MS); return () => clearInterval(id); }, [refetchStepCounts]);
  const stepCounts = useMemo(() => {
    const m: Record<string, number> = {};
    if (!stepCountData?.records) return m;
    for (const r of stepCountData.records) {
      if (!r) continue;
      m[String(r['stepName'] || '')] = Number(r['count']) || 0;
    }
    return m;
  }, [stepCountData]);

  const totalStepOps = Object.values(stepCounts).reduce((a, b) => a + b, 0);

  /* ── Determine race day from data ── */
  const raceDayLabel = useMemo(() => {
    const hasRaceLaps = summary.laps > 0;
    const hasPreRace = Object.keys(stepCounts).some(k => k.includes('Freight') || k.includes('Setup') || k.includes('Practice'));
    if (hasRaceLaps) return 'RACE DAY — SUNDAY';
    if (hasPreRace) return 'PRE-RACE WEEKEND';
    return 'AWAITING RACE WEEKEND';
  }, [summary.laps, stepCounts]);

  return (
    <div style={DASHBOARD_BG_STYLE}>
      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Link to="/" style={{ color: 'rgba(255,255,255,0.5)', textDecoration: 'none', fontSize: 13 }}>← Home</Link>
          <div>
            <h1 style={{ margin: 0, fontSize: 'clamp(20px, 2.8vw, 28px)', fontWeight: 900, background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT_BLUE})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', letterSpacing: '-0.5px' }}>
              🏎️ 2026 Linz Grand Prix — Dynatrace Linz
            </h1>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginTop: 2 }}>
              Round 12 · Dynatrace Linz Circuit, Upper Austria · 52 Laps · 188.50 miles
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: ACCENT, animation: 'vcarb-pulse 1.5s ease-in-out infinite' }} />
          <span style={{ color: ACCENT, fontWeight: 700, fontSize: 12 }}>LIVE</span>
        </div>
      </div>

      {/* ═══ Geo Map + Race Day Indicator ═══ */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))', gap: 16, marginBottom: 20 }}>
        {/* Dynatrace Linz Location Map */}
        <div style={{
          borderRadius: 16, overflow: 'hidden',
          border: `2px solid ${ACCENT}33`,
          boxShadow: `0 0 40px ${ACCENT}10, 0 8px 32px rgba(0,0,0,0.3)`,
          position: 'relative', background: '#0a1628', height: 'clamp(280px, 30vw, 380px)',
        }}>
          <MapView
            initialViewState={{ longitude: 14.29, latitude: 48.30, zoom: 5 }}
            height={'100%'}
          >
            <BaseLayer include={['AT']} />
          </MapView>
          {/* Linz pin overlay */}
          <div style={{
            position: 'absolute', top: '48%', left: '52%', transform: 'translate(-50%, -50%)',
            display: 'flex', alignItems: 'center', gap: 10, pointerEvents: 'none',
          }}>
            <div style={{ position: 'relative' }}>
              <div style={{
                width: 22, height: 22, borderRadius: '50%', background: ACCENT,
                border: '3px solid #fff', boxShadow: `0 0 20px ${ACCENT}88, 0 0 60px ${ACCENT}44`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#fff' }} />
              </div>
              {/* Pulse ring */}
              <div style={{
                position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                width: 50, height: 50, borderRadius: '50%', border: `2px solid ${ACCENT}`,
                animation: 'vcarb-pulse-ring 2s ease-out infinite', opacity: 0,
              }} />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#fff', textShadow: '0 2px 8px rgba(0,0,0,0.8)' }}>DYNATRACE LINZ</div>
              <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.6)', textShadow: '0 1px 4px rgba(0,0,0,0.8)' }}>48.30°N · Upper Austria</div>
            </div>
          </div>
          {/* Overlay badge */}
          <div style={{
            position: 'absolute', top: 16, left: 16, padding: '10px 16px',
            background: 'rgba(0,0,0,0.75)', borderRadius: 10,
            border: `1px solid ${ACCENT}44`, backdropFilter: 'blur(8px)',
          }}>
            <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)', fontWeight: 700, letterSpacing: '1.5px' }}>CIRCUIT LOCATION</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#fff', marginTop: 2 }}>Dynatrace Linz, AT</div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>48.3069°N, 14.2858°E</div>
          </div>
          {/* Race day badge */}
          <div style={{
            position: 'absolute', bottom: 16, right: 16, padding: '8px 14px',
            background: `linear-gradient(135deg, ${ACCENT}cc, ${ACCENT}88)`,
            borderRadius: 8, border: '1px solid rgba(255,255,255,0.2)',
          }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#fff', letterSpacing: '1px' }}>{raceDayLabel}</div>
          </div>
        </div>

        {/* Race Quick Stats */}
        <div style={{
          padding: 20, borderRadius: 16,
          background: 'linear-gradient(135deg, rgba(225,6,0,0.12) 0%, rgba(20,22,40,0.95) 40%, rgba(30,35,65,0.9) 100%)',
          border: `2px solid ${ACCENT}33`, display: 'flex', flexDirection: 'column', gap: 12,
        }}>
          <div style={{ padding: '12px 16px', background: `linear-gradient(90deg, ${ACCENT}, ${ACCENT}88)`, borderRadius: 10, textAlign: 'center' }}>
            <div style={{ fontSize: 18, fontWeight: 900, color: '#fff', letterSpacing: '1px' }}>LINZ GP 2026</div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.8)' }}>Visa Cash App Racing Bulls</div>
          </div>
          {/* Driver cards */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div style={{ padding: 10, background: 'rgba(0,0,0,0.3)', borderRadius: 10, border: `1px solid ${ACCENT}33`, textAlign: 'center' }}>
              <div style={{ fontSize: 18, fontWeight: 900, color: ACCENT }}>#30</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#fff' }}>LAWSON</div>
              <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.4)' }}>🇳🇿 NZL</div>
            </div>
            <div style={{ padding: 10, background: 'rgba(0,0,0,0.3)', borderRadius: 10, border: `1px solid ${ACCENT_BLUE}33`, textAlign: 'center' }}>
              <div style={{ fontSize: 18, fontWeight: 900, color: ACCENT_BLUE }}>#41</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#fff' }}>LINDBLAD</div>
              <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.4)' }}>�🇹 AUT</div>
            </div>
          </div>
          {/* Summary metrics */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, flex: 1 }}>
            {[
              { label: 'Total Ops', value: fmtNum(summary.totalOps), color: ACCENT },
              { label: 'Laps Completed', value: `${summary.laps}/52`, color: '#ffd700' },
              { label: 'Avg Lap', value: summary.avgLap > 0 ? `${summary.avgLap}s` : '—', color: '#00d4aa' },
              { label: 'Error Rate', value: summary.totalOps > 0 ? `${((summary.errors / summary.totalOps) * 100).toFixed(1)}%` : '—', color: '#e74c3c' },
            ].map(m => (
              <div key={m.label} style={{ padding: 10, background: 'rgba(0,0,0,0.3)', borderRadius: 8, textAlign: 'center' }}>
                <div style={{ fontSize: 20, fontWeight: 900, color: '#fff' }}>{m.value}</div>
                <div style={{ fontSize: 9, color: m.color, fontWeight: 600, marginTop: 2 }}>{m.label}</div>
              </div>
            ))}
          </div>
          {/* Circuit specs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(60px, 1fr))', gap: 6, fontSize: 9 }}>
            {[
              { label: 'Length', val: '3.63 mi' },
              { label: 'Turns', val: '9' },
              { label: 'DRS', val: '1 zone' },
              { label: 'Record', val: '1:05.619' },
            ].map(s => (
              <div key={s.label} style={{ textAlign: 'center', padding: 4 }}>
                <div style={{ color: 'rgba(255,255,255,0.35)' }}>{s.label}</div>
                <div style={{ color: '#e0e4ff', fontWeight: 700 }}>{s.val}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ═══ DYNATRACE × VCARB VALUE FRAMEWORK — 3 Strategic Pillars ═══ */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.4)', letterSpacing: '1.5px', marginBottom: 12, paddingLeft: 4 }}>
          DYNATRACE × VCARB — ACCOUNT VALUE FRAMEWORK
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', gap: 14 }}>
          {/* Pillar 1: Win the Milliseconds Race */}
          <div style={{
            padding: 20, borderRadius: 14, position: 'relative', overflow: 'hidden',
            background: 'linear-gradient(135deg, rgba(225,6,0,0.10) 0%, rgba(20,22,40,0.95) 50%, rgba(30,32,55,0.9) 100%)',
            border: `1px solid ${ACCENT}44`, borderTop: `3px solid ${ACCENT}`,
          }}>
            <div style={{ fontSize: 9, fontWeight: 800, color: ACCENT, letterSpacing: '1.5px', marginBottom: 6 }}>OBJECTIVE 1</div>
            <div style={{ fontSize: 14, fontWeight: 900, color: '#fff', lineHeight: 1.3, marginBottom: 10 }}>Win the Milliseconds Race</div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', lineHeight: 1.5, marginBottom: 14 }}>
              Track, Factory & Fans — real-time telemetry, cloud simulations, digital fan platforms
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
              <div style={{ padding: 8, background: 'rgba(0,0,0,0.35)', borderRadius: 8, textAlign: 'center' }}>
                <div style={{ fontSize: 18, fontWeight: 900, color: '#fff' }}>&lt;50ms</div>
                <div style={{ fontSize: 8, color: ACCENT, fontWeight: 600 }}>Telemetry Latency</div>
              </div>
              <div style={{ padding: 8, background: 'rgba(0,0,0,0.35)', borderRadius: 8, textAlign: 'center' }}>
                <div style={{ fontSize: 18, fontWeight: 900, color: '#fff' }}>312</div>
                <div style={{ fontSize: 8, color: ACCENT, fontWeight: 600 }}>Live Channels</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {['AI Observability', 'Root Cause', 'Telemetry Correlation'].map(t => (
                <span key={t} style={{ fontSize: 8, padding: '3px 8px', borderRadius: 4, background: `${ACCENT}18`, border: `1px solid ${ACCENT}33`, color: ACCENT, fontWeight: 600 }}>{t}</span>
              ))}
            </div>
          </div>

          {/* Pillar 2: Cost-Capped Performance */}
          <div style={{
            padding: 20, borderRadius: 14, position: 'relative', overflow: 'hidden',
            background: 'linear-gradient(135deg, rgba(255,215,0,0.08) 0%, rgba(20,22,40,0.95) 50%, rgba(30,32,55,0.9) 100%)',
            border: '1px solid rgba(255,215,0,0.3)', borderTop: '3px solid #ffd700',
          }}>
            <div style={{ fontSize: 9, fontWeight: 800, color: '#ffd700', letterSpacing: '1.5px', marginBottom: 6 }}>OBJECTIVE 2</div>
            <div style={{ fontSize: 14, fontWeight: 900, color: '#fff', lineHeight: 1.3, marginBottom: 10 }}>Cost-Capped Performance</div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', lineHeight: 1.5, marginBottom: 14 }}>
              FIA cost cap compliance — cloud optimization, tool consolidation, operational automation
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
              <div style={{ padding: 8, background: 'rgba(0,0,0,0.35)', borderRadius: 8, textAlign: 'center' }}>
                <div style={{ fontSize: 18, fontWeight: 900, color: '#fff' }}>{fmtNum(summary.totalOps)}</div>
                <div style={{ fontSize: 8, color: '#ffd700', fontWeight: 600 }}>Ops Automated</div>
              </div>
              <div style={{ padding: 8, background: 'rgba(0,0,0,0.35)', borderRadius: 8, textAlign: 'center' }}>
                <div style={{ fontSize: 18, fontWeight: 900, color: '#fff' }}>1</div>
                <div style={{ fontSize: 8, color: '#ffd700', fontWeight: 600 }}>Unified Platform</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {['Usage Insights', 'Automation', 'Reduced Overhead'].map(t => (
                <span key={t} style={{ fontSize: 8, padding: '3px 8px', borderRadius: 4, background: 'rgba(255,215,0,0.1)', border: '1px solid rgba(255,215,0,0.25)', color: '#ffd700', fontWeight: 600 }}>{t}</span>
              ))}
            </div>
          </div>

          {/* Pillar 3: Trust Under Pressure */}
          <div style={{
            padding: 20, borderRadius: 14, position: 'relative', overflow: 'hidden',
            background: 'linear-gradient(135deg, rgba(0,212,170,0.08) 0%, rgba(20,22,40,0.95) 50%, rgba(30,32,55,0.9) 100%)',
            border: '1px solid rgba(0,212,170,0.3)', borderTop: '3px solid #00d4aa',
          }}>
            <div style={{ fontSize: 9, fontWeight: 800, color: '#00d4aa', letterSpacing: '1.5px', marginBottom: 6 }}>OBJECTIVE 3</div>
            <div style={{ fontSize: 14, fontWeight: 900, color: '#fff', lineHeight: 1.3, marginBottom: 10 }}>Trust Decisions Under Pressure</div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', lineHeight: 1.5, marginBottom: 14 }}>
              Explainable AI diagnostics, dependency mapping, race-day system confidence
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
              <div style={{ padding: 8, background: 'rgba(0,0,0,0.35)', borderRadius: 8, textAlign: 'center' }}>
                <div style={{ fontSize: 18, fontWeight: 900, color: '#fff' }}>{summary.totalOps > 0 ? `${(100 - (summary.errors / summary.totalOps) * 100).toFixed(1)}%` : '99.9%'}</div>
                <div style={{ fontSize: 8, color: '#00d4aa', fontWeight: 600 }}>System Availability</div>
              </div>
              <div style={{ padding: 8, background: 'rgba(0,0,0,0.35)', borderRadius: 8, textAlign: 'center' }}>
                <div style={{ fontSize: 18, fontWeight: 900, color: '#fff' }}>Causal AI</div>
                <div style={{ fontSize: 8, color: '#00d4aa', fontWeight: 600 }}>Root Cause Engine</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {['Explainable AI', 'Dependency Map', 'Rapid Resolution'].map(t => (
                <span key={t} style={{ fontSize: 8, padding: '3px 8px', borderRadius: 4, background: 'rgba(0,212,170,0.1)', border: '1px solid rgba(0,212,170,0.25)', color: '#00d4aa', fontWeight: 600 }}>{t}</span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ═══ Race Weekend Timeline ═══ */}
      <div style={{
        marginBottom: 20, padding: '14px 20px',
        background: 'rgba(20,22,40,0.6)', border: '1px solid rgba(100,120,200,0.15)', borderRadius: 12,
      }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.4)', letterSpacing: '1.5px', marginBottom: 10 }}>
          DYNATRACE LINZ RACE WEEKEND JOURNEY — 8 STEPS
        </div>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>
          {RACE_SCHEDULE.map((s, i, arr) => {
            const stepKeys = Object.keys(stepCounts);
            const matchKey = stepKeys.find(k => k.toLowerCase().includes(s.label.split(' ')[0].toLowerCase()));
            const count = matchKey ? stepCounts[matchKey] : 0;
            const isActive = count > 0;
            return (
              <React.Fragment key={s.step}>
                <div style={{
                  flex: s.step === 6 ? 1.5 : 1, padding: '8px 6px', borderRadius: 8, textAlign: 'center',
                  background: s.step === 6 ? `${ACCENT}22` : isActive ? `${s.color}15` : 'rgba(0,0,0,0.25)',
                  border: s.step === 6 ? `2px solid ${ACCENT}66` : isActive ? `1px solid ${s.color}44` : '1px solid rgba(100,120,200,0.1)',
                }}>
                  <div style={{ fontSize: 14 }}>{isActive ? '✅' : s.icon}</div>
                  <div style={{ fontSize: 9, fontWeight: 800, color: s.color, marginTop: 2 }}>STEP {s.step}</div>
                  <div style={{ fontSize: 8, fontWeight: 700, color: '#e0e4ff', marginTop: 1 }}>{s.label}</div>
                  <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.35)', marginTop: 1 }}>{s.day}</div>
                  {isActive && <div style={{ fontSize: 8, color: '#00d4aa', fontWeight: 700, marginTop: 2 }}>{fmtNum(count)}</div>}
                </div>
                {i < arr.length - 1 && <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)' }}>→</div>}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* ═══ Sub-Dashboard Navigation Cards ═══ */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: 20, marginBottom: 20 }}>
        {/* Pre-Race Card */}
        <Link to="/vcarb/pre-race" style={{ textDecoration: 'none' }}>
          <div style={{
            padding: 24, borderRadius: 16, cursor: 'pointer', transition: 'all 0.2s',
            background: 'linear-gradient(135deg, rgba(167,139,250,0.12) 0%, rgba(20,22,40,0.95) 50%, rgba(30,35,65,0.85) 100%)',
            border: '2px solid rgba(167,139,250,0.3)',
            boxShadow: '0 4px 24px rgba(0,0,0,0.3)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <span style={{ fontSize: 32 }}>📦</span>
              <div>
                <div style={{ fontSize: 18, fontWeight: 900, color: '#a78bfa', letterSpacing: '0.5px' }}>PRE-RACE OPERATIONS</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>Steps 1-5 · Wednesday → Sunday Morning</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {RACE_SCHEDULE.filter(s => s.group === 'pre').map(s => (
                <div key={s.step} style={{
                  padding: '4px 10px', borderRadius: 6, fontSize: 10, fontWeight: 600,
                  background: `${s.color}20`, border: `1px solid ${s.color}33`, color: s.color,
                }}>
                  {s.icon} {s.label}
                </div>
              ))}
            </div>
            <div style={{ marginTop: 12, display: 'flex', gap: 16 }}>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
                ERS · Telemetry · Weather · Turn Timing
              </div>
              <div style={{ marginLeft: 'auto', fontSize: 12, color: '#a78bfa', fontWeight: 700 }}>
                View Dashboard →
              </div>
            </div>
          </div>
        </Link>

        {/* Live Race Card */}
        <Link to="/vcarb/race" style={{ textDecoration: 'none' }}>
          <div style={{
            padding: 24, borderRadius: 16, cursor: 'pointer', transition: 'all 0.2s',
            background: `linear-gradient(135deg, ${ACCENT}15 0%, rgba(20,22,40,0.95) 50%, rgba(30,35,65,0.85) 100%)`,
            border: `2px solid ${ACCENT}44`,
            boxShadow: `0 4px 24px rgba(0,0,0,0.3), 0 0 30px ${ACCENT}08`,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <span style={{ fontSize: 32 }}>🏁</span>
              <div>
                <div style={{ fontSize: 18, fontWeight: 900, color: ACCENT, letterSpacing: '0.5px' }}>LIVE RACE</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>Steps 6-8 · Race · Pit Stops · Debrief</div>
              </div>
              {summary.laps > 0 && (
                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: ACCENT, animation: 'vcarb-pulse 1.5s ease-in-out infinite' }} />
                  <span style={{ color: ACCENT, fontWeight: 700, fontSize: 11 }}>LAP {summary.laps}/52</span>
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {RACE_SCHEDULE.filter(s => s.group === 'race').map(s => (
                <div key={s.step} style={{
                  padding: '4px 10px', borderRadius: 6, fontSize: 10, fontWeight: 600,
                  background: `${s.color}20`, border: `1px solid ${s.color}33`, color: s.color,
                }}>
                  {s.icon} {s.label}
                </div>
              ))}
            </div>
            <div style={{ marginTop: 12, display: 'flex', gap: 16 }}>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
                Lap Times · Tyres · Pit Stops · Circuit Map
              </div>
              <div style={{ marginLeft: 'auto', fontSize: 12, color: ACCENT, fontWeight: 700 }}>
                View Dashboard →
              </div>
            </div>
          </div>
        </Link>
      </div>

      {/* ═══ Operations Summary per Step ═══ */}
      {totalStepOps > 0 && (
        <div style={{
          padding: 16, borderRadius: 14,
          background: 'linear-gradient(135deg, rgba(20,22,40,0.85) 0%, rgba(30,32,55,0.75) 100%)',
          border: '1px solid rgba(100,120,200,0.18)',
        }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.4)', letterSpacing: '1.5px', marginBottom: 12 }}>
            OPERATIONS BY STEP — {fmtNum(totalStepOps)} TOTAL
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(80px, 1fr))', gap: 8 }}>
            {RACE_SCHEDULE.map(s => {
              const stepKeys = Object.keys(stepCounts);
              const matchKey = stepKeys.find(k => k.toLowerCase().includes(s.label.split(' ')[0].toLowerCase()));
              const count = matchKey ? stepCounts[matchKey] : 0;
              const pct = totalStepOps > 0 ? (count / totalStepOps) * 100 : 0;
              return (
                <div key={s.step} style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 20 }}>{s.icon}</div>
                  <div style={{ fontSize: 9, fontWeight: 700, color: s.color, marginTop: 4 }}>S{s.step}</div>
                  <div style={{ fontSize: 16, fontWeight: 900, color: count > 0 ? '#fff' : 'rgba(255,255,255,0.2)' }}>{fmtNum(count)}</div>
                  <div style={{ height: 4, borderRadius: 2, background: 'rgba(100,120,200,0.15)', marginTop: 4, overflow: 'hidden' }}>
                    <div style={{ height: '100%', borderRadius: 2, background: s.color, width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <style>{`${PULSE_KEYFRAME}\n@keyframes vcarb-pulse { 0%,100% { opacity:1 } 50% { opacity:0.3 } }\n@keyframes vcarb-pulse-ring { 0% { transform: translate(-50%,-50%) scale(1); opacity:0.7 } 100% { transform: translate(-50%,-50%) scale(2.5); opacity:0 } }`}</style>
    </div>
  );
}
