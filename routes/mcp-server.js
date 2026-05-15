/**
 * MCP Server Route — Exposes BizObs dashboard generation as MCP tools.
 *
 * Uses the Model Context Protocol SDK with Streamable HTTP transport (stateless mode)
 * so any MCP client can consume it: AppEngine proxy (via EdgeConnect), VS Code, etc.
 *
 * Tools:
 *   - generate_dashboard: Generates a dashboard JSON for a given company & journey type
 *   - list_available_companies: Lists companies with active business events in Dynatrace
 */

import express from 'express';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';

const router = express.Router();

function extractFieldFromPrompt(prompt, regex) {
  const match = String(prompt || '').match(regex);
  return match ? String(match[1] || '').trim() : '';
}

function pickFocus(text) {
  const lower = String(text || '').toLowerCase();
  if (lower.includes('revenue') || lower.includes('sales') || lower.includes('conversion')) {
    return {
      summary: 'Revenue, conversion, and commercial performance',
      riskLevel: 'Medium',
      businessPattern: 'Top-of-funnel conversion sensitivity',
      points: [
        'Revenue is most likely being constrained by conversion friction or abandoned journeys.',
        'Lead-to-close and step-to-step drop-off should be treated as executive KPIs.',
        'Operational issues matter because they directly affect commercial outcomes.',
      ],
    };
  }
  if (lower.includes('operations') || lower.includes('latency') || lower.includes('sla') || lower.includes('incident')) {
    return {
      summary: 'Operational resilience and SLA health',
      riskLevel: 'High',
      businessPattern: 'Service reliability sensitivity',
      points: [
        'Execution latency and error rates likely have a direct customer impact.',
        'Executive reporting should emphasize SLA attainment and stability over raw throughput.',
        'Bottlenecks in a single journey step can cascade across the whole flow.',
      ],
    };
  }
  if (lower.includes('customer') || lower.includes('experience') || lower.includes('churn') || lower.includes('nps')) {
    return {
      summary: 'Customer experience and retention risk',
      riskLevel: 'Medium',
      businessPattern: 'Journey completion sensitivity',
      points: [
        'Customer experience likely degrades when key steps are slow or inconsistent.',
        'Retention risk should be tied to friction, abandonment, and repeated failures.',
        'The dashboard should make it obvious where customers leave the journey.',
      ],
    };
  }

  return {
    summary: 'Balanced executive journey health',
    riskLevel: 'Medium',
    businessPattern: 'Cross-functional journey health',
    points: [
      'Track end-to-end journey completion and the primary business KPI tied to that flow.',
      'Use operational indicators to explain any drop in business performance.',
      'Keep the analysis focused on decisions an executive team can act on quickly.',
    ],
  };
}

function suggestJourneys(text, fallbackJourney) {
  const lower = String(text || '').toLowerCase();
  const journeys = [];
  if (lower.includes('checkout') || lower.includes('payment') || lower.includes('purchase')) journeys.push('Checkout & Payment');
  if (lower.includes('onboarding') || lower.includes('signup') || lower.includes('registration')) journeys.push('Onboarding & Registration');
  if (lower.includes('claim') || lower.includes('insurance')) journeys.push('Claims & Policy Servicing');
  if (lower.includes('support') || lower.includes('service')) journeys.push('Support & Issue Resolution');
  if (lower.includes('booking') || lower.includes('reservation') || lower.includes('order')) journeys.push('Booking / Reservation / Order Flow');
  if (journeys.length === 0) journeys.push(String(fallbackJourney || 'Customer Journey'));
  return [...new Set(journeys)].slice(0, 4);
}

function suggestKpis(text) {
  const lower = String(text || '').toLowerCase();
  const kpis = [
    'Journey completion rate',
    'Median step latency',
    'Error rate per step',
  ];
  if (lower.includes('revenue') || lower.includes('sales') || lower.includes('purchase') || lower.includes('payment')) {
    kpis.push('Revenue per conversion', 'Cart / form abandonment rate');
  }
  if (lower.includes('sla') || lower.includes('latency') || lower.includes('operations') || lower.includes('incident')) {
    kpis.push('SLA compliance', 'P95 response time', 'MTTR');
  }
  if (lower.includes('customer') || lower.includes('experience') || lower.includes('nps') || lower.includes('churn')) {
    kpis.push('Customer satisfaction proxy', 'Retention risk', 'Repeat failure rate');
  }
  return [...new Set(kpis)].slice(0, 6);
}

// Import the generate function from the ai-dashboard route by re-using its logic.
// We call the local HTTP endpoint rather than importing internals directly — keeps coupling loose.
const SERVER_PORT = process.env.PORT || 8080;
const LOCAL_BASE = `http://127.0.0.1:${SERVER_PORT}`;

/**
 * Create a fresh McpServer instance.
 * In stateless mode we create a new server + transport per request.
 */

// POST /api/mcp/assist — local Dynatrace Assist-style executive summary.
router.post('/assist', async (req, res) => {
  try {
    const { prompt, companyName, domain, requirements, journeyType } = req.body || {};

    if (!prompt) {
      return res.status(400).json({ success: false, error: 'Prompt required' });
    }

    const promptText = String(prompt);
    const company = String(companyName || extractFieldFromPrompt(promptText, /Company\s*[:\-]\s*(.+)/i) || 'the business').trim();
    const businessDomain = String(domain || extractFieldFromPrompt(promptText, /Domain\s*[:\-]\s*(.+)/i) || 'unknown domain').trim();
    const reqText = String(requirements || extractFieldFromPrompt(promptText, /Requirements\s*[:\-]\s*(.+)/i) || 'business observability analysis').trim();
    const journey = String(journeyType || extractFieldFromPrompt(promptText, /Journey\s*Type\s*[:\-]\s*(.+)/i) || 'customer journey').trim();

    const lowerReq = `${promptText} ${reqText} ${businessDomain}`.toLowerCase();
    const focus = pickFocus(lowerReq);
    const journeys = suggestJourneys(lowerReq, journey);
    const kpis = suggestKpis(lowerReq);

    const content = [
      '# C-Suite Analysis',
      '',
      '## Executive Summary',
      `- **Company:** ${company}`,
      `- **Domain:** ${businessDomain}`,
      `- **Primary focus:** ${focus.summary}`,
      `- **Risk level:** ${focus.riskLevel}`,
      `- **Business pattern:** ${focus.businessPattern}`,
      '',
      '## What This Means',
      ...focus.points.map((point) => `- ${point}`),
      '',
      '## Recommended Journey Candidates',
      ...journeys.map((item) => `- ${item}`),
      '',
      '## KPIs To Watch',
      ...kpis.map((item) => `- ${item}`),
      '',
      '## Suggested Storyline',
      `- ${company} should track the ${journeys[0] || journey} experience from start to finish, then correlate business outcomes with operational friction.`,
      '- The dashboard should emphasize executive visibility, conversion health, and the business impact of failures or slowdowns.',
      '',
      '## Next Step',
      '- Use the selected journey to generate the JSON configuration. Keep the second call on GitHub GPT-4.1 as requested.',
    ].join('\n');

    return res.json({
      success: true,
      data: {
        content,
        model: 'dynatrace-assist-local',
        usage: {},
        genai: {
          system: 'dynatrace_assist',
          model: 'dynatrace-assist-local',
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
          durationMs: 0,
          finishReason: 'stop',
        },
      },
    });
  } catch (err) {
    console.error('[MCP] Assist error:', err.message);
    return res.status(500).json({ success: false, error: err.message || 'Dynatrace Assist failed' });
  }
});
function createMcpServer() {
  const server = new McpServer(
    { name: 'bizobs-dashboard-mcp', version: '1.0.0' },
    { capabilities: { tools: {} } }
  );

  // ── Tool: generate_dashboard ──────────────────────────────────────────────
  server.tool(
    'generate_dashboard',
    'Generate a Dynatrace dashboard JSON for a specific company and journey type. ' +
    'Returns a complete dashboard document ready for import or deployment via the Document API.',
    {
      company: z.string().describe('Company name (e.g. "Acme Corp")'),
      journeyType: z.string().describe('Journey type (e.g. "Purchase", "Onboarding")'),
      useAI: z.boolean().optional().default(true).describe('Whether to use AI (Ollama) for generation. Falls back to template if unavailable.'),
    },
    async ({ company, journeyType, useAI }) => {
      try {
        console.log(`[MCP] 🛠️  generate_dashboard called: company=${company}, journeyType=${journeyType}, useAI=${useAI}`);
        const res = await fetch(`${LOCAL_BASE}/api/ai-dashboard/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            journeyData: { company, journeyType },
            useAI,
          }),
          signal: AbortSignal.timeout(30000),
        });

        const data = await res.json();
        if (!data.success || !data.dashboard) {
          return {
            content: [{ type: 'text', text: JSON.stringify({ error: data.error || 'Dashboard generation failed' }) }],
            isError: true,
          };
        }

        console.log(`[MCP] ✅ Dashboard generated: ${Object.keys(data.dashboard.content?.tiles || {}).length} tiles via ${data.generationMethod}`);

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              dashboard: data.dashboard,
              generationMethod: data.generationMethod,
              tileCount: Object.keys(data.dashboard.content?.tiles || {}).length,
              message: data.message,
            }),
          }],
        };
      } catch (err) {
        console.error('[MCP] generate_dashboard error:', err.message);
        return {
          content: [{ type: 'text', text: JSON.stringify({ error: err.message }) }],
          isError: true,
        };
      }
    }
  );

  // ── Tool: prompt_dashboard ─────────────────────────────────────────────────
  server.tool(
    'prompt_dashboard',
    'Generate a custom Dynatrace dashboard based on a natural language prompt. ' +
    'The user describes what kind of dashboard they want (e.g. "C-level executive dashboard", ' +
    '"ops team SLA dashboard") and the AI tailors the dashboard accordingly.',
    {
      company: z.string().describe('Company name (e.g. "Acme Corp")'),
      journeyType: z.string().describe('Journey type (e.g. "Purchase", "Onboarding")'),
      prompt: z.string().describe('Natural language description of the dashboard the user wants (e.g. "Create a C-level executive dashboard focused on revenue impact and customer churn")'),
    },
    async ({ company, journeyType, prompt }) => {
      try {
        console.log(`[MCP] 🎯 prompt_dashboard called: "${prompt.substring(0, 80)}..." for ${company}/${journeyType}`);
        const res = await fetch(`${LOCAL_BASE}/api/ai-dashboard/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            journeyData: { company, journeyType },
            useAI: true,
            customPrompt: prompt,
          }),
          signal: AbortSignal.timeout(120000), // Custom prompts may take longer with Ollama
        });

        const data = await res.json();
        if (!data.success || !data.dashboard) {
          return {
            content: [{ type: 'text', text: JSON.stringify({ error: data.error || 'Custom dashboard generation failed' }) }],
            isError: true,
          };
        }

        console.log(`[MCP] ✅ Custom dashboard generated: ${Object.keys(data.dashboard.content?.tiles || {}).length} tiles via ${data.generationMethod}`);

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              dashboard: data.dashboard,
              generationMethod: data.generationMethod,
              tileCount: Object.keys(data.dashboard.content?.tiles || {}).length,
              message: data.message,
              customPrompt: prompt,
            }),
          }],
        };
      } catch (err) {
        console.error('[MCP] prompt_dashboard error:', err.message);
        return {
          content: [{ type: 'text', text: JSON.stringify({ error: err.message }) }],
          isError: true,
        };
      }
    }
  );

  // ── Tool: get_dashboard_health ─────────────────────────────────────────────
  server.tool(
    'get_dashboard_health',
    'Check the health of the AI dashboard generation service (Ollama availability, installed models).',
    {},
    async () => {
      try {
        const res = await fetch(`${LOCAL_BASE}/api/ai-dashboard/health`, {
          signal: AbortSignal.timeout(5000),
        });
        const data = await res.json();
        return { content: [{ type: 'text', text: JSON.stringify(data) }] };
      } catch (err) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ error: err.message }) }],
          isError: true,
        };
      }
    }
  );

  return server;
}

// ── Stateless Streamable HTTP endpoint ──────────────────────────────────────
// Each request creates a fresh transport + server, handles it, then cleans up.
// This is the recommended pattern for stateless MCP over HTTP.

router.post('/', async (req, res) => {
  try {
    const server = createMcpServer();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined, // Stateless — no session tracking
    });

    // Wire up error handling
    transport.onerror = (err) => console.error('[MCP Transport] Error:', err.message);

    // Connect server to transport, then handle the request
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (err) {
    console.error('[MCP] Request handling error:', err.message);
    if (!res.headersSent) {
      res.status(500).json({ jsonrpc: '2.0', error: { code: -32603, message: 'Internal error' }, id: null });
    }
  }
});

// GET endpoint for SSE stream (optional, for server-initiated notifications)
router.get('/', async (req, res) => {
  // In stateless mode, GET SSE is not meaningful — return method not allowed
  res.status(405).json({ jsonrpc: '2.0', error: { code: -32000, message: 'SSE not supported in stateless mode. Use POST.' }, id: null });
});

// DELETE endpoint for session termination (no-op in stateless mode)
router.delete('/', (req, res) => {
  res.status(200).end();
});

console.log('[MCP Server] 🔗 MCP route registered at /api/mcp');

export default router;
