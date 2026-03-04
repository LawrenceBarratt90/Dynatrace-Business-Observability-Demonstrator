/**
 * Admin Auth Context — identity-based access control for the Forge UI.
 *
 * Uses `getCurrentUserDetails()` from the Dynatrace AppEngine runtime
 * to identify the logged-in user. The admin user ID is persisted in the
 * shared app settings (Dynatrace Settings API), so all users of the app
 * see the same admin.
 *
 * Roles:
 *   Admin  — the user whose ID matches `adminUserId` in app settings.
 *            Can perform all destructive actions (stop services, delete
 *            EdgeConnect, inject/revert chaos, change settings, etc.)
 *   Owner  — the user who created a specific config/template.
 *            Can edit/delete their own configs.
 *   User   — anyone else. Can view everything, create/run journeys,
 *            save new templates. Cannot perform destructive actions.
 */
import React, { createContext, useContext, useState, useEffect, useRef, useCallback, type ReactNode } from 'react';
import { getCurrentUserDetails, getEnvironmentUrl } from '@dynatrace-sdk/app-environment';
import { useSettingsV2, useSettingsObjectsV2, useUpdateSettingsV2, useCreateSettingsV2 } from '@dynatrace-sdk/react-hooks';

// ── Types ────────────────────────────────────────────────────
export interface AppUser {
  id: string;
  name: string;
  email: string;
}

export interface AdminAuthContextType {
  /** The currently logged-in Dynatrace user */
  currentUser: AppUser;
  /** True if the current user is the app admin */
  isAdmin: boolean;
  /** The admin user, or null if no admin is claimed */
  adminUser: { id: string; name: string } | null;
  /** True while loading admin state from Dynatrace settings */
  isLoading: boolean;
  /** Claim admin for the current user (only if no admin exists yet) */
  claimAdmin: () => Promise<boolean>;
  /** Release admin (only the current admin can do this) */
  releaseAdmin: () => Promise<boolean>;
  /** True if the current user created the item identified by creatorId */
  isOwner: (creatorId?: string) => boolean;
  /** True if the current user can delete/edit the item (admin OR owner) */
  canModify: (creatorId?: string) => boolean;
}

// ── Helpers ──────────────────────────────────────────────────
const SCHEMA_ID = 'app:my.bizobs.generator.test:api-config';
const DEV_USER_ID = 'dt.missing.user.id';

function resolveUser(): AppUser {
  try {
    const details = getCurrentUserDetails();
    return {
      id: details.id || DEV_USER_ID,
      name: details.name || 'Developer',
      email: details.email || 'dev@local',
    };
  } catch {
    return { id: DEV_USER_ID, name: 'Developer', email: 'dev@local' };
  }
}

// ── Context ──────────────────────────────────────────────────
const AdminAuthContext = createContext<AdminAuthContextType | null>(null);

export const AdminAuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const currentUser = useRef(resolveUser()).current;

  // Admin state
  const [adminId, setAdminId] = useState<string | null>(null);
  const [adminName, setAdminName] = useState<string | null>(null);
  const [settingsObjId, setSettingsObjId] = useState<string | null>(null);
  const [settingsVersion, setSettingsVersion] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // SDK hooks
  const settingsEffective = useSettingsV2({ schemaId: SCHEMA_ID, addFields: 'value' });
  const settingsObjects = useSettingsObjectsV2(
    { schemaId: SCHEMA_ID, addFields: 'value,objectId,version' },
    { autoFetch: true, autoFetchOnUpdate: true },
  );
  const updateSettings = useUpdateSettingsV2();
  const createSettings = useCreateSettingsV2();

  // Sync admin info from settings
  const loadedRef = useRef(false);
  useEffect(() => {
    if (loadedRef.current) return;
    if (settingsEffective.isLoading) return;

    if (settingsEffective.data?.items?.[0]?.value) {
      const val = settingsEffective.data.items[0].value as any;
      setAdminId(val.adminUserId || null);
      setAdminName(val.adminUserName || null);
    }

    if (settingsObjects.data?.items?.[0]) {
      const obj = settingsObjects.data.items[0] as any;
      setSettingsObjId(obj.objectId || null);
      setSettingsVersion(obj.version || null);
    }

    if (settingsEffective.isSuccess || settingsEffective.isError) {
      loadedRef.current = true;
      setIsLoading(false);
    }
  }, [
    settingsEffective.isLoading,
    settingsEffective.data,
    settingsEffective.isSuccess,
    settingsEffective.isError,
    settingsObjects.data,
  ]);

  const isDev = currentUser.id === DEV_USER_ID;
  const isAdmin = isDev || (!!adminId && currentUser.id === adminId);
  const adminUser = adminId ? { id: adminId, name: adminName || 'Unknown' } : null;

  const isOwner = useCallback(
    (creatorId?: string) => !!creatorId && creatorId === currentUser.id,
    [currentUser.id],
  );

  const canModify = useCallback(
    (creatorId?: string) => isAdmin || isOwner(creatorId),
    [isAdmin, isOwner],
  );

  /** Persist admin user into the shared app settings */
  const persistAdmin = useCallback(
    async (userId: string, userName: string) => {
      // Read existing settings value so we don't overwrite other fields
      const currentVal = settingsEffective.data?.items?.[0]?.value as any || {};
      const newVal = {
        ...currentVal,
        adminUserId: userId,
        adminUserName: userName,
      };

      try {
        const obj = settingsObjects.data?.items?.[0] as any;
        const objId = obj?.objectId || settingsObjId;
        const version = obj?.version || settingsVersion;

        if (objId && version) {
          await updateSettings.execute({
            objectId: objId,
            optimisticLockingVersion: version,
            body: { value: newVal },
          });
        } else {
          await createSettings.execute({
            body: { schemaId: SCHEMA_ID, value: newVal },
          });
        }

        // Refetch
        settingsEffective.refetch();
        settingsObjects.refetch();
        return true;
      } catch (err) {
        console.error('[AdminAuth] Failed to persist admin:', err);
        return false;
      }
    },
    [settingsEffective, settingsObjects, settingsObjId, settingsVersion, updateSettings, createSettings],
  );

  const claimAdmin = useCallback(async () => {
    if (adminId && adminId !== currentUser.id) {
      // Admin already claimed by someone else
      return false;
    }
    const ok = await persistAdmin(currentUser.id, currentUser.name || currentUser.email);
    if (ok) {
      setAdminId(currentUser.id);
      setAdminName(currentUser.name || currentUser.email);
    }
    return ok;
  }, [adminId, currentUser, persistAdmin]);

  const releaseAdmin = useCallback(async () => {
    if (!isAdmin) return false;
    const ok = await persistAdmin('', '');
    if (ok) {
      setAdminId(null);
      setAdminName(null);
    }
    return ok;
  }, [isAdmin, persistAdmin]);

  const value: AdminAuthContextType = {
    currentUser,
    isAdmin,
    adminUser,
    isLoading,
    claimAdmin,
    releaseAdmin,
    isOwner,
    canModify,
  };

  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>;
};

/**
 * Hook to access admin auth state. Must be called inside <AdminAuthProvider>.
 */
export function useAdminAuth(): AdminAuthContextType {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) {
    throw new Error('useAdminAuth must be used within an AdminAuthProvider');
  }
  return ctx;
}
