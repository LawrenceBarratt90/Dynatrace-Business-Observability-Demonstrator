import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useDqlQuery } from '@dynatrace-sdk/react-hooks';
import {
  ACCENT, ACCENT_BLUE, COMPANY, TIMEFRAMES,
  tfToDql, fmtNum, SectionBanner, HeroMetric, DqlTile,
  DASHBOARD_BG_STYLE, PULSE_KEYFRAME,
  useActiveRaceId, raceBase,
  type Timeframe, type TileDef,
} from './VCARBShared';

/* ═══════════════════════════════════════════════════════════════
   VCARB PRE-RACE SUB-DASHBOARD
   Steps 1-5: Freight, Car Setup, Practice, Qualifying, Race Prep
   ═══════════════════════════════════════════════════════════════ */

/* ── Dynatrace Linz Turn Timing Data ── */
const DYNATRACE_LINZ_TURNS = [
  { name: 'Voestalpine',      sector: 1, color: '#e10600', km: 0.8,  angle: 'Hard right, 92mph' },
  { name: 'Donau',            sector: 1, color: '#ff6b4a', km: 1.5,  angle: 'Right kink uphill' },
  { name: 'Pöstlingberg',     sector: 1, color: '#ff8c6a', km: 2.1,  angle: 'Fast left sweep' },
  { name: 'Stahlwerk',        sector: 2, color: '#1e90ff', km: 2.8,  angle: 'Hairpin right, 62mph' },
  { name: 'Lentos',           sector: 2, color: '#3498db', km: 3.4,  angle: 'Medium left downhill' },
  { name: 'Hauptplatz',       sector: 2, color: '#5dade2', km: 3.9,  angle: 'Double apex right' },
  { name: 'Bruckner',         sector: 3, color: '#00d4aa', km: 4.5,  angle: 'Left, 118mph' },
  { name: 'Ars Electronica',  sector: 3, color: '#27ae60', km: 5.0,  angle: 'Fast right sweep' },
  { name: 'Nibelungen',       sector: 3, color: '#2ecc71', km: 5.5,  angle: 'Final left, 145mph' },
];

function DynatraceLinzTurnTimingChart({ sectorData }: { sectorData: { s1: number; s2: number; s3: number } | null }) {
  const W = 1200, H = 400, PAD_L = 60, PAD_R = 40, PAD_T = 50, PAD_B = 70;
  const chartW = W - PAD_L - PAD_R;
  const chartH = H - PAD_T - PAD_B;
  const maxKm = 5.891;
  const turnTimes = useMemo(() => {
    if (!sectorData || (sectorData.s1 === 0 && sectorData.s2 === 0 && sectorData.s3 === 0)) return null;
    const totalLap = sectorData.s1 + sectorData.s2 + sectorData.s3;
    return DYNATRACE_LINZ_TURNS.map(t => {
      const sectorTime = t.sector === 1 ? sectorData.s1 : t.sector === 2 ? sectorData.s2 : sectorData.s3;
      const turnsInSector = DYNATRACE_LINZ_TURNS.filter(x => x.sector === t.sector).length;
      const baseShare = sectorTime / turnsInSector;
      const isHighSpeed = t.angle.includes('Fast') || t.angle.includes('Flat') || t.angle.includes('DRS');
      const multi = isHighSpeed ? 0.75 : (t.angle.includes('Slow') || t.angle.includes('Tight') || t.angle.includes('Hard')) ? 1.35 : 1.0;
      return { ...t, time: Math.round(baseShare * multi * 100) / 100, totalLap };
    });
  }, [sectorData]);
  if (!turnTimes) return <div style={{ height: H, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.3)' }}>Awaiting sector timing data...</div>;
  const maxTime = Math.max(...turnTimes.map(t => t.time));
  const minTime = Math.min(...turnTimes.map(t => t.time));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: '100%' }} preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id="stg-s1" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#e10600" stopOpacity="0.5"/><stop offset="100%" stopColor="#e10600" stopOpacity="0.05"/></linearGradient>
        <linearGradient id="stg-s2" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#1e90ff" stopOpacity="0.5"/><stop offset="100%" stopColor="#1e90ff" stopOpacity="0.05"/></linearGradient>
        <linearGradient id="stg-s3" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#00d4aa" stopOpacity="0.5"/><stop offset="100%" stopColor="#00d4aa" stopOpacity="0.05"/></linearGradient>
        <filter id="stg-glow"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      </defs>
      <rect width={W} height={H} fill="#080c18" rx="10"/>
      {[{ sector: 1, startIdx: 0, endIdx: 3, fill: 'url(#stg-s1)', label: 'SECTOR 1', color: '#e10600' }, { sector: 2, startIdx: 3, endIdx: 6, fill: 'url(#stg-s2)', label: 'SECTOR 2', color: '#1e90ff' }, { sector: 3, startIdx: 6, endIdx: 9, fill: 'url(#stg-s3)', label: 'SECTOR 3', color: '#00d4aa' }].map(s => {
        const spacing = chartW / DYNATRACE_LINZ_TURNS.length;
        const x1 = PAD_L + spacing * s.startIdx;
        const x2 = PAD_L + spacing * s.endIdx;
        return (<g key={s.sector}><rect x={x1} y={PAD_T} width={x2 - x1} height={chartH} fill={s.fill} opacity="0.15"/><text x={(x1 + x2) / 2} y={PAD_T - 10} textAnchor="middle" fill={s.color} fontSize="10" fontWeight="700" opacity="0.8" letterSpacing="1">{s.label}</text><line x1={x1} y1={PAD_T} x2={x1} y2={PAD_T + chartH} stroke={s.color} strokeWidth="1" opacity="0.3" strokeDasharray="4,4"/></g>);
      })}
      {[0, 0.25, 0.5, 0.75, 1].map(frac => { const y = PAD_T + chartH * (1 - frac); const val = minTime + (maxTime - minTime) * frac; return (<g key={frac}><line x1={PAD_L} y1={y} x2={W - PAD_R} y2={y} stroke="rgba(100,130,200,0.1)" strokeWidth="0.5"/><text x={PAD_L - 6} y={y + 3} textAnchor="end" fill="rgba(255,255,255,0.35)" fontSize="8">{val.toFixed(1)}s</text></g>); })}
      {turnTimes.map((t, i) => {
        const spacing = chartW / (DYNATRACE_LINZ_TURNS.length);
        const x = PAD_L + spacing * i + spacing / 2;
        const barH = ((t.time - minTime) / (maxTime - minTime || 1)) * chartH * 0.85 + chartH * 0.1;
        const barY = PAD_T + chartH - barH;
        const barW = Math.min(spacing * 0.65, 55);
        const isHigh = t.time >= maxTime * 0.9;
        return (<g key={i}><rect x={x - barW / 2} y={barY} width={barW} height={barH} rx="3" fill={t.color} opacity="0.75" filter={isHigh ? 'url(#stg-glow)' : undefined}/><text x={x} y={barY - 4} textAnchor="middle" fill="#fff" fontSize="9" fontWeight="700">{t.time.toFixed(2)}s</text><text x={x} y={PAD_T + chartH + 16} textAnchor="middle" fill={t.color} fontSize="8" fontWeight="600">{t.name}</text><text x={x} y={PAD_T + chartH + 28} textAnchor="middle" fill="rgba(255,255,255,0.3)" fontSize="6">{t.angle}</text><circle cx={x} cy={barY} r="3" fill="#fff" stroke={t.color} strokeWidth="1.5"/>{t.time === maxTime && <text x={x} y={barY - 16} textAnchor="middle" fill="#e74c3c" fontSize="8" fontWeight="700">▼ SLOWEST</text>}{t.time === minTime && <text x={x} y={barY - 16} textAnchor="middle" fill="#27ae60" fontSize="8" fontWeight="700">▲ FASTEST</text>}</g>);
      })}
      <polyline points={turnTimes.map((t, i) => { const spacing = chartW / DYNATRACE_LINZ_TURNS.length; const x = PAD_L + spacing * i + spacing / 2; const barH = ((t.time - minTime) / (maxTime - minTime || 1)) * chartH * 0.85 + chartH * 0.1; return `${x},${PAD_T + chartH - barH}`; }).join(' ')} fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" strokeDasharray="4,4"/>
      <text x={PAD_L} y={20} fill="#e0e4ff" fontSize="12" fontWeight="800" letterSpacing="0.5">DYNATRACE LINZ TURN-BY-TURN TIMING</text>
      <text x={PAD_L} y={32} fill="rgba(255,255,255,0.4)" fontSize="8">Estimated turn time from sector splits · {turnTimes[0]?.totalLap.toFixed(2)}s total lap</text>
      <text x={W / 2} y={H - 4} textAnchor="middle" fill="rgba(255,255,255,0.3)" fontSize="8">Circuit Position (miles)</text>
      <text x={12} y={H / 2} textAnchor="middle" fill="rgba(255,255,255,0.3)" fontSize="8" transform={`rotate(-90, 12, ${H / 2})`}>Time (sec)</text>
    </svg>
  );
}

/* ── Pre-Race Step Card ── */
const PRE_RACE_STEPS = [
  { step: 1, name: 'Freight & Garage Build', day: 'WED', icon: '📦', color: '#f5a623', desc: 'Equipment arrival, garage build, IT infrastructure setup' },
  { step: 2, name: 'Car Setup & Configuration', day: 'THU', icon: '🔧', color: '#1e90ff', desc: 'Chassis assembly, suspension geometry, ERS calibration' },
  { step: 3, name: 'Practice Sessions', day: 'FRI-SAT', icon: '📡', color: '#00d4aa', desc: 'FP1, FP2, FP3 — telemetry validation, tyre data collection' },
  { step: 4, name: 'Qualifying', day: 'SAT', icon: '⏱️', color: '#a78bfa', desc: 'Q1, Q2, Q3 — grid position determination' },
  { step: 5, name: 'Race Day Preparation', day: 'SUN AM', icon: '✅', color: '#ff6b9d', desc: 'Formation lap settings, strategy confirmation, fuel load' },
];

export function VCARBPreRace() {
  const { raceId, isLoading: raceIdLoading } = useActiveRaceId();
  const [timeframe, setTimeframe] = useState<Timeframe>('24h');
  const from = tfToDql(timeframe);
  const B = raceBase(raceId, from);

  /* ── Sector timing data ── */
  const { data: sectorData } = useDqlQuery({ body: { query: `${B}\n| filter isNotNull(additionalfields.sectorOneTimeSec)\n| summarize s1 = round(avg(toDouble(additionalfields.sectorOneTimeSec)), decimals:3), s2 = round(avg(toDouble(additionalfields.sectorTwoTimeSec)), decimals:3), s3 = round(avg(toDouble(additionalfields.sectorThreeTimeSec)), decimals:3)` } });
  const sectorTiming = useMemo(() => {
    if (!sectorData?.records?.length) return null;
    const r = sectorData.records[0]!;
    return { s1: Number(r['s1']) || 0, s2: Number(r['s2']) || 0, s3: Number(r['s3']) || 0 };
  }, [sectorData]);

  /* ── Pre-race step counts ── */
  const { data: stepCountData } = useDqlQuery({ body: { query: `${B}\n| summarize count = count(), by:{stepName = json.stepName}\n| sort count desc` } });
  const stepCounts = useMemo(() => {
    const m: Record<string, number> = {};
    if (!stepCountData?.records) return m;
    for (const r of stepCountData.records) {
      if (!r) continue;
      m[String(r['stepName'] || '')] = Number(r['count']) || 0;
    }
    return m;
  }, [stepCountData]);

  const tiles: (TileDef | { type: 'banner'; title: string; icon: string; accent: string })[] = [
    // ═══ COST CAP INTELLIGENCE ═══
    { type: 'banner', title: 'FIA COST CAP INTELLIGENCE — OPERATIONAL EFFICIENCY', icon: '💰', accent: '#ffd700' },
    { id: 'v-total-pre-ops', title: 'Total Pre-Race Ops', type: 'heroMetric', width: 1, icon: '📊', accent: '#ffd700',
      dql: `${B}\n| summarize ops = count()`, unit: 'ops', subtitle: 'Automated operations' },
    { id: 'v-automation-rate', title: 'Automation Rate', type: 'gauge', width: 1, icon: '🤖', accent: '#00d4aa',
      dql: `${B}\n| summarize total = count(), ok = countIf(json.hasError != true)\n| fieldsAdd rate = round(100.0 * toDouble(ok) / toDouble(total), decimals:1)`, gaugeMax: 100, subtitle: 'Ops without manual intervention' },
    { id: 'v-infra-util', title: 'Infrastructure Utilization', type: 'gauge', width: 1, icon: '🖥️', accent: '#a78bfa',
      dql: `${B}\n| filter isNotNull(additionalfields.sensorHealthPercent)\n| summarize util = round(avg(toDouble(additionalfields.sensorHealthPercent)), decimals:1)`, gaugeMax: 100, subtitle: 'Cloud workload efficiency' },
    { id: 'v-ops-by-step', title: 'Ops Volume by Step (Cost Allocation)', type: 'categoricalBar', width: 2, icon: '📈', accent: '#ffd700',
      dql: `${B}\n| summarize ops = count(), by:{step = json.stepName}\n| sort ops desc` },
    { id: 'v-error-waste', title: 'Error-Driven Waste', type: 'heroMetric', width: 1, icon: '⚠️', accent: '#e74c3c',
      dql: `${B}\n| summarize errors = countIf(json.hasError == true)`, unit: 'ops', subtitle: 'Errors = wasted budget' },

    // ═══ STEP 2: ERS & POWER UNIT ═══
    { type: 'banner', title: 'STEP 2 — CAR SETUP: ERS & POWER UNIT', icon: '⚡', accent: '#00d4aa' },
    { id: 'v-ers-charge', title: 'Avg ERS State of Charge', type: 'meterBar', width: 1, icon: '🔋', accent: '#00d4aa',
      dql: `${B}\n| summarize charge = round(avg(toDouble(additionalfields.ersStateOfChargePercent)), decimals:1)`, gaugeMax: 100, unit: '%', subtitle: 'Battery charge level' },
    { id: 'v-ers-deploy', title: 'Avg ERS Deploy', type: 'heroMetric', width: 1, icon: '⚡', accent: '#f5a623',
      dql: `${B}\n| summarize deploy = round(avg(toDouble(additionalfields.ersDeployKW)), decimals:0)`, unit: 'kW', subtitle: 'Max: 350kW' },
    { id: 'v-rpm', title: 'Avg Engine RPM', type: 'heroMetric', width: 1, icon: '🔴', accent: ACCENT,
      dql: `${B}\n| summarize rpm = round(avg(toDouble(additionalfields.engineRPM)), decimals:0)`, unit: 'RPM', subtitle: 'Red Bull Ford DM01' },
    { id: 'v-ers-trend', title: 'ERS Deploy vs Harvest Over Time', type: 'timeseries', width: 2, icon: '📊', accent: '#00d4aa',
      dql: `${B}\n| makeTimeseries deploy = avg(toDouble(additionalfields.ersDeployKW)), harvest = avg(toDouble(additionalfields.ersHarvestKW)), interval: 5m` },
    { id: 'v-engine-temp', title: 'Engine Temps Over Time', type: 'timeseries', width: 1, icon: '🌡️', accent: ACCENT,
      dql: `${B}\n| makeTimeseries coolant = avg(toDouble(additionalfields.engineTempCoolantC)), oil = avg(toDouble(additionalfields.engineTempOilC)), interval: 5m` },

    // ═══ STEP 3: TELEMETRY PIPELINE ═══
    { type: 'banner', title: 'STEP 3 — PRACTICE: TELEMETRY PIPELINE', icon: '📡', accent: '#a78bfa' },
    { id: 'v-latency', title: 'Avg Telemetry Latency', type: 'heroMetric', width: 1, icon: '📡', accent: '#a78bfa',
      dql: `${B}\n| summarize lat = round(avg(toDouble(additionalfields.telemetryLatencyMs)), decimals:1)`, unit: 'ms', subtitle: 'Target: <100ms' },
    { id: 'v-channels', title: 'Active Channels', type: 'heroMetric', width: 1, icon: '📊', accent: '#1e90ff',
      dql: `${B}\n| summarize ch = round(avg(toDouble(additionalfields.telemetryChannelsActive)), decimals:0)`, unit: 'ch', subtitle: 'Of 312 total' },
    { id: 'v-sensor-health', title: 'Sensor Health', type: 'gauge', width: 1, icon: '💚', accent: '#00d4aa',
      dql: `${B}\n| summarize health = round(avg(toDouble(additionalfields.sensorHealthPercent)), decimals:1)`, gaugeMax: 100, subtitle: 'Avg sensor uptime %' },
    { id: 'v-latency-trend', title: 'Telemetry Latency Over Time', type: 'timeseries', width: 2, icon: '📈', accent: '#a78bfa',
      dql: `${B}\n| makeTimeseries latency = avg(toDouble(additionalfields.telemetryLatencyMs)), interval: 5m` },
    { id: 'v-data-rate', title: 'Data Rate (Gbps)', type: 'heroMetric', width: 1, icon: '🔄', accent: '#00bcd4',
      dql: `${B}\n| summarize rate = round(avg(toDouble(additionalfields.dataRateGbps)), decimals:2)`, unit: 'Gbps', subtitle: 'Track-to-war-room' },

    // ═══ STEP 4: WEATHER ═══
    { type: 'banner', title: 'STEP 4 — QUALIFYING: WEATHER & TRACK CONDITIONS', icon: '🌤️', accent: '#00bcd4' },
    { id: 'v-track-temp', title: 'Avg Track Temp', type: 'heroMetric', width: 1, icon: '🌡️', accent: '#e67e22',
      dql: `${B}\n| summarize temp = round(avg(toDouble(additionalfields.trackTempC)), decimals:1)`, unit: '°C', subtitle: 'Surface temperature' },
    { id: 'v-ambient', title: 'Avg Ambient Temp', type: 'heroMetric', width: 1, icon: '☀️', accent: '#3498db',
      dql: `${B}\n| summarize temp = round(avg(toDouble(additionalfields.ambientTempC)), decimals:1)`, unit: '°C', subtitle: 'Air temperature' },
    { id: 'v-wind', title: 'Avg Wind Speed', type: 'heroMetric', width: 1, icon: '💨', accent: '#1abc9c',
      dql: `${B}\n| summarize wind = round(avg(toDouble(additionalfields.windSpeedMph)), decimals:1)`, unit: 'mph', subtitle: 'Cross-circuit avg' },
  ];

  return (
    <div style={DASHBOARD_BG_STYLE}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Link to="/vcarb" style={{ color: 'rgba(255,255,255,0.5)', textDecoration: 'none', fontSize: 13 }}>← Race Hub</Link>
          <div>
            <h1 style={{ margin: 0, fontSize: 'clamp(18px, 2.5vw, 24px)', fontWeight: 900, background: `linear-gradient(135deg, #f5a623, #a78bfa)`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              📦 Pre-Race Operations — Steps 1-5
            </h1>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginTop: 2 }}>
              Wednesday → Sunday Morning · Freight, Setup, Practice, Qualifying, Race Prep
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {TIMEFRAMES.map(tf => (
            <button key={tf} onClick={() => setTimeframe(tf)} style={{
              padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer',
              background: tf === timeframe ? '#a78bfa' : 'rgba(30,35,65,0.7)',
              color: tf === timeframe ? '#fff' : 'rgba(255,255,255,0.5)',
              border: tf === timeframe ? '1px solid #a78bfa' : '1px solid rgba(100,120,200,0.2)',
            }}>{tf}</button>
          ))}
        </div>
      </div>

      {/* Pre-Race Steps Status Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 140px), 1fr))', gap: 12, marginBottom: 20 }}>
        {PRE_RACE_STEPS.map(s => {
          const stepKeys = Object.keys(stepCounts);
          const matchKey = stepKeys.find(k => k.toLowerCase().includes(s.name.split(' ')[0].toLowerCase()));
          const count = matchKey ? stepCounts[matchKey] : 0;
          const isComplete = count > 0;
          return (
            <div key={s.step} style={{
              padding: 16, borderRadius: 12, textAlign: 'center',
              background: isComplete
                ? `linear-gradient(135deg, ${s.color}22, ${s.color}08)`
                : 'rgba(0,0,0,0.3)',
              border: isComplete ? `2px solid ${s.color}66` : '1px solid rgba(100,120,200,0.15)',
            }}>
              <div style={{ fontSize: 24 }}>{isComplete ? '✅' : s.icon}</div>
              <div style={{ fontSize: 10, fontWeight: 800, color: s.color, marginTop: 4 }}>STEP {s.step}</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#e0e4ff', marginTop: 2 }}>{s.name}</div>
              <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>{s.day}</div>
              <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', marginTop: 4, lineHeight: '1.3' }}>{s.desc}</div>
              {isComplete && (
                <div style={{ fontSize: 11, fontWeight: 700, color: '#00d4aa', marginTop: 6 }}>{fmtNum(count)} ops</div>
              )}
            </div>
          );
        })}
      </div>

      {/* Turn-by-Turn Timing Chart */}
      <div style={{
        marginBottom: 20, padding: 16,
        background: 'linear-gradient(135deg, rgba(20,22,40,0.85) 0%, rgba(30,32,55,0.75) 100%)',
        border: '1px solid rgba(100,120,200,0.18)', borderTop: '3px solid #f5a623', borderRadius: 14, minHeight: 340,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <span style={{ fontSize: 18 }}>📍</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#e0e4ff', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
            Step 3 — Practice: Turn-by-Turn Timing at Dynatrace Linz
          </span>
          <span style={{ marginLeft: 'auto', fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>
            {sectorTiming ? `S1: ${sectorTiming.s1}s · S2: ${sectorTiming.s2}s · S3: ${sectorTiming.s3}s` : 'Loading sectors...'}
          </span>
        </div>
        <DynatraceLinzTurnTimingChart sectorData={sectorTiming} />
      </div>

      {/* Tile Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', gap: 16 }}>
        {tiles.map((t, i) => {
          if (t.type === 'banner') return <SectionBanner key={`b-${i}`} title={t.title} icon={t.icon} accent={t.accent} />;
          return <DqlTile key={(t as TileDef).id} tile={t as TileDef} />;
        })}
      </div>

      <style>{PULSE_KEYFRAME}</style>
    </div>
  );
}
