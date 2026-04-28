import express from 'express';

const router = express.Router();

const DT_TOKEN_URL = 'https://sso-sprint.dynatracelabs.com/sso/oauth2/token';
const DT_IAM_BASE = 'https://api-hardening.internal.dynatracelabs.com/iam/v1/accounts';
const ALLOWED_DOMAIN = process.env.ALLOWED_EMAIL_DOMAIN || 'dynatrace.com';

async function getDynatraceToken() {
  const params = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: process.env.DT_ACCOUNT_OAUTH_CLIENT_ID,
    client_secret: process.env.DT_ACCOUNT_OAUTH_CLIENT_SECRET,
    resource: process.env.DT_ACCOUNT_RESOURCE,
  });

  const res = await fetch(DT_TOKEN_URL, {
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

router.post('/', async (req, res) => {
  const { email } = req.body || {};

  if (!email || typeof email !== 'string') {
    return res.status(400).json({ success: false, error: 'Email is required.' });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const domain = normalizedEmail.split('@')[1];

  if (domain !== ALLOWED_DOMAIN) {
    return res.status(403).json({ success: false, error: `Only @${ALLOWED_DOMAIN} email addresses are permitted.` });
  }

  const accountId = process.env.DT_ACCOUNT_ID;
  const groupUuid = process.env.DT_ACCESS_GROUP_UUID;

  if (!accountId || !groupUuid || !process.env.DT_ACCOUNT_OAUTH_CLIENT_ID || !process.env.DT_ACCOUNT_OAUTH_CLIENT_SECRET || !process.env.DT_ACCOUNT_RESOURCE) {
    console.error('[provision-access] Missing required Dynatrace environment variables');
    return res.status(500).json({ success: false, error: 'Server not configured for provisioning. Contact an administrator.' });
  }

  try {
    const token = await getDynatraceToken();

    // Step 1: Create user (409 = already exists, that's fine)
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
      throw new Error(`Create user failed (${createRes.status}): ${text}`);
    }

    // Step 2: Add user to group (409 = already in group, that's fine)
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
    return res.json({ success: true, message: `Access provisioned for ${normalizedEmail}. You will receive an invitation email shortly.` });

  } catch (err) {
    console.error('[provision-access] Error:', err.message);
    return res.status(500).json({ success: false, error: 'Provisioning failed. Please contact an administrator.' });
  }
});

export default router;
