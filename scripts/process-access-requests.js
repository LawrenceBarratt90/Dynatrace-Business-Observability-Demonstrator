#!/usr/bin/env node

/**
 * Option 2 worker:
 * - Power Automate (standard connectors only): Forms -> SharePoint list item
 * - This worker polls SharePoint via Microsoft Graph
 * - For each pending request, it creates/updates Dynatrace user and adds group membership
 * - Then writes status back to the list item (Processed/Failed)
 */

import dotenv from 'dotenv';

dotenv.config();

function required(name) {
  const v = process.env[name];
  if (!v) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return v;
}

function toBool(v, fallback = false) {
  if (v == null) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(v).toLowerCase());
}

function nowIso() {
  return new Date().toISOString();
}

async function postFormUrlEncoded(url, bodyObj) {
  const body = new URLSearchParams();
  Object.entries(bodyObj).forEach(([k, v]) => body.set(k, v));

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }

  if (!res.ok) {
    throw new Error(`POST ${url} failed (${res.status}): ${text.slice(0, 300)}`);
  }

  return data;
}

async function getMsGraphToken(cfg) {
  const tokenUrl = `https://login.microsoftonline.com/${cfg.msTenantId}/oauth2/v2.0/token`;
  const data = await postFormUrlEncoded(tokenUrl, {
    client_id: cfg.msClientId,
    client_secret: cfg.msClientSecret,
    grant_type: 'client_credentials',
    scope: 'https://graph.microsoft.com/.default',
  });
  if (!data?.access_token) throw new Error('MS Graph token response missing access_token');
  return data.access_token;
}

async function getDynatraceToken(cfg) {
  const data = await postFormUrlEncoded('https://sso-sprint.dynatracelabs.com/sso/oauth2/token', {
    grant_type: 'client_credentials',
    client_id: cfg.dtClientId,
    client_secret: cfg.dtClientSecret,
    resource: cfg.dtResource,
  });
  if (!data?.access_token) throw new Error('Dynatrace token response missing access_token');
  return data.access_token;
}

async function graphGet(url, token) {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const txt = await res.text();
  let data = null;
  try {
    data = txt ? JSON.parse(txt) : null;
  } catch {
    data = { raw: txt };
  }
  if (!res.ok) throw new Error(`Graph GET failed (${res.status}): ${txt.slice(0, 300)}`);
  return data;
}

async function graphPatch(url, token, body) {
  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Graph PATCH failed (${res.status}): ${txt.slice(0, 300)}`);
  }
}

async function dtPost(url, token, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (res.status === 409) {
    return { ok: true, conflict: true };
  }

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Dynatrace POST failed (${res.status}): ${txt.slice(0, 300)}`);
  }

  return { ok: true, conflict: false };
}

function mask(email) {
  const [name, domain] = String(email || '').split('@');
  if (!name || !domain) return 'invalid-email';
  return `${name.slice(0, 2)}***@${domain}`;
}

function loadConfig() {
  return {
    msTenantId: required('MS_TENANT_ID'),
    msClientId: required('MS_CLIENT_ID'),
    msClientSecret: required('MS_CLIENT_SECRET'),
    spSiteId: required('SP_SITE_ID'),
    spListId: required('SP_LIST_ID'),

    dtAccountId: required('DT_ACCOUNT_ID'),
    dtClientId: required('DT_ACCOUNT_OAUTH_CLIENT_ID'),
    dtClientSecret: required('DT_ACCOUNT_OAUTH_CLIENT_SECRET'),
    dtResource: required('DT_ACCOUNT_RESOURCE'),
    dtGroupUuid: required('DT_ACCESS_GROUP_UUID'),

    emailField: process.env.SP_EMAIL_FIELD || 'Email',
    statusField: process.env.SP_STATUS_FIELD || 'Status',
    processedStatus: process.env.SP_STATUS_PROCESSED || 'Processed',
    failedStatus: process.env.SP_STATUS_FAILED || 'Failed',
    pendingStatus: process.env.SP_STATUS_PENDING || 'Pending',
    notesField: process.env.SP_NOTES_FIELD || 'Notes',
    updatedAtField: process.env.SP_UPDATED_AT_FIELD || 'UpdatedAt',

    pollSeconds: Number(process.env.ACCESS_WORKER_POLL_SECONDS || 60),
    once: toBool(process.env.ACCESS_WORKER_ONCE, false),
  };
}

async function listItems(cfg, graphToken) {
  const url = `https://graph.microsoft.com/v1.0/sites/${cfg.spSiteId}/lists/${cfg.spListId}/items?expand=fields&$top=100`;
  const data = await graphGet(url, graphToken);
  return data?.value || [];
}

function isPending(item, cfg) {
  const fields = item?.fields || {};
  const status = String(fields[cfg.statusField] || '').trim();
  return status.toLowerCase() === cfg.pendingStatus.toLowerCase();
}

function getEmail(item, cfg) {
  const fields = item?.fields || {};
  return String(fields[cfg.emailField] || '').trim();
}

async function updateItemStatus(cfg, graphToken, itemId, status, notes) {
  const url = `https://graph.microsoft.com/v1.0/sites/${cfg.spSiteId}/lists/${cfg.spListId}/items/${itemId}/fields`;
  const body = {
    [cfg.statusField]: status,
    [cfg.notesField]: String(notes || '').slice(0, 1000),
    [cfg.updatedAtField]: nowIso(),
  };
  await graphPatch(url, graphToken, body);
}

async function provisionUser(cfg, dtToken, email) {
  const accountBase = `https://api-hardening.internal.dynatracelabs.com/iam/v1/accounts/${cfg.dtAccountId}`;

  await dtPost(`${accountBase}/users`, dtToken, { email });
  await dtPost(`${accountBase}/users/${encodeURIComponent(email)}`, dtToken, [cfg.dtGroupUuid]);
}

async function processOnce(cfg) {
  const graphToken = await getMsGraphToken(cfg);
  const dtToken = await getDynatraceToken(cfg);

  const items = await listItems(cfg, graphToken);
  const pending = items.filter((i) => isPending(i, cfg));

  if (pending.length === 0) {
    console.log(`[${nowIso()}] No pending access requests`);
    return;
  }

  console.log(`[${nowIso()}] Found ${pending.length} pending request(s)`);

  for (const item of pending) {
    const itemId = item.id;
    const email = getEmail(item, cfg);

    if (!email || !email.includes('@')) {
      const msg = 'Missing/invalid email in list row';
      console.error(`[${nowIso()}] Item ${itemId}: ${msg}`);
      await updateItemStatus(cfg, graphToken, itemId, cfg.failedStatus, msg);
      continue;
    }

    try {
      console.log(`[${nowIso()}] Provisioning ${mask(email)} (item ${itemId})`);
      await provisionUser(cfg, dtToken, email);
      await updateItemStatus(cfg, graphToken, itemId, cfg.processedStatus, `Provisioned ${nowIso()}`);
      console.log(`[${nowIso()}] Success for ${mask(email)}`);
    } catch (err) {
      const msg = String(err?.message || err || 'unknown error');
      console.error(`[${nowIso()}] Failed for ${mask(email)}: ${msg}`);
      await updateItemStatus(cfg, graphToken, itemId, cfg.failedStatus, msg);
    }
  }
}

async function main() {
  const cfg = loadConfig();
  console.log(`[${nowIso()}] Access worker started (poll every ${cfg.pollSeconds}s, once=${cfg.once})`);

  if (cfg.once) {
    await processOnce(cfg);
    return;
  }

  while (true) {
    try {
      await processOnce(cfg);
    } catch (err) {
      console.error(`[${nowIso()}] Worker loop error: ${String(err?.message || err)}`);
    }
    await new Promise((r) => setTimeout(r, cfg.pollSeconds * 1000));
  }
}

main().catch((err) => {
  console.error(`[${nowIso()}] Fatal: ${String(err?.message || err)}`);
  process.exit(1);
});
