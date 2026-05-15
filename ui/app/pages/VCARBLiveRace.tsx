import React, { useState, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useDqlQuery } from '@dynatrace-sdk/react-hooks';
import {
  ACCENT, ACCENT_BLUE, COMPANY, TIMEFRAMES, LIVE_POLL_MS,
  tfToDql, fmtNum, SectionBanner, HeroMetric, DqlTile,
  DASHBOARD_BG_STYLE, PULSE_KEYFRAME,
  useActiveRaceId, raceBase,
  type Timeframe, type TileDef,
} from './VCARBShared';


/* ═══════════════════════════════════════════════════════════════
   VCARB LIVE RACE SUB-DASHBOARD
   Steps 6-8: Race, Pit Stops, Post-Race Debrief
   ═══════════════════════════════════════════════════════════════ */

/* ── Dynatrace Linz Circuit — Fictional GP Track with Animated Cars ── */
function DynatraceLinzCircuitMap({ stepMetrics }: { stepMetrics: Record<string, { count: number; errors: number }> }) {
  /*
   * Dynatrace Linz Grand Prix Circuit — fictional 9-turn layout.
   * Clockwise from start/finish straight (bottom):
   *   Donau Straight → T1 Voestalpine → T2 Donau → T3 Pöstlingberg →
   *   T4 Stahlwerk (hairpin) → T5 Lentos → T6 Hauptplatz →
   *   T7 Bruckner → T8 Ars Electronica → T9 Nibelungen → Start
   */
  const trackPath = [
    'M 300,350',                      // Start/Finish line
    'L 530,350',                      // Donau Straight →
    'C 565,350 590,338 605,310',      // T1 Voestalpine — hard right
    'C 618,285 625,258 620,228',      // Climbing up
    'C 615,198 605,170 585,148',      // T2 Donau — right kink uphill
    'C 565,126 540,108 510,95',       // T3 Pöstlingberg — fast left sweeper
    'L 420,75',                        // Back straight segment
    'C 390,68 365,68 345,80',         // T4 Stahlwerk hairpin entry
    'C 322,95 315,118 320,142',       // T4 hairpin apex & exit
    'C 325,168 320,195 305,218',      // T5 Lentos — medium left
    'C 290,242 270,262 250,278',      // T6 Hauptplatz — double apex right
    'C 228,296 210,314 200,332',      // T7 Bruckner — left
    'C 188,352 185,368 195,378',      // T8 Ars Electronica — right sweeper
    'C 210,390 235,385 258,372',      // T9 Nibelungen — final left
    'C 275,362 288,355 300,350 Z',    // Back to start
  ].join(' ');

  /* Sector segments */
  const sector1 = [
    'M 300,350 L 530,350',
    'C 565,350 590,338 605,310',
    'C 618,285 625,258 620,228',
    'C 615,198 605,170 585,148',
    'C 565,126 540,108 510,95',
  ].join(' ');

  const sector2 = [
    'M 510,95 L 420,75',
    'C 390,68 365,68 345,80',
    'C 322,95 315,118 320,142',
    'C 325,168 320,195 305,218',
    'C 290,242 270,262 250,278',
  ].join(' ');

  const sector3 = [
    'M 250,278',
    'C 228,296 210,314 200,332',
    'C 188,352 185,368 195,378',
    'C 210,390 235,385 258,372',
    'C 275,362 288,355 300,350',
  ].join(' ');

  /* Turn markers */
  const turns: { n: string; x: number; y: number }[] = [
    { n: '1', x: 608, y: 312 },   // T1 Voestalpine
    { n: '2', x: 622, y: 225 },   // T2 Donau
    { n: '3', x: 555, y: 118 },   // T3 Pöstlingberg
    { n: '4', x: 342, y: 78 },    // T4 Stahlwerk
    { n: '5', x: 310, y: 220 },   // T5 Lentos
    { n: '6', x: 248, y: 280 },   // T6 Hauptplatz
    { n: '7', x: 198, y: 335 },   // T7 Bruckner
    { n: '8', x: 190, y: 378 },   // T8 Ars Electronica
    { n: '9', x: 262, y: 370 },   // T9 Nibelungen
  ];

  /* Race step markers — positioned inside the circuit */
  const ops = [
    { label: 'RACE',      x: 470, y: 230, color: '#e10600', step: 6 },
    { label: 'PIT STOPS', x: 370, y: 320, color: '#ffd700', step: 7 },
    { label: 'DEBRIEF',   x: 420, y: 145, color: '#00bcd4', step: 8 },
  ];

  return (
    <div style={{ width: '100%' }}>
      <svg viewBox="140 30 540 390" style={{ width: '100%', height: 'auto', maxHeight: 380, display: 'block' }} preserveAspectRatio="xMidYMid meet">
        <defs>
          <filter id="carGlow"><feGaussianBlur stdDeviation="4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
          <filter id="secGlow"><feGaussianBlur stdDeviation="2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        </defs>

        {/* ── Track surface (3-layer for depth) ── */}
        <path d={trackPath} fill="none" stroke="#262945" strokeWidth="26" strokeLinecap="round" strokeLinejoin="round"/>
        <path d={trackPath} fill="none" stroke="#1e2038" strokeWidth="20" strokeLinecap="round" strokeLinejoin="round"/>
        <path d={trackPath} fill="none" stroke="#161830" strokeWidth="14" strokeLinecap="round" strokeLinejoin="round"/>

        {/* ── Sector colour overlays ── */}
        <path d={sector1} fill="none" stroke="#e10600" strokeWidth="5" strokeLinecap="round" filter="url(#secGlow)" opacity="0.85"/>
        <path d={sector2} fill="none" stroke="#00d4ff" strokeWidth="5" strokeLinecap="round" filter="url(#secGlow)" opacity="0.85"/>
        <path d={sector3} fill="none" stroke="#ffd700" strokeWidth="5" strokeLinecap="round" filter="url(#secGlow)" opacity="0.85"/>

        {/* ── Start/Finish line ── */}
        <line x1="300" y1="340" x2="300" y2="360" stroke="#fff" strokeWidth="3"/>
        <line x1="302" y1="340" x2="302" y2="360" stroke="#000" strokeWidth="1" strokeDasharray="3,3"/>

        {/* ── DRS zone (dashed green — main straight) ── */}
        <line x1="380" y1="350" x2="500" y2="350" stroke="#00ff44" strokeWidth="2.5" strokeDasharray="5,3" opacity="0.7"/>
        <circle cx="380" cy="350" r="2.5" fill="#00ff44"/><circle cx="500" cy="350" r="2.5" fill="#00ff44"/>

        {/* ── DRS Detection Zone label ── */}
        <rect x="400" y="355" width="80" height="36" rx="4" fill="#00cc44" opacity="0.85"/>
        <text x="440" y="370" textAnchor="middle" fill="#fff" fontSize="9" fontWeight="900">DRS ZONE</text>
        <text x="440" y="383" textAnchor="middle" fill="#fff" fontSize="7" fontWeight="800">DONAU STRAIGHT</text>

        {/* ── Speed Trap label ── */}
        <rect x="505" y="355" width="55" height="26" rx="4" fill="#ff00ff" opacity="0.85"/>
        <text x="532" y="367" textAnchor="middle" fill="#fff" fontSize="7" fontWeight="900">SPEED</text>
        <text x="532" y="377" textAnchor="middle" fill="#fff" fontSize="7" fontWeight="900">TRAP</text>

        {/* ── Sector labels ── */}
        <text x="560" y="200" fill="#e10600" fontSize="9" fontWeight="800" letterSpacing="1.5">SECTOR 1</text>
        <text x="345" y="120" fill="#00d4ff" fontSize="9" fontWeight="800" letterSpacing="1.5">SECTOR 2</text>
        <text x="200" y="298" fill="#ffd700" fontSize="9" fontWeight="800" letterSpacing="1.5">SECTOR 3</text>

        {/* ── Turn markers ── */}
        {turns.map(t => (
          <g key={t.n}>
            <circle cx={t.x} cy={t.y} r="3" fill="#445" stroke="#778" strokeWidth="0.8"/>
            <text x={t.x + 7} y={t.y + 3} fill="#8899aa" fontSize="8" fontWeight="700" fontFamily="monospace">T{t.n}</text>
          </g>
        ))}

        {/* ── Animated cars ── */}
        <circle r="5" fill="#fff" filter="url(#carGlow)">
          <animateMotion dur="66s" repeatCount="indefinite" rotate="auto" path={trackPath}/>
        </circle>
        <circle r="3.5" fill={ACCENT}>
          <animateMotion dur="66s" repeatCount="indefinite" rotate="auto" path={trackPath}/>
        </circle>
        <circle r="4.5" fill="#fff" filter="url(#carGlow)" opacity="0.85">
          <animateMotion dur="67.5s" repeatCount="indefinite" rotate="auto" path={trackPath} begin="-33s"/>
        </circle>
        <circle r="3" fill={ACCENT_BLUE}>
          <animateMotion dur="67.5s" repeatCount="indefinite" rotate="auto" path={trackPath} begin="-33s"/>
        </circle>

        {/* ── Race Operations Step Markers ── */}
        {ops.map((pos, idx) => {
          const mKeys = Object.keys(stepMetrics);
          const mk = mKeys.find(k => k.toLowerCase().includes(pos.label.toLowerCase().split(' ')[0])) || mKeys[idx];
          const m = mk ? stepMetrics[mk] : null;
          const errRate = m && m.count > 0 ? (m.errors / m.count * 100) : 0;
          return (
            <g key={idx}>
              <circle cx={pos.x} cy={pos.y} r="12" fill="none" stroke={pos.color} strokeWidth="0.8" opacity="0">
                <animate attributeName="r" from="12" to="32" dur="3s" repeatCount="indefinite" begin={`${idx * 0.4}s`}/>
                <animate attributeName="opacity" from="0.5" to="0" dur="3s" repeatCount="indefinite" begin={`${idx * 0.4}s`}/>
              </circle>
              <circle cx={pos.x} cy={pos.y} r="16" fill={`${pos.color}33`} stroke={pos.color} strokeWidth="1.8"/>
              <text x={pos.x} y={pos.y + 4} textAnchor="middle" fill="#fff" fontSize="11" fontWeight="900">{pos.step}</text>
              <text x={pos.x} y={pos.y - 21} textAnchor="middle" fill={pos.color} fontSize="7" fontWeight="700" letterSpacing="0.5">{pos.label}</text>
              {m && (
                <g>
                  <rect x={pos.x - 30} y={pos.y + 19} width="60" height="20" rx="3" fill="rgba(0,0,0,0.75)" stroke={`${pos.color}44`} strokeWidth="0.8"/>
                  <text x={pos.x} y={pos.y + 29} textAnchor="middle" fill="#e0e4ff" fontSize="7" fontWeight="600">{fmtNum(m.count)} ops</text>
                  <text x={pos.x} y={pos.y + 37} textAnchor="middle" fill={errRate > 5 ? '#e74c3c' : '#00d4aa'} fontSize="6" fontWeight="600">{errRate.toFixed(1)}% err</text>
                </g>
              )}
            </g>
          );
        })}

        {/* ── Telemetry bar ── */}
        <rect x="155" y="405" width="510" height="16" rx="3" fill="rgba(0,0,0,0.5)" stroke="rgba(100,130,200,0.15)"/>
        <text x="165" y="416" fill="rgba(255,255,255,0.45)" fontSize="7" fontWeight="600">LIVE RACE TELEMETRY</text>
        <text x="290" y="416" fill="#e10600" fontSize="7" fontWeight="700">LAWSON #30</text>
        <text x="365" y="416" fill="#1e90ff" fontSize="7" fontWeight="700">LINDBLAD #41</text>
        <text x="445" y="416" fill="rgba(255,255,255,0.35)" fontSize="6">312 CH · REAL-TIME · &lt;100ms LATENCY</text>
        <text x="660" y="416" textAnchor="end" fill={ACCENT} fontSize="7" fontWeight="700">LIVE</text>
        <circle cx="630" cy="413" r="2.5" fill={ACCENT}><animate attributeName="opacity" from="1" to="0.2" dur="1s" repeatCount="indefinite"/></circle>
      </svg>
    </div>
  );
}

/* ── Race Strategy AI Insights Panel ── */
function RaceStrategyInsights({ B, currentLap }: { B: string; currentLap: number }) {
  /* Query 1: Last 10 laps of telemetry for trend analysis */
  const { data: recentLaps, refetch: r1 } = useDqlQuery({ body: { query: `${B}
| filter json.stepName == "LinzGrandPrix"
| filter isNotNull(additionalfields.lapNumber)
| sort toDouble(additionalfields.lapNumber) desc
| limit 10
| fields lap = toDouble(additionalfields.lapNumber), lapTime = toDouble(additionalfields.lapTimeSec), wearFL = toDouble(additionalfields.tyreWearPercentFL), wearFR = toDouble(additionalfields.tyreWearPercentFR), wearRL = toDouble(additionalfields.tyreWearPercentRL), wearRR = toDouble(additionalfields.tyreWearPercentRR), fuel = toDouble(additionalfields.fuelRemainingKg), compound = additionalfields.tyreCompound, posLawson = toDouble(additionalfields.positionCar30), posLindblad = toDouble(additionalfields.positionCar41), gapAhead = toDouble(additionalfields.gapToCarAheadSec), gapLeader = toDouble(additionalfields.gapToLeaderSec), downforce = toDouble(additionalfields.downforceN), drag = toDouble(additionalfields.dragCoefficientCd), topSpeed = toDouble(additionalfields.topSpeedMph), drs = toDouble(additionalfields.drsActivated), ersCharge = toDouble(additionalfields.ersStateOfChargePercent), isPit = toDouble(additionalfields.isPitLap), brakeTempF = toDouble(additionalfields.brakeDiscTempFrontC), trackTemp = toDouble(additionalfields.trackTempC)
| sort lap asc` } });
  useEffect(() => { const id = setInterval(() => r1(), LIVE_POLL_MS); return () => clearInterval(id); }, [r1]);

  const insights = useMemo(() => {
    if (!recentLaps?.records?.length) return [];
    const laps = recentLaps.records.filter(r => r != null) as Record<string, any>[];
    if (laps.length < 2) return [];

    const latest = laps[laps.length - 1];
    const prev = laps[laps.length - 2];
    const earliest = laps[0];
    const remaining = 52 - currentLap;
    const racePhase = remaining > 35 ? 'EARLY' : remaining > 15 ? 'MID' : remaining > 5 ? 'LATE' : 'FINAL';
    const results: { icon: string; title: string; detail: string; color: string; priority: number }[] = [];

    // ── Tyre degradation prediction ──
    const avgWear = ((latest.wearFL || 0) + (latest.wearFR || 0) + (latest.wearRL || 0) + (latest.wearRR || 0)) / 4;
    const prevAvgWear = ((prev.wearFL || 0) + (prev.wearFR || 0) + (prev.wearRL || 0) + (prev.wearRR || 0)) / 4;
    const wearPerLap = laps.length >= 3
      ? (avgWear - ((earliest.wearFL || 0) + (earliest.wearFR || 0) + (earliest.wearRL || 0) + (earliest.wearRR || 0)) / 4) / Math.max(1, (latest.lap || 1) - (earliest.lap || 0))
      : avgWear - prevAvgWear;
    const maxWear = Math.max(latest.wearFL || 0, latest.wearFR || 0, latest.wearRL || 0, latest.wearRR || 0);
    const lapsUntilCritical = wearPerLap > 0 ? Math.floor((85 - maxWear) / wearPerLap) : 99;

    if (wearPerLap > 0) {
      if (lapsUntilCritical <= remaining && lapsUntilCritical <= 8) {
        results.push({
          icon: '🔴', title: 'PIT WINDOW OPEN',
          detail: `Tyre wear rate ${wearPerLap.toFixed(1)}%/lap — predicted critical in ${lapsUntilCritical} laps. ${latest.compound || 'Unknown'} compound reaching limit. ${remaining <= 15 ? 'Late-race: can push to finish if managed carefully.' : `Recommend pit between lap ${currentLap + Math.max(1, lapsUntilCritical - 3)} – ${currentLap + lapsUntilCritical}.`}`,
          color: '#e10600', priority: 1,
        });
      } else if (lapsUntilCritical > remaining) {
        results.push({
          icon: '🟢', title: 'TYRES: NO STOP NEEDED',
          detail: `Current ${latest.compound || ''} compound degrading at ${wearPerLap.toFixed(1)}%/lap (max wear: ${maxWear.toFixed(0)}%). Predicted ${(maxWear + wearPerLap * remaining).toFixed(0)}% at chequered flag — well within limits. Push hard.`,
          color: '#00d4aa', priority: 3,
        });
      } else {
        results.push({
          icon: '🟡', title: 'TYRE STRATEGY WATCH',
          detail: `Degradation ${wearPerLap.toFixed(1)}%/lap on ${latest.compound || ''}s. ~${lapsUntilCritical} laps to critical threshold (85%). ${racePhase === 'MID' ? 'Consider undercut window vs competitors.' : 'Monitor rear wear closely.'}`,
          color: '#ffd700', priority: 2,
        });
      }
    }

    // ── Downforce / lap time tradeoff ──
    if (latest.downforce && prev.downforce && Math.abs(latest.downforce - prev.downforce) > 50) {
      const dfDelta = latest.downforce - prev.downforce;
      const ltDelta = (latest.lapTime || 0) - (prev.lapTime || 0);
      const wearDelta = avgWear - prevAvgWear;
      results.push({
        icon: dfDelta > 0 ? '📈' : '📉', title: `DOWNFORCE ${dfDelta > 0 ? 'INCREASED' : 'DECREASED'}`,
        detail: `${Math.abs(dfDelta).toFixed(0)}N change → lap time ${ltDelta > 0 ? '+' : ''}${ltDelta.toFixed(2)}s, tyre wear ${wearDelta > 0 ? '+' : ''}${wearDelta.toFixed(1)}%/lap. ${remaining <= 10 && wearDelta > 0 ? `With ${remaining} laps remaining, extra wear is manageable — predicted finish wear: ${(maxWear + (wearPerLap + wearDelta) * remaining).toFixed(0)}%.` : dfDelta > 0 ? 'Higher grip through Pöstlingberg but monitor rear temps.' : 'Lower drag = higher straight-line speed for overtaking on Donau Straight.'}`,
        color: '#a78bfa', priority: 4,
      });
    }

    // ── Gap analysis & position prediction ──
    if (laps.length >= 3 && latest.gapAhead != null) {
      const gapTrend = laps.slice(-3).reduce((acc: number[], r: any) => { if (r.gapAhead != null) acc.push(r.gapAhead); return acc; }, []);
      if (gapTrend.length >= 2) {
        const closing = gapTrend[0] - gapTrend[gapTrend.length - 1];
        const ratePerLap = closing / (gapTrend.length - 1);
        if (Math.abs(ratePerLap) > 0.05) {
          const gap = latest.gapAhead;
          const lapsToOvertake = ratePerLap > 0 ? Math.ceil(gap / ratePerLap) : -1;
          results.push({
            icon: ratePerLap > 0 ? '⚔️' : '🛡️',
            title: ratePerLap > 0 ? 'CLOSING ON CAR AHEAD' : 'GAP INCREASING',
            detail: ratePerLap > 0
              ? `Closing at ${ratePerLap.toFixed(2)}s/lap. Gap: ${gap.toFixed(2)}s. ${lapsToOvertake <= remaining ? `Overtake window: lap ${currentLap + lapsToOvertake}${latest.drs ? ' — DRS available on approach.' : '.'}` : `Need ${lapsToOvertake} laps but only ${remaining} remaining — consider alternative strategy.`}`
              : `Losing ${Math.abs(ratePerLap).toFixed(2)}s/lap to car ahead. Gap now ${gap.toFixed(2)}s. ${racePhase === 'LATE' ? 'Focus on defending position.' : 'Evaluate if tyre offset will help later.'}`,
            color: ratePerLap > 0 ? '#00ff88' : '#ff6b4a', priority: ratePerLap > 0 ? 2 : 3,
          });
        }
      }
    }

    // ── Fuel prediction ──
    if (latest.fuel != null && earliest.fuel != null && laps.length >= 3) {
      const fuelRate = (earliest.fuel - latest.fuel) / Math.max(1, (latest.lap || 1) - (earliest.lap || 0));
      const fuelAtEnd = latest.fuel - fuelRate * remaining;
      if (fuelAtEnd < 2) {
        results.push({
          icon: '⛽', title: 'FUEL CRITICAL',
          detail: `Burn rate: ${fuelRate.toFixed(2)} kg/lap. ${latest.fuel.toFixed(1)}kg remaining. Predicted ${fuelAtEnd.toFixed(1)}kg at flag — LIFT AND COAST required from lap ${currentLap + Math.floor((latest.fuel - 2) / fuelRate)}.`,
          color: '#e74c3c', priority: 1,
        });
      } else {
        results.push({
          icon: '⛽', title: 'FUEL NOMINAL',
          detail: `${latest.fuel.toFixed(1)}kg remaining at ${fuelRate.toFixed(2)} kg/lap burn rate. Predicted ${fuelAtEnd.toFixed(1)}kg at chequered flag (${remaining} laps). ${fuelAtEnd > 5 ? 'Surplus allows engine mode push.' : 'On target — maintain current mapping.'}`,
          color: fuelAtEnd > 5 ? '#00d4aa' : '#ffd700', priority: 5,
        });
      }
    }

    // ── ERS strategy ──
    if (latest.ersCharge != null) {
      results.push({
        icon: '⚡', title: `ERS: ${latest.ersCharge > 60 ? 'DEPLOY AVAILABLE' : latest.ersCharge > 30 ? 'HARVESTING' : 'LOW CHARGE'}`,
        detail: `Battery at ${latest.ersCharge.toFixed(0)}%. ${latest.ersCharge > 60 ? `Full deployment available for ${latest.drs ? 'DRS + overtake mode on Donau Straight' : 'attack on next lap'}.` : latest.ersCharge > 30 ? 'Harvesting through Pöstlingberg — deploy on Donau Straight.' : 'Save mode — deploy only for defence or critical overtake.'}`,
        color: latest.ersCharge > 60 ? '#00d4aa' : latest.ersCharge > 30 ? '#ffd700' : '#e74c3c', priority: 4,
      });
    }

    // ── Brake temperature insight ──
    if (latest.brakeTempF && latest.brakeTempF > 900) {
      results.push({
        icon: '🛑', title: 'BRAKE TEMPS HIGH',
        detail: `Front discs at ${latest.brakeTempF.toFixed(0)}°C — approaching thermal limit. Risk of fade into Stahlwerk (T4) heavy braking zone. Consider earlier lift or cooling lap.`,
        color: '#ff6b4a', priority: 2,
      });
    }

    // ── Race phase strategic overview ──
    const phaseMsg: Record<string, string> = {
      EARLY: `Early race (${remaining} laps to go). Focus: clean air, tyre management, build gap for pit window flexibility. Undercut potential is high.`,
      MID: `Mid-race (${remaining} laps to go). Strategy divergence zone — track position vs fresh rubber tradeoff. Monitor competitor pit stops for overcut opportunity.`,
      LATE: `Final stint (${remaining} laps to go). Push for position — tyres are the limiting factor. ${latest.posLawson <= 3 ? 'Podium in sight. Protect position.' : 'Points zone — every position matters for constructors.'}`,
      FINAL: `Last ${remaining} laps! Maximum attack. ${latest.posLawson === 1 ? 'LEAD THE RACE HOME!' : `P${latest.posLawson} — ${latest.gapAhead ? `${latest.gapAhead.toFixed(2)}s to car ahead.` : 'push for every tenth.'}`}`,
    };
    results.push({
      icon: '🧠', title: `RACE PHASE: ${racePhase}`,
      detail: phaseMsg[racePhase] || '',
      color: racePhase === 'FINAL' ? '#e10600' : racePhase === 'LATE' ? '#ffd700' : '#8899cc',
      priority: 0,
    });

    return results.sort((a, b) => a.priority - b.priority);
  }, [recentLaps, currentLap, B]);

  if (!insights.length) {
    return (
      <div style={{ padding: 20, textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>
        Awaiting telemetry data for strategy analysis…
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))', gap: 12 }}>
      {insights.map((ins, i) => (
        <div key={i} style={{
          padding: '14px 16px',
          background: 'rgba(0,0,0,0.4)',
          border: `1px solid ${ins.color}33`,
          borderLeft: `4px solid ${ins.color}`,
          borderRadius: 10,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span style={{ fontSize: 16 }}>{ins.icon}</span>
            <span style={{ fontSize: 11, fontWeight: 800, color: ins.color, letterSpacing: '0.5px', textTransform: 'uppercase' }}>
              {ins.title}
            </span>
          </div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', lineHeight: 1.5 }}>
            {ins.detail}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Mini Metric with auto-refresh ── */
function LiveMiniMetric({ id, title, icon, accent, dql, unit }: { id: string; title: string; icon: string; accent: string; dql: string; unit: string }) {
  const { data: mData, refetch } = useDqlQuery({ body: { query: dql } });
  useEffect(() => { const iv = setInterval(() => refetch(), LIVE_POLL_MS); return () => clearInterval(iv); }, [refetch]);
  const val = mData?.records?.[0] ? (() => {
    const r = mData.records[0]!;
    const k = Object.keys(r).filter(x => !x.startsWith('__'));
    const v = r[k[k.length - 1]];
    return typeof v === 'number' ? fmtNum(v) : String(v ?? '—');
  })() : '—';
  return (
    <div style={{
      padding: '12px 14px', background: 'rgba(0,0,0,0.4)', borderRadius: 10,
      border: `1px solid ${accent}33`, textAlign: 'center',
    }}>
      <div style={{ fontSize: 14 }}>{icon}</div>
      <div style={{ fontSize: 22, fontWeight: 900, color: '#fff', marginTop: 4 }}>
        {val}<span style={{ fontSize: 10, color: accent, marginLeft: 3 }}>{unit}</span>
      </div>
      <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>{title}</div>
    </div>
  );
}

export function VCARBLiveRace() {
  const { raceId, isLoading: raceIdLoading } = useActiveRaceId();
  const [timeframe, setTimeframe] = useState<Timeframe>('24h');
  const from = tfToDql(timeframe);
  const B = raceBase(raceId, from);
  // Inline base for DQL append clauses (pipe-separated, single line)
  const A = raceId
    ? `fetch bizevents | filter json.companyName == "${COMPANY}" | filter timestamp >= ${from} | filter additionalfields.raceId == "${raceId}"`
    : `fetch bizevents | filter json.companyName == "${COMPANY}" | filter timestamp >= ${from}`;

  /* ── Step metrics for circuit map ── */
  const { data: stepData, refetch: refetchSteps } = useDqlQuery({ body: { query: `${B}\n| filter json.stepName in ("LinzGrandPrix","LinzPitStops","LinzPostRaceDebrief")\n| summarize count = count(), errors = countIf(json.hasError == true), by:{stepName = json.stepName}\n| sort count desc` } });
  useEffect(() => { const id = setInterval(() => refetchSteps(), LIVE_POLL_MS); return () => clearInterval(id); }, [refetchSteps]);
  const stepMetrics = useMemo(() => {
    const m: Record<string, { count: number; errors: number }> = {};
    if (!stepData?.records) return m;
    for (const r of stepData.records) {
      if (!r) continue;
      const step = String(r['stepName'] || '');
      m[step] = { count: Number(r['count']) || 0, errors: Number(r['errors']) || 0 };
    }
    return m;
  }, [stepData]);

  /* ── Lap counter ── */
  const { data: lapCount, refetch: refetchLaps } = useDqlQuery({ body: { query: `${B}\n| filter json.stepName == "LinzGrandPrix"\n| filter isNotNull(additionalfields.lapNumber)\n| summarize laps = max(toDouble(additionalfields.lapNumber))` } });
  useEffect(() => { const id = setInterval(() => refetchLaps(), LIVE_POLL_MS); return () => clearInterval(id); }, [refetchLaps]);
  const currentLap = useMemo(() => {
    if (!lapCount?.records?.length) return 0;
    return Math.min(Number(lapCount.records[0]?.['laps']) || 0, 52);
  }, [lapCount]);

  /* ── Driver positions (latest lap) ── */
  const { data: posData, refetch: refetchPos } = useDqlQuery({ body: { query: `${B}\n| filter json.stepName == "LinzGrandPrix"\n| filter isNotNull(additionalfields.lapNumber)\n| sort toDouble(additionalfields.lapNumber) desc\n| limit 1\n| fields posLawson = toDouble(additionalfields.positionCar30), posLindblad = toDouble(additionalfields.positionCar41), overtakes = toDouble(additionalfields.overtakeSuccessful)` } });
  useEffect(() => { const id = setInterval(() => refetchPos(), LIVE_POLL_MS); return () => clearInterval(id); }, [refetchPos]);
  const positions = useMemo(() => {
    if (!posData?.records?.[0]) return { lawson: 0, lindblad: 0, overtakes: 0 };
    const r = posData.records[0]!;
    return {
      lawson: Number(r['posLawson']) || 0,
      lindblad: Number(r['posLindblad']) || 0,
      overtakes: Number(r['overtakes']) || 0,
    };
  }, [posData]);

  /* ── Tile definitions — race-active metrics ── */
  const tiles: (TileDef | { type: 'banner'; title: string; icon: string; accent: string })[] = [
    // ═══ STEP 6: LAP PERFORMANCE ═══
    { type: 'banner', title: 'STEP 6 — RACE: LAP PERFORMANCE & TIMING', icon: '🏁', accent: ACCENT },
    { id: 'v-total-ops', title: 'Total Race Ops', type: 'heroMetric', width: 1, icon: '🏎️', accent: ACCENT,
      dql: `${B}\n| summarize ops = count()`, unit: 'ops', subtitle: 'Dynatrace Linz race weekend' },
    { id: 'v-avg-lap', title: 'Avg Lap Time', type: 'heroMetric', width: 1, icon: '⏱️', accent: '#00d4aa',
      dql: `${B}\n| filter json.stepName == "LinzGrandPrix"\n| filter isNotNull(additionalfields.lapTimeSec)\n| summarize avg = round(avg(toDouble(additionalfields.lapTimeSec)), decimals:2)`, unit: 's', subtitle: 'Target: 88.50s' },
    { id: 'v-top-speed', title: 'Top Speed', type: 'heroMetric', width: 1, icon: '💨', accent: '#a78bfa',
      dql: `${B}\n| filter json.stepName == "LinzGrandPrix"\n| filter isNotNull(additionalfields.topSpeedMph)\n| summarize speed = max(toDouble(additionalfields.topSpeedMph))`, unit: 'mph', subtitle: 'DRS enabled peak' },
    { id: 'v-lap-trend', title: 'Lap Times Over Time', type: 'timeseries', width: 2, icon: '📈', accent: ACCENT,
      dql: `${B}\n| filter json.stepName == "LinzGrandPrix"\n| filter isNotNull(additionalfields.lapTimeSec)\n| makeTimeseries avgLap = avg(toDouble(additionalfields.lapTimeSec)), interval: 5m` },
    { id: 'v-sector-dist', title: 'Avg Sector Times', type: 'categoricalBar', width: 1, icon: '🔢', accent: '#f5a623',
      dql: `${B}\n| filter json.stepName == "LinzGrandPrix"\n| filter isNotNull(additionalfields.sectorOneTimeSec)\n| summarize S1 = round(avg(toDouble(additionalfields.sectorOneTimeSec)),decimals:1), S2 = round(avg(toDouble(additionalfields.sectorTwoTimeSec)),decimals:1), S3 = round(avg(toDouble(additionalfields.sectorThreeTimeSec)),decimals:1)\n| fields sector = "S1", time = S1\n| append [${A} | filter json.stepName == "LinzGrandPrix" | summarize t = round(avg(toDouble(additionalfields.sectorTwoTimeSec)),decimals:1) | fields sector = "S2", time = t]\n| append [${A} | filter json.stepName == "LinzGrandPrix" | summarize t = round(avg(toDouble(additionalfields.sectorThreeTimeSec)),decimals:1) | fields sector = "S3", time = t]` },

    // ═══ STEP 6: POSITION TRACKING & STRATEGY ═══
    { type: 'banner', title: 'STEP 6 — RACE: POSITION TRACKING & OVERTAKES', icon: '🏆', accent: '#ffd700' },
    { id: 'v-pos-lawson', title: 'Lawson Position History', type: 'timeseries', width: 2, icon: '🔴', accent: ACCENT,
      dql: `${B}\n| filter json.stepName == "LinzGrandPrix"\n| filter isNotNull(additionalfields.positionCar30)\n| makeTimeseries pos = avg(toDouble(additionalfields.positionCar30)), interval: 5m` },
    { id: 'v-pos-lindblad', title: 'Lindblad Position History', type: 'timeseries', width: 2, icon: '🔵', accent: ACCENT_BLUE,
      dql: `${B}\n| filter json.stepName == "LinzGrandPrix"\n| filter isNotNull(additionalfields.positionCar41)\n| makeTimeseries pos = avg(toDouble(additionalfields.positionCar41)), interval: 5m` },
    { id: 'v-overtakes', title: 'Overtakes', type: 'heroMetric', width: 1, icon: '⚔️', accent: '#ffd700',
      dql: `${B}\n| filter toDouble(additionalfields.overtakeSuccessful) > 0\n| summarize overtakes = sum(toDouble(additionalfields.overtakeSuccessful))`, unit: '', subtitle: 'Successful overtakes' },
    { id: 'v-drs-flaps', title: 'DRS Activations', type: 'heroMetric', width: 1, icon: '🟢', accent: '#00ff88',
      dql: `${B}\n| filter json.stepName == "LinzGrandPrix"\n| filter toDouble(additionalfields.drsActivated) == 1\n| summarize drsActive = count()`, unit: '', subtitle: 'Total DRS activations' },
    { id: 'v-gap-front', title: 'Gap to Car Ahead', type: 'heroMetric', width: 1, icon: '⏩', accent: '#00d4aa',
      dql: `${B}\n| filter isNotNull(additionalfields.gapToCarAheadSec)\n| sort toDouble(additionalfields.lapNumber) desc\n| limit 1\n| fields gap = round(toDouble(additionalfields.gapToCarAheadSec), decimals:3)`, unit: 's', subtitle: 'Latest gap' },

    // ═══ STEP 6: TYRE MANAGEMENT ═══
    { type: 'banner', title: 'STEP 6 — RACE: TYRE MANAGEMENT & DEGRADATION', icon: '🔵', accent: '#1e90ff' },
    { id: 'v-tyre-heatmap', title: 'Tyre Temp Heatmap (All Corners)', type: 'heatmap', width: 2, icon: '🔥', accent: '#e74c3c',
      dql: `${B}\n| filter json.stepName == "LinzGrandPrix"\n| filter isNotNull(additionalfields.tyreSurfaceTempFL)\n| summarize FL = round(avg(toDouble(additionalfields.tyreSurfaceTempFL)),decimals:0), FR = round(avg(toDouble(additionalfields.tyreSurfaceTempFR)),decimals:0), RL = round(avg(toDouble(additionalfields.tyreSurfaceTempRL)),decimals:0), RR = round(avg(toDouble(additionalfields.tyreSurfaceTempRR)),decimals:0)\n| fields corner = "FL", temp = FL\n| append [${A} | filter json.stepName == "LinzGrandPrix" | filter isNotNull(additionalfields.tyreSurfaceTempFR) | summarize t = round(avg(toDouble(additionalfields.tyreSurfaceTempFR)),decimals:0) | fields corner = "FR", temp = t]\n| append [${A} | filter json.stepName == "LinzGrandPrix" | filter isNotNull(additionalfields.tyreSurfaceTempRL) | summarize t = round(avg(toDouble(additionalfields.tyreSurfaceTempRL)),decimals:0) | fields corner = "RL", temp = t]\n| append [${A} | filter json.stepName == "LinzGrandPrix" | filter isNotNull(additionalfields.tyreSurfaceTempRR) | summarize t = round(avg(toDouble(additionalfields.tyreSurfaceTempRR)),decimals:0) | fields corner = "RR", temp = t]` },
    { id: 'v-compound-lr', title: 'Tyre Compound Distribution', type: 'donut', width: 1, icon: '🏁', accent: '#ffd700',
      dql: `${B}\n| filter json.stepName == "LinzGrandPrix"\n| filter isNotNull(additionalfields.tyreCompound)\n| summarize ops = count(), by:{compound = additionalfields.tyreCompound}\n| sort ops desc` },
    { id: 'v-tyre-wear', title: 'Tyre Wear Over Time', type: 'timeseries', width: 2, icon: '📉', accent: '#1e90ff',
      dql: `${B}\n| filter json.stepName == "LinzGrandPrix"\n| filter isNotNull(additionalfields.tyreWearPercentFL)\n| makeTimeseries FL = avg(toDouble(additionalfields.tyreWearPercentFL)), FR = avg(toDouble(additionalfields.tyreWearPercentFR)), RL = avg(toDouble(additionalfields.tyreWearPercentRL)), RR = avg(toDouble(additionalfields.tyreWearPercentRR)), interval: 5m` },
    { id: 'v-fuel-load', title: 'Fuel Load', type: 'heroMetric', width: 1, icon: '⛽', accent: '#e67e22',
      dql: `${B}\n| filter json.stepName == "LinzGrandPrix"\n| filter isNotNull(additionalfields.fuelRemainingKg)\n| summarize fuel = round(avg(toDouble(additionalfields.fuelRemainingKg)), decimals:1)`, unit: 'kg', subtitle: 'Avg remaining fuel' },
    { id: 'v-fuel-burn', title: 'Fuel Burn Over Time', type: 'timeseries', width: 2, icon: '🔥', accent: '#e67e22',
      dql: `${B}\n| filter json.stepName == "LinzGrandPrix"\n| filter isNotNull(additionalfields.fuelRemainingKg)\n| makeTimeseries fuel = avg(toDouble(additionalfields.fuelRemainingKg)), interval: 5m` },
    { id: 'v-ers-charge', title: 'ERS Charge Over Time', type: 'timeseries', width: 2, icon: '⚡', accent: '#00d4aa',
      dql: `${B}\n| filter json.stepName == "LinzGrandPrix"\n| filter isNotNull(additionalfields.ersStateOfChargePercent)\n| makeTimeseries ers = avg(toDouble(additionalfields.ersStateOfChargePercent)), interval: 5m` },
    { id: 'v-tyre-current', title: 'Current Compound', type: 'heroMetric', width: 1, icon: '🔴', accent: '#ff6b4a',
      dql: `${B}\n| filter isNotNull(additionalfields.tyreCompound)\n| sort toDouble(additionalfields.lapNumber) desc\n| limit 1\n| fields compound = additionalfields.tyreCompound`, unit: '', subtitle: 'Active tyre compound' },

    // ═══ STEP 7: PIT STOP EXECUTION ═══
    { type: 'banner', title: 'STEP 7 — PIT STOP EXECUTION', icon: '🔧', accent: '#ffd700' },
    { id: 'v-pit-avg', title: 'Avg Pit Stop Time', type: 'heroMetric', width: 1, icon: '⏱️', accent: '#ffd700',
      dql: `${B}\n| filter json.stepName == "LinzPitStops"\n| filter isNotNull(additionalfields.pitStopTimeSec)\n| summarize avg = round(avg(toDouble(additionalfields.pitStopTimeSec)), decimals:2)`, unit: 's', subtitle: 'Target: 1.95s' },
    { id: 'v-pit-best', title: 'Best Pit Stop', type: 'heroMetric', width: 1, icon: '🏆', accent: '#00d4aa',
      dql: `${B}\n| filter json.stepName == "LinzPitStops"\n| filter isNotNull(additionalfields.pitStopTimeSec)\n| summarize best = round(min(toDouble(additionalfields.pitStopTimeSec)), decimals:2)`, unit: 's', subtitle: 'Season best' },
    { id: 'v-crew-ready', title: 'Crew Readiness', type: 'gauge', width: 1, icon: '✅', accent: '#00d4aa',
      dql: `${B}\n| filter json.stepName == "LinzPitStops"\n| filter isNotNull(additionalfields.pitCrewReadinessPercent)\n| summarize readiness = round(avg(toDouble(additionalfields.pitCrewReadinessPercent)), decimals:1)`, gaugeMax: 100, subtitle: 'Avg crew readiness %' },

    // ═══ STEP 8: POST-RACE ANALYTICS ═══
    { type: 'banner', title: 'STEP 8 — DEBRIEF: ANALYTICS & OPERATIONS', icon: '📊', accent: '#00bcd4' },
    { id: 'v-ops-heatmap', title: 'Operations Heatmap by Step', type: 'heatmap', width: 2, icon: '🔥', accent: ACCENT,
      dql: `${B}\n| summarize count = count(), by:{step = json.stepName}\n| sort count desc` },
    { id: 'v-error-by-step', title: 'Errors by Step', type: 'donut', width: 1, icon: '🚨', accent: '#e74c3c',
      dql: `${B}\n| filter json.hasError == true\n| summarize errors = count(), by:{step = json.stepName}\n| sort errors desc` },
    { id: 'v-brake-heatmap', title: 'Brake & Wear Heatmap', type: 'heatmap', width: 2, icon: '🛑', accent: '#ff6b4a',
      dql: `${B}\n| filter json.stepName == "LinzGrandPrix"\n| filter isNotNull(additionalfields.brakeDiscTempFrontC)\n| summarize BrakeFront = round(avg(toDouble(additionalfields.brakeDiscTempFrontC)),decimals:0), BrakeRear = round(avg(toDouble(additionalfields.brakeDiscTempRearC)),decimals:0), PadWearF = round(avg(toDouble(additionalfields.brakePadWearPercentF)),decimals:0), PadWearR = round(avg(toDouble(additionalfields.brakePadWearPercentR)),decimals:0)\n| fields metric = "Brake Front C", value = BrakeFront\n| append [${A} | filter json.stepName == "LinzGrandPrix" | filter isNotNull(additionalfields.brakeDiscTempRearC) | summarize t = round(avg(toDouble(additionalfields.brakeDiscTempRearC)),decimals:0) | fields metric = "Brake Rear C", value = t]\n| append [${A} | filter json.stepName == "LinzGrandPrix" | filter isNotNull(additionalfields.brakePadWearPercentF) | summarize t = round(avg(toDouble(additionalfields.brakePadWearPercentF)),decimals:0) | fields metric = "Pad Wear Front %", value = t]\n| append [${A} | filter json.stepName == "LinzGrandPrix" | filter isNotNull(additionalfields.brakePadWearPercentR) | summarize t = round(avg(toDouble(additionalfields.brakePadWearPercentR)),decimals:0) | fields metric = "Pad Wear Rear %", value = t]` },
    { id: 'v-error-rate-lr', title: 'Error Rate', type: 'gauge', width: 1, icon: '⚠️', accent: '#e74c3c',
      dql: `${B}\n| summarize total = count(), errors = countIf(json.hasError == true)\n| fieldsAdd rate = round(100.0 * toDouble(errors) / toDouble(total), decimals:1)`, gaugeMax: 100, subtitle: 'System error rate %' },
    { id: 'v-ops-trend', title: 'Operations Volume Over Time', type: 'timeseries', width: 2, icon: '📈', accent: ACCENT,
      dql: `${B}\n| makeTimeseries count = count(), interval: 5m` },

    // ═══ DIGITAL PLATFORM & SYSTEM RELIABILITY ═══
    { type: 'banner', title: 'DIGITAL PLATFORM & SYSTEM RELIABILITY', icon: '🌐', accent: '#00d4ff' },
    { id: 'v-sys-avail', title: 'System Availability', type: 'gauge', width: 1, icon: '🛡️', accent: '#00d4aa',
      dql: `${B}\n| summarize total = count(), ok = countIf(json.hasError != true)\n| fieldsAdd avail = round(100.0 * toDouble(ok) / toDouble(total), decimals:2)`, gaugeMax: 100, subtitle: 'Race weekend uptime %' },
    { id: 'v-telem-lat', title: 'Telemetry Pipeline Latency', type: 'heroMetric', width: 1, icon: '📡', accent: '#a78bfa',
      dql: `${B}\n| filter isNotNull(additionalfields.telemetryLatencyMs)\n| summarize lat = round(avg(toDouble(additionalfields.telemetryLatencyMs)), decimals:1)`, unit: 'ms', subtitle: 'Target: <100ms' },
    { id: 'v-data-thru', title: 'Data Pipeline Throughput', type: 'heroMetric', width: 1, icon: '🔄', accent: '#00bcd4',
      dql: `${B}\n| filter isNotNull(additionalfields.dataRateGbps)\n| summarize rate = round(avg(toDouble(additionalfields.dataRateGbps)), decimals:2)`, unit: 'Gbps', subtitle: 'Track → War Room' },
    { id: 'v-lat-trend', title: 'Pipeline Latency Over Time', type: 'timeseries', width: 2, icon: '📈', accent: '#a78bfa',
      dql: `${B}\n| filter isNotNull(additionalfields.telemetryLatencyMs)\n| makeTimeseries latency = avg(toDouble(additionalfields.telemetryLatencyMs)), interval: 5m` },
    { id: 'v-sensor-health', title: 'Sensor Health', type: 'gauge', width: 1, icon: '💚', accent: '#00d4aa',
      dql: `${B}\n| filter isNotNull(additionalfields.sensorHealthPercent)\n| summarize health = round(avg(toDouble(additionalfields.sensorHealthPercent)), decimals:1)`, gaugeMax: 100, subtitle: 'Avg sensor uptime %' },
    { id: 'v-channels', title: 'Active Telemetry Channels', type: 'heroMetric', width: 1, icon: '📊', accent: '#1e90ff',
      dql: `${B}\n| filter isNotNull(additionalfields.telemetryChannelsActive)\n| summarize ch = round(avg(toDouble(additionalfields.telemetryChannelsActive)), decimals:0)`, unit: 'ch', subtitle: 'Of 312 total' },
    { id: 'v-incident-rate', title: 'Incident Rate Over Time', type: 'timeseries', width: 2, icon: '🚨', accent: '#e74c3c',
      dql: `${B}\n| makeTimeseries errors = countIf(json.hasError == true), total = count(), interval: 5m` },

    // ═══ FAN ENGAGEMENT & DIGITAL INTELLIGENCE ═══
    { type: 'banner', title: 'FAN ENGAGEMENT & DIGITAL INTELLIGENCE', icon: '👥', accent: '#ff6b9d' },
    { id: 'v-digital-ops', title: 'Digital Operations (Est.)', type: 'heroMetric', width: 1, icon: '🌐', accent: '#ff6b9d',
      dql: `${B}\n| summarize ops = count()\n| fieldsAdd digitalInteractions = ops * 15`, unit: '', subtitle: '~15 interactions per op' },
    { id: 'v-fan-base', title: 'Estimated Fan Reach', type: 'heroMetric', width: 1, icon: '👥', accent: '#a78bfa',
      dql: `${B}\n| summarize ops = count()\n| fieldsAdd fanReach = round(toDouble(ops) * 15.0 / 30.0, decimals:0)`, unit: 'K', subtitle: 'Real-time engaged fans' },
    { id: 'v-content-perf', title: 'Content Delivery Health', type: 'gauge', width: 1, icon: '📺', accent: '#00d4aa',
      dql: `${B}\n| summarize total = count(), ok = countIf(json.hasError != true)\n| fieldsAdd health = round(100.0 * toDouble(ok) / toDouble(total), decimals:1)`, gaugeMax: 100, subtitle: 'Fan platform SLA %' },

    // ═══ RACE LOG ═══
    { type: 'banner', title: 'DYNATRACE LINZ RACE LOG', icon: '📋', accent: '#e0e4ff' },
    { id: 'v-recent', title: 'Latest Race Operations', type: 'table', width: 3, icon: '📝', accent: '#a78bfa',
      dql: `${B}\n| sort timestamp desc\n| limit 20\n| fields time = timestamp, step = json.stepName, lap = additionalfields.lapNumber, driver = additionalfields.driverCar, lapTime = additionalfields.lapTimeSec, tyre = additionalfields.tyreCompound, posLawson = additionalfields.positionCar30, posLindblad = additionalfields.positionCar41, fuel = additionalfields.fuelRemainingKg, speed = additionalfields.topSpeedMph, error = json.hasError` },
  ];

  return (
    <div style={DASHBOARD_BG_STYLE}>
      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Link to="/vcarb" style={{ color: 'rgba(255,255,255,0.5)', textDecoration: 'none', fontSize: 13 }}>← Race Hub</Link>
          <div>
            <h1 style={{ margin: 0, fontSize: 'clamp(20px, 2.5vw, 26px)', fontWeight: 900, background: `linear-gradient(135deg, ${ACCENT}, #ffd700)`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              🏁 LIVE RACE — Steps 6-8
            </h1>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginTop: 2 }}>
              Race · Pit Stops · Post-Race Debrief · 52 Laps · Dynatrace Linz Circuit
              {raceId && <span style={{ marginLeft: 8, color: 'rgba(255,255,255,0.25)', fontFamily: 'monospace', fontSize: 10 }}>({raceId})</span>}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ display: 'flex', gap: 6 }}>
            {TIMEFRAMES.map(tf => (
              <button key={tf} onClick={() => setTimeframe(tf)} style={{
                padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                background: tf === timeframe ? ACCENT : 'rgba(30,35,65,0.7)',
                color: tf === timeframe ? '#fff' : 'rgba(255,255,255,0.5)',
                border: tf === timeframe ? `1px solid ${ACCENT}` : '1px solid rgba(100,120,200,0.2)',
              }}>{tf}</button>
            ))}
          </div>
        </div>
      </div>

      {/* ═══ Race Hero Card ═══ */}
      <div style={{
        marginBottom: 20, padding: 0, borderRadius: 16, overflow: 'hidden',
        background: 'linear-gradient(135deg, rgba(225,6,0,0.15) 0%, rgba(20,22,40,0.95) 40%, rgba(30,35,65,0.9) 100%)',
        border: `2px solid ${ACCENT}44`, boxShadow: `0 0 60px ${ACCENT}15, 0 8px 32px rgba(0,0,0,0.4)`,
      }}>
        <div style={{
          padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: `linear-gradient(90deg, ${ACCENT}, ${ACCENT}cc, ${ACCENT}88)`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 28 }}>🏁</span>
            <div>
              <div style={{ fontSize: 'clamp(16px, 2vw, 20px)', fontWeight: 900, color: '#fff', letterSpacing: '1px' }}>FORMULA 1 DYNATRACE LINZ GRAND PRIX 2026</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.8)', letterSpacing: '0.5px' }}>LIGHTS OUT · LINZ · SUNDAY 14:00 CET</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#fff', animation: 'vcarb-pulse 1.5s ease-in-out infinite' }} />
            <span style={{ color: '#fff', fontWeight: 800, fontSize: 14, letterSpacing: '1px' }}>LIVE</span>
          </div>
        </div>

        {/* Lap Counter + Driver Cards + Race Specs */}
        <div style={{ padding: 'clamp(12px, 2vw, 20px) clamp(12px, 2vw, 24px)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))', gap: 16 }}>
          {/* Lap Counter */}
          <div style={{ padding: 16, background: 'rgba(0,0,0,0.4)', borderRadius: 12, border: `2px solid ${ACCENT}44`, textAlign: 'center' }}>
            <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', fontWeight: 700, letterSpacing: '1.5px', marginBottom: 8 }}>RACE PROGRESS</div>
            <div style={{ fontSize: 'clamp(36px, 5vw, 56px)', fontWeight: 900, color: '#fff', lineHeight: 1 }}>
              {currentLap}<span style={{ fontSize: 20, color: 'rgba(255,255,255,0.4)' }}>/52</span>
            </div>
            <div style={{ fontSize: 12, color: ACCENT, fontWeight: 700, marginTop: 4 }}>
              {currentLap >= 52 ? 'RACE COMPLETE' : currentLap > 0 ? 'LAP IN PROGRESS' : 'AWAITING RACE START'}
            </div>
            {currentLap > 0 && currentLap < 52 && (
              <div style={{ marginTop: 8, height: 6, borderRadius: 3, background: 'rgba(100,120,200,0.15)', overflow: 'hidden' }}>
                <div style={{ height: '100%', borderRadius: 3, background: `linear-gradient(90deg, ${ACCENT}, #ffd700)`, width: `${(currentLap / 52) * 100}%`, transition: 'width 1s ease' }} />
              </div>
            )}
          </div>
          {/* Driver 1 */}
          <div style={{ padding: 16, background: 'rgba(0,0,0,0.3)', borderRadius: 12, border: `1px solid ${ACCENT}33` }}>
            <div style={{ fontSize: 9, color: ACCENT, fontWeight: 700, letterSpacing: '1px', marginBottom: 8 }}>DRIVER 1</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#fff' }}>LAWSON</div>
            <div style={{ fontSize: 'clamp(22px, 3vw, 28px)', fontWeight: 900, color: ACCENT }}>#30</div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>🇳🇿 New Zealand</div>
            {positions.lawson > 0 && (() => {
              const startPos = 6;
              const delta = startPos - positions.lawson; // positive = gained positions
              return (
                <div style={{ marginTop: 8, padding: '6px 10px', background: `${ACCENT}22`, borderRadius: 6, textAlign: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                    <span style={{ fontSize: 20, fontWeight: 900, color: positions.lawson <= 3 ? '#ffd700' : '#fff' }}>P{positions.lawson}</span>
                    {delta !== 0 && (
                      <span style={{
                        fontSize: 13, fontWeight: 800,
                        color: delta > 0 ? '#00d4aa' : '#e74c3c',
                        display: 'flex', alignItems: 'center', gap: 2,
                      }}>
                        <span style={{ fontSize: 16 }}>{delta > 0 ? '▲' : '▼'}</span>{Math.abs(delta)}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', marginTop: 4 }}>Started P{startPos}</div>
                </div>
              );
            })()}
          </div>
          {/* Driver 2 */}
          <div style={{ padding: 16, background: 'rgba(0,0,0,0.3)', borderRadius: 12, border: `1px solid ${ACCENT_BLUE}33` }}>
            <div style={{ fontSize: 9, color: ACCENT_BLUE, fontWeight: 700, letterSpacing: '1px', marginBottom: 8 }}>DRIVER 2</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#fff' }}>LINDBLAD</div>
            <div style={{ fontSize: 'clamp(22px, 3vw, 28px)', fontWeight: 900, color: ACCENT_BLUE }}>#41</div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>🇬🇧 Great Britain</div>
            {positions.lindblad > 0 && (() => {
              const startPos = 9;
              const delta = startPos - positions.lindblad;
              return (
                <div style={{ marginTop: 8, padding: '6px 10px', background: `${ACCENT_BLUE}22`, borderRadius: 6, textAlign: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                    <span style={{ fontSize: 20, fontWeight: 900, color: positions.lindblad <= 3 ? '#ffd700' : '#fff' }}>P{positions.lindblad}</span>
                    {delta !== 0 && (
                      <span style={{
                        fontSize: 13, fontWeight: 800,
                        color: delta > 0 ? '#00d4aa' : '#e74c3c',
                        display: 'flex', alignItems: 'center', gap: 2,
                      }}>
                        <span style={{ fontSize: 16 }}>{delta > 0 ? '▲' : '▼'}</span>{Math.abs(delta)}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', marginTop: 4 }}>Started P{startPos}</div>
                </div>
              );
            })()}
          </div>
          {/* Race Specs */}
          <div style={{ padding: 16, background: 'rgba(0,0,0,0.3)', borderRadius: 12, border: '1px solid rgba(100,120,200,0.15)' }}>
            <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', fontWeight: 700, letterSpacing: '1px', marginBottom: 8 }}>RACE SPECS</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 12px', fontSize: 11 }}>
              <div><span style={{ color: 'rgba(255,255,255,0.4)' }}>DRS Zones</span></div>
              <div style={{ color: '#00ff88', fontWeight: 700 }}>2</div>
              <div><span style={{ color: 'rgba(255,255,255,0.4)' }}>Throttle</span></div>
              <div style={{ color: '#fff', fontWeight: 700 }}>68%</div>
              <div><span style={{ color: 'rgba(255,255,255,0.4)' }}>Top Speed</span></div>
              <div style={{ color: '#fff', fontWeight: 700 }}>205+ mph</div>
              <div><span style={{ color: 'rgba(255,255,255,0.4)' }}>Pit Stops</span></div>
              <div style={{ color: '#ffd700', fontWeight: 700 }}>Laps 17, 35</div>
            </div>
          </div>
        </div>

        {/* Live race mini-metrics */}
        <div style={{ padding: '0 clamp(12px, 2vw, 24px) clamp(12px, 2vw, 20px)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 12 }}>
          {[
            { id: 'r-ops', title: 'Race Ops', icon: '🏎️', accent: ACCENT,
              dql: `${B}\n| filter json.stepName == "LinzGrandPrix"\n| summarize ops = count()`, unit: 'ops' },
            { id: 'r-lap', title: 'Avg Lap', icon: '⏱️', accent: '#00d4aa',
              dql: `${B}\n| filter json.stepName == "LinzGrandPrix"\n| filter isNotNull(additionalfields.lapTimeSec)\n| summarize avg = round(avg(toDouble(additionalfields.lapTimeSec)), decimals:2)`, unit: 's' },
            { id: 'r-speed', title: 'Top Speed', icon: '💨', accent: '#a78bfa',
              dql: `${B}\n| filter json.stepName == "LinzGrandPrix"\n| filter isNotNull(additionalfields.topSpeedMph)\n| summarize speed = max(toDouble(additionalfields.topSpeedMph))`, unit: 'mph' },
            { id: 'r-pit', title: 'Best Pit', icon: '🔧', accent: '#ffd700',
              dql: `${B}\n| filter json.stepName == "LinzPitStops"\n| filter isNotNull(additionalfields.pitStopTimeSec)\n| summarize best = round(min(toDouble(additionalfields.pitStopTimeSec)), decimals:2)`, unit: 's' },
            { id: 'r-ers', title: 'ERS Charge', icon: '⚡', accent: '#00d4aa',
              dql: `${B}\n| filter json.stepName == "LinzGrandPrix"\n| filter isNotNull(additionalfields.ersStateOfChargePercent)\n| summarize charge = round(avg(toDouble(additionalfields.ersStateOfChargePercent)), decimals:0)`, unit: '%' },
            { id: 'r-errors', title: 'Error Rate', icon: '⚠️', accent: '#e74c3c',
              dql: `${B}\n| summarize total = count(), errors = countIf(json.hasError == true)\n| fieldsAdd rate = round(100.0 * toDouble(errors) / toDouble(total), decimals:1)`, unit: '%' },
          ].map(metric => (
            <LiveMiniMetric key={metric.id} {...metric} />
          ))}
        </div>
      </div>

      {/* ── Driver bar ── */}
      <div style={{
        display: 'flex', flexWrap: 'wrap' as const, gap: 'clamp(8px, 1.5vw, 24px)', marginBottom: 20, padding: '12px clamp(12px, 2vw, 20px)',
        background: 'rgba(20,22,40,0.6)', border: '1px solid rgba(100,120,200,0.15)', borderRadius: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 12, height: 12, borderRadius: '50%', background: ACCENT }} />
          <span style={{ fontWeight: 700, fontSize: 14 }}>LAWSON #30</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 12, height: 12, borderRadius: '50%', background: ACCENT_BLUE }} />
          <span style={{ fontWeight: 700, fontSize: 14 }}>LINDBLAD #41</span>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>
          <span>Lap {currentLap}/52</span><span>·</span><span>312 Channels</span><span>·</span><span>&lt;100ms Latency</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: ACCENT, animation: 'vcarb-pulse 1.5s ease-in-out infinite' }} />
          <span style={{ color: ACCENT, fontWeight: 700, fontSize: 12 }}>LIVE</span>
        </div>
      </div>

      {/* ── Circuit Map ── */}
      <div style={{
        marginBottom: 20, padding: 12,
        background: 'linear-gradient(135deg, rgba(20,22,40,0.85) 0%, rgba(30,32,55,0.75) 100%)',
        border: '1px solid rgba(100,120,200,0.18)', borderTop: `3px solid ${ACCENT}`, borderRadius: 14,
        overflow: 'hidden',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <span style={{ fontSize: 14 }}>🏁</span>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#e0e4ff', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
            Dynatrace Linz Circuit — Live Race Operations (Steps 6-8)
          </span>
        </div>
        <div style={{ overflow: 'hidden' }}>
          <DynatraceLinzCircuitMap stepMetrics={stepMetrics} />
        </div>
      </div>

      {/* ── Race Strategy AI Insights ── */}
      <div style={{
        marginBottom: 20, padding: 16,
        background: 'linear-gradient(135deg, rgba(20,22,40,0.9) 0%, rgba(30,35,65,0.85) 100%)',
        border: '1px solid rgba(100,120,200,0.18)', borderTop: '3px solid #a78bfa', borderRadius: 14,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 16 }}>🧠</span>
            <span style={{ fontSize: 12, fontWeight: 800, color: '#e0e4ff', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
              Race Strategy — Live AI Insights
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#a78bfa', animation: 'vcarb-pulse 1.5s ease-in-out infinite' }} />
            <span style={{ fontSize: 9, color: '#a78bfa', fontWeight: 700 }}>REAL-TIME</span>
          </div>
        </div>
        <RaceStrategyInsights B={B} currentLap={currentLap} />
      </div>

      {/* ── Tile Grid ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', gap: 16 }}>
        {tiles.map((t, i) => {
          if (t.type === 'banner') return <SectionBanner key={`b-${i}`} title={t.title} icon={t.icon} accent={t.accent} />;
          return <DqlTile key={(t as TileDef).id} tile={t as TileDef} />;
        })}
      </div>

      <style>{`${PULSE_KEYFRAME}\n@keyframes vcarb-pulse { 0%,100% { opacity:1 } 50% { opacity:0.3 } }`}</style>
    </div>
  );
}
