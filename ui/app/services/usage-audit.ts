import { functions } from '@dynatrace-sdk/app-utils';
import { getCurrentUserDetails } from '@dynatrace-sdk/app-environment';

const LOCAL_STORAGE_KEY = 'bizobs_api_settings';

interface ProxySettings {
  apiHost: string;
  apiPort: string;
  apiProtocol: string;
}

function getProxySettings(): ProxySettings {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) {
      return { apiHost: 'localhost', apiPort: '8080', apiProtocol: 'http' };
    }

    const parsed = JSON.parse(raw) as Partial<ProxySettings>;
    return {
      apiHost: String(parsed.apiHost || 'localhost'),
      apiPort: String(parsed.apiPort || '8080'),
      apiProtocol: String(parsed.apiProtocol || 'http'),
    };
  } catch {
    return { apiHost: 'localhost', apiPort: '8080', apiProtocol: 'http' };
  }
}

function getAuditUser() {
  const details = getCurrentUserDetails();
  const userEmail = details?.email && !String(details.email).startsWith('dt.missing.user.')
    ? String(details.email).trim().toLowerCase()
    : '';
  const rawName = details?.name && !String(details.name).startsWith('dt.missing.user.')
    ? String(details.name).trim()
    : '';

  return {
    userEmail,
    userName: rawName || (userEmail.includes('@') ? userEmail.split('@')[0] : 'unknown'),
  };
}

export async function trackUiUsage(
  auditAction: string,
  feature = 'navigation',
  context: Record<string, unknown> = {}
): Promise<void> {
  if (!auditAction) return;

  const settings = getProxySettings();
  const auditUser = getAuditUser();

  try {
    await functions.call('proxy-api', {
      data: {
        action: 'ui-audit',
        ...settings,
        ...auditUser,
        body: {
          feature,
          auditAction,
          ...context,
        },
      },
    });
  } catch {
    // Best effort only. User flows should never block on analytics.
  }
}
