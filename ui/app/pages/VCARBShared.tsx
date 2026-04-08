import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  TimeseriesChart,
  CategoricalBarChart,
  DonutChart,
  MeterBarChart,
  GaugeChart,
  HoneycombChart,
  convertQueryResultToTimeseries,
} from '@dynatrace/strato-components-preview/charts';
import { useDqlQuery } from '@dynatrace-sdk/react-hooks';

/* ═══════════════════════════════════════════════════════════════
   VCARB SHARED COMPONENTS — used across parent + sub-dashboards
   ═══════════════════════════════════════════════════════════════ */

export const ACCENT = '#e10600';
export const ACCENT_BLUE = '#1e90ff';
export const COMPANY = 'Visa Cash App Racing Bulls';
export const LIVE_POLL_MS = 15_000; // Auto-refresh interval for live race data

export type Timeframe = '30m' | '1h' | '2h' | '6h' | '12h' | '24h' | '7d';
export const TIMEFRAMES: Timeframe[] = ['30m', '1h', '2h', '6h', '12h', '24h', '7d'];

export function tfToDql(tf: Timeframe): string {
  const map: Record<Timeframe, string> = {
    '30m': 'now()-30m', '1h': 'now()-1h', '2h': 'now()-2h',
    '6h': 'now()-6h', '12h': 'now()-12h', '24h': 'now()-24h', '7d': 'now()-7d',
  };
  return map[tf];
}

export function fmtNum(n: number): string {
  if (n === 0) return '0';
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (abs >= 10_000) return (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
  if (abs >= 1_000) return n.toLocaleString('en-US', { maximumFractionDigits: 1 });
  if (Number.isInteger(n)) return n.toString();
  return n.toFixed(2);
}

export function SectionBanner({ title, icon, accent }: { title: string; icon: string; accent: string }) {
  return (
    <div style={{
      gridColumn: '1 / -1', padding: '10px 18px',
      background: `linear-gradient(135deg, ${accent}15, ${accent}05)`,
      border: `1px solid ${accent}33`, borderLeft: `4px solid ${accent}`, borderRadius: 8,
    }}>
      <span style={{ fontSize: 14, fontWeight: 800, color: accent, letterSpacing: '1.5px', textTransform: 'uppercase' }}>
        {icon} {title}
      </span>
    </div>
  );
}

export function HeroMetric({ value, unit, subtitle, accent }: { value: string; unit?: string; subtitle: string; accent: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '12px 0' }}>
      <div style={{ fontSize: 'clamp(28px, 3.5vw, 38px)', fontWeight: 900, color: '#fff', letterSpacing: '-1px' }}>
        {value}<span style={{ fontSize: 16, color: accent, fontWeight: 600, marginLeft: 4 }}>{unit}</span>
      </div>
      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>{subtitle}</div>
    </div>
  );
}

export type VizType = 'heroMetric' | 'timeseries' | 'categoricalBar' | 'donut' | 'gauge' | 'meterBar' | 'table' | 'tyreQuad' | 'heatmap' | 'custom';

export interface TileDef {
  id: string;
  title: string;
  dql: string;
  width: 1 | 2 | 3;
  icon?: string;
  accent?: string;
  type: VizType;
  unit?: string;
  subtitle?: string;
  gaugeMax?: number;
  meterTarget?: number;
}

export function DqlTile({ tile }: { tile: TileDef }) {
  const { data, isLoading, error, refetch } = useDqlQuery({ body: { query: tile.dql } });
  useEffect(() => { const id = setInterval(() => refetch(), LIVE_POLL_MS); return () => clearInterval(id); }, [refetch]);
  const [showDql, setShowDql] = useState(false);
  const [copied, setCopied] = useState(false);
  const handleCopy = useCallback(() => { navigator.clipboard.writeText(tile.dql); setCopied(true); setTimeout(() => setCopied(false), 1500); }, [tile.dql]);
  const colSpan = tile.width === 3 ? '1 / -1' : tile.width === 2 ? 'span 2' : 'span 1';
  const accent = tile.accent || ACCENT;
  const isCompact = tile.type === 'heroMetric' || tile.type === 'gauge' || tile.type === 'meterBar';

  const renderContent = () => {
    if (isLoading && !data?.records?.length) return <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, textAlign: 'center', padding: 20 }}>Loading telemetry...</div>;
    if (error || !data?.records?.length) return <div style={{ color: 'rgba(255,255,255,0.25)', fontSize: 12, textAlign: 'center', padding: 20 }}>Awaiting data...</div>;

    const rec = data.records[0]!;
    const keys = Object.keys(rec).filter(k => !k.startsWith('__'));

    switch (tile.type) {
      case 'heroMetric': {
        const val = rec[keys[0]];
        const num = typeof val === 'number' ? val : Number(val);
        if (isNaN(num)) return <HeroMetric value={String(val || '—')} unit={tile.unit} subtitle={tile.subtitle || ''} accent={accent} />;
        return <HeroMetric value={fmtNum(num)} unit={tile.unit} subtitle={tile.subtitle || ''} accent={accent} />;
      }
      case 'gauge': {
        const val = rec[keys[0]];
        const num = typeof val === 'number' ? val : Number(val) || 0;
        return (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
            <GaugeChart value={num} min={0} max={tile.gaugeMax || 100} />
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>{tile.subtitle}</div>
          </div>
        );
      }
      case 'meterBar': {
        const val = rec[keys[0]];
        const num = typeof val === 'number' ? val : Number(val) || 0;
        return (
          <div style={{ padding: '10px 0' }}>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#fff', textAlign: 'center', marginBottom: 8 }}>
              {fmtNum(num)}<span style={{ fontSize: 12, color: accent, marginLeft: 4 }}>{tile.unit}</span>
            </div>
            <MeterBarChart value={num} min={0} max={tile.gaugeMax || 100} color={accent} />
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', textAlign: 'center', marginTop: 6 }}>{tile.subtitle}</div>
          </div>
        );
      }
      case 'timeseries': {
        const ts = convertQueryResultToTimeseries(data);
        if (!ts?.length) return <div style={{ color: 'rgba(255,255,255,0.25)', fontSize: 12 }}>No series</div>;
        return <div style={{ width: '100%', height: 250 }}><TimeseriesChart data={ts} /></div>;
      }
      case 'categoricalBar':
        return <div style={{ width: '100%', height: 250 }}><CategoricalBarChart data={data.records.map((r: any) => {
          if (!r) return { category: '', value: 0 };
          const k = Object.keys(r).filter(x => !x.startsWith('__'));
          return { category: String(r[k[0]] || ''), value: Number(r[k[1]]) || 0 };
        }).slice(0, 10)} /></div>;
      case 'donut': {
        const slices = data.records.map((r: any) => {
          if (!r) return { category: '', value: 0 };
          const k = Object.keys(r).filter(x => !x.startsWith('__'));
          return { category: String(r[k[0]] || ''), value: Number(r[k[1]]) || 0 };
        }).slice(0, 8);
        return <div style={{ width: '100%', height: 250 }}><DonutChart data={{ slices }}><DonutChart.Legend /></DonutChart></div>;
      }
      case 'table': {
        const records = data.records.filter((r: any) => r !== null) as any[];
        if (!records.length) return null;
        const tkeys = Object.keys(records[0]).filter(k => !k.startsWith('__'));
        return (
          <div style={{ overflowX: 'auto', fontSize: 12 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>{tkeys.map(k => <th key={k} style={{ padding: '6px 10px', textAlign: 'left', borderBottom: '1px solid rgba(100,120,200,0.2)', color: 'rgba(255,255,255,0.6)', fontWeight: 600 }}>{k}</th>)}</tr>
              </thead>
              <tbody>
                {records.slice(0, 12).map((r: any, i: number) => (
                  <tr key={i}>{tkeys.map(k => <td key={k} style={{ padding: '5px 10px', borderBottom: '1px solid rgba(100,120,200,0.08)', color: '#e0e4ff' }}>{String(r[k] ?? '')}</td>)}</tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      }
      case 'heatmap': {
        const hcData: Array<{ name: string; value: number }> = [];
        for (const r of data.records) {
          if (!r) continue;
          const rKeys = Object.keys(r).filter(x => !x.startsWith('__'));
          const nm = rKeys.length > 1 ? String(r[rKeys[0]] ?? 'Item') : 'Item';
          const vl = rKeys.length > 1 ? (Number(r[rKeys[1]]) || 0) : (Number(r[rKeys[0]]) || 0);
          if (vl > 0) hcData.push({ name: nm, value: vl });
        }
        if (!hcData.length) return <div style={{ color: 'rgba(255,255,255,0.25)', fontSize: 12 }}>No data</div>;
        return <div style={{ width: '100%', height: 250 }}><HoneycombChart data={hcData} height={250} shape="hexagon" showLabels /></div>;
      }
      default:
        return null;
    }
  };

  return (
    <div style={{
      gridColumn: colSpan,
      background: 'linear-gradient(135deg, rgba(20,22,40,0.85) 0%, rgba(30,32,55,0.75) 100%)',
      border: '1px solid rgba(100,120,200,0.18)',
      borderTop: `3px solid ${accent}`,
      borderRadius: 14, padding: 18,
      display: 'flex', flexDirection: 'column',
      minHeight: isCompact ? 170 : 330,
      boxShadow: `0 4px 24px rgba(0,0,0,0.3), 0 0 40px ${accent}08`,
      backdropFilter: 'blur(12px)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: '#e0e4ff', letterSpacing: '0.5px', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 8 }}>
          {tile.icon && <span style={{ fontSize: 18 }}>{tile.icon}</span>}
          {tile.title}
        </span>
        <button onClick={() => setShowDql(!showDql)} style={{
          background: 'rgba(100,120,200,0.15)', border: '1px solid rgba(100,120,200,0.3)',
          borderRadius: 6, color: '#8899cc', fontSize: 10, padding: '3px 8px', cursor: 'pointer',
        }}>
          {showDql ? 'Hide DQL' : 'Show DQL'}
        </button>
      </div>
      {showDql && (
        <div style={{
          background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(100,120,200,0.2)',
          borderRadius: 6, padding: 10, marginBottom: 10, fontSize: 11,
          fontFamily: 'monospace', color: '#99aadd', whiteSpace: 'pre-wrap',
          wordBreak: 'break-all', position: 'relative',
        }}>
          {tile.dql}
          <button onClick={handleCopy} style={{
            position: 'absolute', top: 6, right: 6,
            background: copied ? 'rgba(39,174,96,0.3)' : 'rgba(100,120,200,0.2)',
            border: '1px solid rgba(100,120,200,0.3)', borderRadius: 4,
            color: copied ? '#27ae60' : '#8899cc', fontSize: 10, padding: '2px 8px', cursor: 'pointer',
          }}>
            {copied ? '✓ Copied' : 'Copy'}
          </button>
        </div>
      )}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        {renderContent()}
      </div>
    </div>
  );
}

/* ── Shared dashboard wrapper style ── */
export const DASHBOARD_BG_STYLE: React.CSSProperties = {
  minHeight: '100vh',
  background: 'linear-gradient(135deg, #0a0c1a 0%, #101428 50%, #0d0f20 100%)',
  padding: 'clamp(16px, 2.5vw, 24px) clamp(20px, 3vw, 32px)',
  color: '#e0e4ff',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
};

export const PULSE_KEYFRAME = `@keyframes vcarb-pulse { 0%,100% { opacity:1 } 50% { opacity:0.3 } }`;

/* ═══════════════════════════════════════════════════════════════
   useActiveRaceId — DQL takeLast to get the most recent raceId
   Ensures every dashboard always shows the latest race only.
   ═══════════════════════════════════════════════════════════════ */
export function useActiveRaceId(): { raceId: string | null; isLoading: boolean } {
  const { data, isLoading, refetch } = useDqlQuery({
    body: {
      query: `fetch bizevents
| filter json.companyName == "${COMPANY}"
| filter isNotNull(additionalfields.raceId)
| sort timestamp desc
| summarize latestRace = takeLast(additionalfields.raceId)`,
    },
  });
  useEffect(() => { const id = setInterval(() => refetch(), LIVE_POLL_MS); return () => clearInterval(id); }, [refetch]);

  const raceId = useMemo(() => {
    if (!data?.records?.[0]) return null;
    const val = data.records[0]!['latestRace'];
    return val ? String(val) : null;
  }, [data]);

  return { raceId, isLoading };
}

/**
 * Build a base DQL filter string scoped to the active race.
 * Returns empty string if no raceId, so queries still work (just unfiltered).
 */
export function raceBase(raceId: string | null, from: string): string {
  const base = `fetch bizevents\n| filter json.companyName == "${COMPANY}"\n| filter timestamp >= ${from}`;
  if (!raceId) return base;
  return `${base}\n| filter additionalfields.raceId == "${raceId}"`;
}
