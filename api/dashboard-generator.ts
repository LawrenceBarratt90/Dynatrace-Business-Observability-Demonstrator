/**
 * Dashboard Generator Utility
 * Uses prompt templates and patterns from _external/dynatrace-kpi-dashboard-generator
 * to generate high-quality Gen 3 KPI dashboards via Claude Opus 4.5
 */

import { jsonrepair } from 'jsonrepair';

export function buildDashboardGenerationPrompt(
  company: string,
  journeyType: string,
  discoveredFields: Array<{ name: string; type: 'string' | 'numeric'; sampleValue?: string | number }> | null = null,
  customPrompt?: string
): string {
  const companyLiteral = company.replace(/"/g, '\\"');

  // Build context from discovered fields
  const numericFields = (discoveredFields || [])
    .filter(f => f.type === 'numeric')
    .map(f => `${f.name} (e.g. ${f.sampleValue})`);
  const stringFields = (discoveredFields || [])
    .filter(f => f.type === 'string')
    .map(f => `${f.name} (e.g. "${f.sampleValue}")`);
  const hasGeo = (discoveredFields || []).some(
    f => f.name.includes('lat') || f.name.includes('lon') || f.name.includes('geo') || f.name.includes('location')
  );

  const fieldContext =
    discoveredFields && discoveredFields.length > 0
      ? `\n\nDISCOVERED BIZEVENT FIELDS:\n- Numeric: ${numericFields.length > 0 ? numericFields.join(', ') : 'none'}\n- Categorical: ${stringFields.length > 0 ? stringFields.join(', ') : 'none'}\n- Geo-enabled: ${hasGeo}\n\nUse these fields in DQL. Base filter: | filter json.companyName == "${companyLiteral}" | filter json.journeyType == "${journeyType}"`
      : `\n\nNo historical BizEvents yet. Generate the dashboard with industry-appropriate field names for ${company}'s ${journeyType}.\nBase filter: | filter json.companyName == "${companyLiteral}" | filter json.journeyType == "${journeyType}"`;

  // If the customPrompt is a C-Suite analysis, extract the most actionable KPI signals from it
  // and inject them as explicit tile guidance so the dashboard reflects what Copilot recommended.
  const isCsuiteContext = customPrompt && customPrompt.toLowerCase().includes('c-suite analysis');
  const customDirective = customPrompt
    ? isCsuiteContext
      ? `\n\nC-SUITE ANALYSIS (use this to drive KPI section choices and tile content — highest priority):\n${String(customPrompt).slice(0, 2000)}\n\nBased on the above analysis: identify the top 5–8 KPIs mentioned or implied, and build dashboard sections directly around them. Each recommended journey area should become a dashboard section with matching DQL tiles.\n`
      : `\n\nUSER FOCUS (highest priority — shape all sections around this): "${String(customPrompt).slice(0, 1200)}"\n`
    : '';

  // Prompt template derived from _external/dynatrace-kpi-dashboard-generator/skills/dynatrace-kpi-dashboard-generator/SKILL.md
  const prompt = `You are a Dynatrace Solutions Engineer building a Gen 3 KPI dashboard for ${company} - ${journeyType}.${customDirective}

${isCsuiteContext ? 'Produce a complete, valid Dynatrace Gen 3 dashboard JSON shaped entirely around the C-Suite analysis above.' : `Research 15–20 industry-specific KPIs for ${company}'s ${journeyType} domain. Produce a complete, valid Dynatrace Gen 3 dashboard JSON.`}${fieldContext}

MANDATORY STRUCTURAL RULES (FOLLOW EXACTLY):

### 1. HEADER — Two side-by-side markdown tiles

Tile "0" (Logo):
- type: "markdown"
- content: "![](https://logo.clearbit.com/${company.toLowerCase().replace(/\s+/g, '')}.com)"
- layout: { x: 0, y: 0, w: 6, h: 2 }

Tile "1" (Title):
- type: "markdown"
- content: "# ${company} | ${journeyType} Dashboard\\n\\nReal-time KPI monitoring..."
- layout: { x: 6, y: 0, w: 18, h: 2 }

### 2. MAP TILE (REQUIRED, ABOVE THE FOLD)

Immediately after header at y:2. Use "bubbleMap", "dotMap", or "connectionMap".
- Full width: w: 24, h: 8
- Position: y: 2 (directly under header)
- Feed from an event type with geo.location.latitude and geo.location.longitude
- When inserting, bump all following tiles' y by exactly 8; prevent collisions

### 3. SECTION DIVIDERS (REQUIRED between sections)

Use "data" tiles with query "data record(section=\\"NAME\\")", visualization "singleValue":
- type: "data"
- query: "data record(section=\\"SectionName\\")"
- visualization: "singleValue"
- height: h: 1
- width: w: 24
- visualizationSettings.singleValue.colorThresholdTarget: "background"
- Distinct color per section. Suggestions: Executive #1a5276, Operations #1e8449, Customer #6c3483, Revenue #935116, Quality #1a252f

### 4. TILE HEIGHT GUIDELINES

- h: 1 → Section dividers only
- h: 2 → Single-value KPI tiles (singleValue visualization with 3 threshold rules)
- h: 4 → Standard charts (MINIMUM for line, bar, area, donut, honeycomb). Never h:2 or h:3 for charts
- h: 5+ → Tables, treemaps, complex multi-series

### 5. REQUIRED SECTIONS (tailor to ${company}'s ${journeyType} domain)

Minimum 5 sections:
- Executive Summary (4–6 top-line KPIs as singleValue with gauge-style thresholds)
- [Industry-specific 1] — e.g., Revenue & Sales, Manufacturing & Quality, Patient Outcomes
- [Industry-specific 2] — e.g., Operations, Supply Chain, Customer Journey
- [Industry-specific 3] — e.g., Customer Experience, Clinical Performance, Field Service
- [Industry-specific 4] — e.g., Commercial, R&D, Compliance

### 6. VISUALIZATION VARIETY (REQUIRED MIX — do NOT use only donut + area)

- singleValue: KPI totals with 3 threshold colorRules (green/yellow/red), colorThresholdTarget: "background"
- lineChart / areaChart: Time trends via makeTimeseries
- barChart / categoricalBar: Categorical over time via makeTimeseries with by:{groupField}, NOT summarize
- donutChart / pieChart: Category share via summarize by:{field} (NO time axis)
- honeycomb: Many small categories (6+), needs visualizationSettings.honeycomb.dataMappings.value
- bubbleMap / dotMap: Geo data (required for map tile)
- table: Raw detail rows with limit
- WHEN SWAPPING from donut/pie to bar/honeycomb: REMOVE visualizationSettings.chartSettings.circleChartSettings entirely

### 7. DQL QUERY PATTERNS

- Always start: fetch bizevents | filter json.companyName == "${companyLiteral}" | filter json.journeyType == "${journeyType}"
- singleValue tiles: Use summarize (e.g., summarize count = count(), revenue = sum(total_amount))
- lineChart / areaChart: Use makeTimeseries (e.g., makeTimeseries val = avg(response_time), bins: 20)
- barChart / categoricalBar: Use makeTimeseries with by:{groupField}, bins: 20. NEVER summarize for bar charts
- donutChart / pieChart: Use summarize by:{field}, NO time component
- Ratio metrics: sum(numerator) / sum(denominator) * 100, NEVER avg(percent_field)
- Insert variable filters BEFORE aggregation (BEFORE makeTimeseries or summarize)
- NEVER use snake_case functions such as count_if, min_if, max_if, sum_if, avg_if.
- Use Dynatrace DQL function names exactly (camelCase where applicable), e.g. countIf(condition).
- If uncertain about conditional aggregation, filter rows first, then use count().

### 8. VARIABLES (REQUIRED, 3–5 multi-select)

Type: "query", multiple: true
- Source each from: fetch bizevents | filter json.companyName == "${companyLiteral}" | dedup <fieldName> | fields <fieldName>
- Choose dimensions relevant to ${company}: e.g., region, product, channel, department, segment
- Apply as: | filter in(<field>, $VariableName) BEFORE makeTimeseries/summarize

### 9. LAYOUT (24-column grid)

- X positions: 0, 6, 12, 18 (width 6 each) OR 0, 8, 16 (width 8 each) OR 0, 12 (width 12 each)
- Minimize vertical gaps. Y increments: +1 (divider h:1), +2 (KPI row h:2), +4 (chart row h:4)
- NO tile collisions — track Y carefully
- Example flow:
  - y: 0 → header (h: 2)
  - y: 2 → map (h: 8)
  - y: 10 → divider (h: 1)
  - y: 11 → KPI row (h: 2)
  - y: 13 → chart row (h: 4)
  - y: 17 → next divider (h: 1)

### OUTPUT REQUIREMENTS

- Return ONLY valid JSON, NO markdown fences, NO explanation, NO comments
- Gen 3 schema: { "tiles": { "0": {...}, ... }, "layouts": { "0": {x, y, w, h}, ... }, "variables": [...], "settings": {"defaultTimeframe": {"value": {"from": "now()-2h", "to": "now()"}, "enabled": true}}, "annotations": [] }
- Tile keys: stringified integers starting from "0"
- Layout keys: match tile keys exactly
- Target: 40–60 tiles (HARD MAX 80)
- Map tile position: tile "2" at y: 2`;

  return prompt;
}

/**
 * Extracts JSON from text response, handling markdown fences and invalid wrapping
 */
export function extractDashboardJson(content: string): Record<string, any> {
  // Strip markdown code fences if present
  let cleaned = content.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');

  // Try to find JSON object
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('No JSON object found in response');
  }

  const rawJson = jsonMatch[0];

  const repairUnescapedInnerQuotes = (text: string): string => {
    let out = '';
    let inString = false;
    let escape = false;

    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (escape) {
        out += ch;
        escape = false;
        continue;
      }
      if (ch === '\\') {
        out += ch;
        escape = true;
        continue;
      }
      if (ch === '"') {
        if (!inString) {
          inString = true;
          out += ch;
          continue;
        }

        let j = i + 1;
        while (j < text.length && /\s/.test(text[j])) j++;
        const next = text[j] || '';
        const looksLikeTerminator = next === ',' || next === '}' || next === ']' || next === ':';
        if (looksLikeTerminator) {
          inString = false;
          out += ch;
        } else {
          out += '\\"';
        }
        continue;
      }
      out += ch;
    }

    return out;
  };

  const balanceLikelyTruncated = (text: string): string => {
    let inString = false;
    let escape = false;
    let curly = 0;
    let square = 0;

    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (escape) {
        escape = false;
        continue;
      }
      if (ch === '\\') {
        escape = true;
        continue;
      }
      if (ch === '"') {
        inString = !inString;
        continue;
      }
      if (inString) continue;
      if (ch === '{') curly++;
      else if (ch === '}') curly = Math.max(0, curly - 1);
      else if (ch === '[') square++;
      else if (ch === ']') square = Math.max(0, square - 1);
    }

    let out = text;
    if (inString) out += '"';
    out += ']'.repeat(square);
    out += '}'.repeat(curly);
    return out;
  };

  const attempts: string[] = [];
  attempts.push(rawJson);

  const repairedBasic = rawJson
    .replace(/\r/g, '')
    .replace(/[\u0000-\u001F]/g, ' ')
    .replace(/,\s*([}\]])/g, '$1')
    .replace(/:\s*([^,}\]]+?)([}\]])/g, (match, value, bracket) => {
      // Fix missing commas before closing braces/brackets after property values
      return `: ${value.trim()},${bracket}`.replace(/,([}\]])/, '$1');
    })
    .replace(/([}\]])\s*"([^"]+)"\s*:/g, (match, bracket, key) => {
      // Add missing comma between consecutive properties
      return `${bracket},"${key}":`;
    })
    .replace(/([{,]\s*)([A-Za-z_][A-Za-z0-9_]*)\s*:/g, '$1"$2":')
    .replace(/'([^'\\]*(?:\\.[^'\\]*)*)'/g, '"$1"')
    .replace(/\u201c|\u201d/g, '"')
    .replace(/\u2018|\u2019/g, "'");
  attempts.push(repairedBasic);

  const repairedQuotes = repairUnescapedInnerQuotes(repairedBasic);
  attempts.push(repairedQuotes);
  attempts.push(balanceLikelyTruncated(repairedBasic));
  attempts.push(balanceLikelyTruncated(repairedQuotes));

  try {
    attempts.push(jsonrepair(rawJson));
    attempts.push(jsonrepair(repairedBasic));
    attempts.push(jsonrepair(repairedQuotes));
  } catch {
    // Ignore jsonrepair failure and keep manual repair attempts only
  }

  let parsed: any = null;
  const parseErrors: string[] = [];
  for (const attempt of attempts) {
    try {
      parsed = JSON.parse(attempt);
      break;
    } catch (e: any) {
      parseErrors.push(e?.message || String(e));
    }
  }

  if (!parsed) {
    throw new Error(`Invalid JSON response from model after repairs: ${parseErrors[parseErrors.length - 1] || 'Unknown parse error'}`);
  }

  const buildFallbackLayouts = (tiles: Record<string, any>): Record<string, { x: number; y: number; w: number; h: number }> => {
    const keys = Object.keys(tiles || {}).sort((a, b) => {
      const na = Number(a);
      const nb = Number(b);
      if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
      return a.localeCompare(b);
    });

    const layouts: Record<string, { x: number; y: number; w: number; h: number }> = {};
    let cursorY = 0;

    const isMap = (tile: any) => tile?.type === 'bubbleMap' || tile?.type === 'dotMap' || tile?.type === 'connectionMap';
    const isMarkdown = (tile: any) => tile?.type === 'markdown';
    const isDataSingleValue = (tile: any) => tile?.type === 'data' && tile?.visualization === 'singleValue';
    const isTable = (tile: any) => tile?.type === 'table' || tile?.visualization === 'table';

    // Header convention if present
    if (tiles['0'] && isMarkdown(tiles['0'])) {
      layouts['0'] = { x: 0, y: 0, w: 6, h: 2 };
    }
    if (tiles['1'] && isMarkdown(tiles['1'])) {
      layouts['1'] = { x: 6, y: 0, w: 18, h: 2 };
    }
    if (layouts['0'] || layouts['1']) cursorY = 2;

    // Prefer map directly under header when present
    for (const k of keys) {
      if (layouts[k]) continue;
      const tile = tiles[k];
      if (isMap(tile)) {
        layouts[k] = { x: 0, y: cursorY, w: 24, h: 8 };
        cursorY += 8;
        break;
      }
    }

    let col = 0;
    let rowY = cursorY;
    const colXs = [0, 6, 12, 18];

    for (const k of keys) {
      if (layouts[k]) continue;
      const tile = tiles[k];

      // Section divider-style tiles
      if (isDataSingleValue(tile) && /data\s+record\(section=/i.test(String(tile?.query || ''))) {
        if (col !== 0) {
          rowY += 4;
          col = 0;
        }
        layouts[k] = { x: 0, y: rowY, w: 24, h: 1 };
        rowY += 1;
        continue;
      }

      const w = isTable(tile) ? 12 : 6;
      const h = isDataSingleValue(tile) ? 2 : (isTable(tile) ? 5 : 4);

      if (w === 12) {
        if (col !== 0) {
          rowY += 4;
          col = 0;
        }
        layouts[k] = { x: 0, y: rowY, w, h };
        rowY += h;
        continue;
      }

      layouts[k] = { x: colXs[col], y: rowY, w, h };
      col += 1;
      if (col >= 4) {
        col = 0;
        rowY += h;
      }
    }

    return layouts;
  };

  // Validate required fields
  if (!parsed.tiles || typeof parsed.tiles !== 'object') {
    throw new Error('Generated JSON missing "tiles" object');
  }

  if (!parsed.layouts || typeof parsed.layouts !== 'object') {
    parsed.layouts = buildFallbackLayouts(parsed.tiles);
  } else {
    // Fill any missing layout entries for existing tiles.
    const fallback = buildFallbackLayouts(parsed.tiles);
    for (const key of Object.keys(parsed.tiles)) {
      const l = parsed.layouts[key];
      if (!l || !Number.isFinite(l.x) || !Number.isFinite(l.y) || !Number.isFinite(l.w) || !Number.isFinite(l.h)) {
        parsed.layouts[key] = fallback[key] || { x: 0, y: 0, w: 6, h: 4 };
      }
    }
  }

  const isMapTile = (tile: any): boolean => {
    if (!tile) return false;
    const type = String(tile?.type || '').trim();
    const viz = String(tile?.visualization || '').trim();
    return (
      type === 'bubbleMap' ||
      type === 'dotMap' ||
      type === 'connectionMap' ||
      type === 'choroplethMap' ||
      ((type === 'data' || type === 'table') &&
        (viz === 'bubbleMap' || viz === 'dotMap' || viz === 'connectionMap' || viz === 'choroplethMap'))
    );
  };

  const ensureRequiredMapTile = (dashboardObj: Record<string, any>): void => {
    if (!dashboardObj?.tiles || typeof dashboardObj.tiles !== 'object') return;
    if (!dashboardObj.layouts || typeof dashboardObj.layouts !== 'object') {
      dashboardObj.layouts = {};
    }

    const hasMap = Object.values(dashboardObj.tiles).some(isMapTile);
    if (hasMap) return;

    const numericKeys = Object.keys(dashboardObj.tiles)
      .map(k => Number(k))
      .filter(n => Number.isFinite(n));
    const nextIdx = numericKeys.length > 0 ? Math.max(...numericKeys) + 1 : 2;
    const newKey = String(nextIdx);

    // Keep required map placement immediately below header.
    for (const [k, layout] of Object.entries(dashboardObj.layouts as Record<string, any>)) {
      const y = Number((layout as any)?.y);
      if (k !== '0' && k !== '1' && Number.isFinite(y) && y >= 2) {
        (dashboardObj.layouts as Record<string, any>)[k] = {
          ...(layout as Record<string, any>),
          y: y + 8,
        };
      }
    }

    dashboardObj.tiles[newKey] = {
      type: 'bubbleMap',
      query: 'fetch bizevents | filter isNotNull(geo.location.latitude) and isNotNull(geo.location.longitude) | summarize count = count() by:{geo.location.latitude}, geo.location.longitude, json.location | limit 500',
      visualizationSettings: {
        bubbleMap: {
          latitudeField: 'geo.location.latitude',
          longitudeField: 'geo.location.longitude',
          labelField: 'json.location',
          valueField: 'count',
        },
      },
    };
    dashboardObj.layouts[newKey] = { x: 0, y: 2, w: 24, h: 8 };
  };

  ensureRequiredMapTile(parsed);

  // Safety check
  const tileCount = Object.keys(parsed.tiles).length;
  if (tileCount > 80) {
    throw new Error(`Dashboard exceeds 80-tile safety cap (${tileCount} tiles)`);
  }

  return parsed;
}

/**
 * Validates dashboard structure before deployment
 */
export function validateDashboardJson(dashboard: Record<string, any>): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check required root fields
  if (!dashboard.tiles || typeof dashboard.tiles !== 'object') {
    errors.push('Missing or invalid "tiles" object');
  }
  if (!dashboard.layouts || typeof dashboard.layouts !== 'object') {
    errors.push('Missing or invalid "layouts" object');
  }

  // Check tile count
  const tileCount = Object.keys(dashboard.tiles || {}).length;
  if (tileCount === 0) {
    errors.push('Dashboard has no tiles');
  }
  if (tileCount > 80) {
    errors.push(`Dashboard has ${tileCount} tiles (max 80)`);
  }

  // Validate map tile exists
  const hasMap = Object.values(dashboard.tiles || {}).some((t: any) => {
    const type = String(t?.type || '').trim();
    const viz = String(t?.visualization || '').trim();
    return (
      type === 'bubbleMap' ||
      type === 'dotMap' ||
      type === 'connectionMap' ||
      type === 'choroplethMap' ||
      ((type === 'data' || type === 'table') &&
        (viz === 'bubbleMap' || viz === 'dotMap' || viz === 'connectionMap' || viz === 'choroplethMap'))
    );
  });
  if (!hasMap) {
    errors.push('Dashboard missing required map tile (bubbleMap, dotMap, or connectionMap)');
  }

  // Validate header tiles
  const tiles = dashboard.tiles || {};
  const headerTiles = ['0', '1'].filter(k => k in tiles).map(k => tiles[k]);
  if (headerTiles.length < 2) {
    errors.push('Dashboard missing header tiles (tiles "0" and "1")');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
