import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { Organization } from '../types';
import { supabaseData } from '../lib/supabaseData';
import { useAuth } from './AuthContext';
import { notifyToast } from './ToastContext';

interface OrganizationContextType {
  organizations: Organization[];
  currentOrg: Organization | null;
  loading: boolean;
  setCurrentOrg: (org: Organization) => void;
  createOrg: (name: string, customSlug?: string) => Promise<Organization>;
  refreshOrganizations: () => Promise<void>;
  hasOrganizations: boolean;
}

const OrganizationContext = createContext<OrganizationContextType | undefined>(undefined);

const CURRENT_ORG_KEY = 'optic_current_org_id';

export const OrganizationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading: authLoading } = useAuth();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [currentOrg, setCurrentOrgState] = useState<Organization | null>(() => {
    try {
      const savedOrg = localStorage.getItem('optic_current_org_data');
      if (savedOrg) return JSON.parse(savedOrg);
    } catch {}
    return null;
  });
  const [loading, setLoading] = useState<boolean>(true);

  const fetchOrgs = useCallback(async () => {
    if (authLoading) {
      setLoading(true);
      return;
    }

    if (!user?.id) {
      setOrganizations([]);
      setCurrentOrgState(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const orgs = await supabaseData.getUserOrganizations(user.id);
      setOrganizations(orgs);

      if (orgs.length > 0) {
        // Retrieve previously selected organization or default to first
        const savedOrgId = localStorage.getItem(CURRENT_ORG_KEY);
        const matched = orgs.find((o) => o.id === savedOrgId);
        const selected = matched || orgs[0];
        setCurrentOrgState(selected);
        localStorage.setItem(CURRENT_ORG_KEY, selected.id);
        try {
          localStorage.setItem('optic_current_org_data', JSON.stringify(selected));
        } catch {}
      } else {
        setCurrentOrgState(null);
        localStorage.removeItem(CURRENT_ORG_KEY);
        localStorage.removeItem('optic_current_org_data');
      }
    } catch (err) {
      console.warn('Error fetching organizations:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.id, authLoading]);

  useEffect(() => {
    fetchOrgs();
  }, [fetchOrgs]);

  const setCurrentOrg = (org: Organization) => {
    setCurrentOrgState(org);
    try {
      localStorage.setItem(CURRENT_ORG_KEY, org.id);
      localStorage.setItem('optic_current_org_data', JSON.stringify(org));
    } catch {
      // ignore
    }
  };

  const createOrg = async (name: string, customSlug?: string): Promise<Organization> => {
    const newOrg = await supabaseData.createOrganization(user?.id, name, customSlug);
    setOrganizations((prev) => [newOrg, ...prev.filter((o) => o.id !== newOrg.id)]);
    setCurrentOrg(newOrg);
    notifyToast({
      type: 'success',
      title: 'Organization Created',
      message: `Organization "${newOrg.name}" is ready.`,
    });
    return newOrg;
  };

  const effectiveLoading = authLoading || loading;

  return (
    <OrganizationContext.Provider
      value={{
        organizations,
        currentOrg,
        loading: effectiveLoading,
        setCurrentOrg,
        createOrg,
        refreshOrganizations: fetchOrgs,
        hasOrganizations: organizations.length > 0,
      }}
    >
      {children}
    </OrganizationContext.Provider>
  );
};

export const useOrganization = (): OrganizationContextType => {
  const context = useContext(OrganizationContext);
  if (!context) {
    throw new Error('useOrganization must be used within an OrganizationProvider');
  }
  return context;
};
