import express from 'express';

const router = express.Router();

function resolveTokenUrl() {
  if (process.env.DT_ACCOUNT_TOKEN_URL) {
    return process.env.DT_ACCOUNT_TOKEN_URL;
  }

  const envType = (process.env.ENV_TYPE || '').toLowerCase();
  if (envType === 'prod') {
    return 'https://sso.dynatrace.com/sso/oauth2/token';
  }
  return 'https://sso-sprint.dynatracelabs.com/sso/oauth2/token';
}

const DT_IAM_BASE = 'https://api-hardening.internal.dynatracelabs.com/iam/v1/accounts';
const ALLOWED_DOMAIN_RAW = process.env.ALLOWED_EMAIL_DOMAIN || 'dynatrace.com';

function parseAllowedDomains(raw) {
  return raw
    .split(',')
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);
}

function isDomainAllowed(domain, rawConfig) {
  const allowed = parseAllowedDomains(rawConfig);
  if (allowed.includes('*')) {
    return true;
  }
  return allowed.includes(domain);
}

async function getDynatraceToken() {
  const tokenUrl = resolveTokenUrl();
  const params = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: process.env.DT_ACCOUNT_OAUTH_CLIENT_ID,
    client_secret: process.env.DT_ACCOUNT_OAUTH_CLIENT_SECRET,
    resource: process.env.DT_ACCOUNT_RESOURCE,
  });

  const res = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token request failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  return data.access_token;
}

function isAlreadyInvitedResponse(status, bodyText) {
  if (status !== 400 || !bodyText) {
    return false;
  }
  const text = bodyText.toLowerCase();
  return text.includes('already been invited') || text.includes('already invited');
}

router.post('/', async (req, res) => {
  const { email } = req.body || {};

  if (!email || typeof email !== 'string') {
    return res.status(400).json({ success: false, error: 'Email is required.' });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const domain = normalizedEmail.split('@')[1];

  if (!isDomainAllowed(domain, ALLOWED_DOMAIN_RAW)) {
    return res.status(403).json({ success: false, error: `Email domain not allowed by policy. Allowed: ${ALLOWED_DOMAIN_RAW}` });
  }

  const accountId = process.env.DT_ACCOUNT_ID;
  const groupUuid = process.env.DT_ACCESS_GROUP_UUID;

  if (!accountId || !groupUuid || !process.env.DT_ACCOUNT_OAUTH_CLIENT_ID || !process.env.DT_ACCOUNT_OAUTH_CLIENT_SECRET || !process.env.DT_ACCOUNT_RESOURCE) {
    console.error('[provision-access] Missing required Dynatrace environment variables');
    return res.status(500).json({ success: false, error: 'Server not configured for provisioning. Contact an administrator.' });
  }

  try {
    const token = await getDynatraceToken();
    let alreadyInvited = false;

    const createRes = await fetch(`${DT_IAM_BASE}/${accountId}/users`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email: normalizedEmail }),
    });

    if (!createRes.ok && createRes.status !== 409) {
      const text = await createRes.text();
      if (isAlreadyInvitedResponse(createRes.status, text)) {
        alreadyInvited = true;
      } else {
        throw new Error(`Create user failed (${createRes.status}): ${text}`);
      }
    }

    const groupRes = await fetch(`${DT_IAM_BASE}/${accountId}/users/${encodeURIComponent(normalizedEmail)}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([groupUuid]),
    });

    if (!groupRes.ok && groupRes.status !== 409) {
      const text = await groupRes.text();
      throw new Error(`Add to group failed (${groupRes.status}): ${text}`);
    }

    console.log(`[provision-access] Provisioned access for ${normalizedEmail}`);
    if (alreadyInvited) {
      return res.json({
        success: true,
        message: `${normalizedEmail} is already invited and has been added to the access group.`
      });
    }

    return res.json({ success: true, message: `Access provisioned for ${normalizedEmail}. You will receive an invitation email shortly.` });
  } catch (err) {
    console.error('[provision-access] Error:', err.message);
    return res.status(500).json({ success: false, error: 'Provisioning failed. Please contact an administrator.' });
  }
});

export default router;
