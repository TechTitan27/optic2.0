-- Optic Hosting Organizations & Projects Schema
-- Supabase PostgreSQL with Row Level Security (RLS)

-- 1. Organizations Table
CREATE TABLE IF NOT EXISTS public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Organization Members Table
CREATE TABLE IF NOT EXISTS public.organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id, user_id)
);

-- 3. Hosting Projects Table (Belongs to Organization)
CREATE TABLE IF NOT EXISTS public.hosting_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  framework TEXT NOT NULL DEFAULT 'react',
  production_domain TEXT,
  assigned_subdomain TEXT NOT NULL,
  custom_domains TEXT[] NOT NULL DEFAULT '{}',
  git_repo TEXT,
  git_branch TEXT NOT NULL DEFAULT 'main',
  status TEXT NOT NULL DEFAULT 'ready' CHECK (status IN ('ready', 'building', 'failed', 'queued')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id, slug)
);

-- 4. Hosting Deployments Table
CREATE TABLE IF NOT EXISTS public.hosting_deployments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.hosting_projects(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'ready' CHECK (status IN ('ready', 'building', 'failed', 'queued')),
  url TEXT NOT NULL,
  commit_hash TEXT,
  commit_message TEXT,
  creator TEXT,
  branch TEXT NOT NULL DEFAULT 'main',
  duration_seconds INTEGER NOT NULL DEFAULT 12,
  environment TEXT NOT NULL DEFAULT 'production' CHECK (environment IN ('production', 'preview')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Hosting Domains Table
CREATE TABLE IF NOT EXISTS public.hosting_domains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.hosting_projects(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  domain TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'verified' CHECK (status IN ('verified', 'pending', 'failed')),
  dns_type TEXT NOT NULL DEFAULT 'CNAME' CHECK (dns_type IN ('CNAME', 'A')),
  dns_target TEXT NOT NULL DEFAULT 'cname.optic.doy.best',
  ssl_status TEXT NOT NULL DEFAULT 'active' CHECK (ssl_status IN ('active', 'issuing', 'pending')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(project_id, domain)
);

-- Enable RLS on all tables
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hosting_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hosting_deployments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hosting_domains ENABLE ROW LEVEL SECURITY;

-- Organizations Policies
CREATE POLICY "Members can view organizations"
  ON public.organizations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE organization_members.organization_id = organizations.id
        AND organization_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Authenticated users can create organizations"
  ON public.organizations FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL AND auth.uid() = created_by
  );

CREATE POLICY "Owners and admins can update organizations"
  ON public.organizations FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE organization_members.organization_id = organizations.id
        AND organization_members.user_id = auth.uid()
        AND organization_members.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Owners can delete organizations"
  ON public.organizations FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE organization_members.organization_id = organizations.id
        AND organization_members.user_id = auth.uid()
        AND organization_members.role = 'owner'
    )
  );

-- Organization Members Policies
CREATE POLICY "Members can view membership"
  ON public.organization_members FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members AS om
      WHERE om.organization_id = organization_members.organization_id
        AND om.user_id = auth.uid()
    )
  );

CREATE POLICY "Self creation upon org create or admins can add members"
  ON public.organization_members FOR INSERT
  WITH CHECK (
    auth.uid() = user_id OR EXISTS (
      SELECT 1 FROM public.organization_members AS om
      WHERE om.organization_id = organization_members.organization_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin')
    )
  );

-- Hosting Projects Policies
CREATE POLICY "Members can view hosting projects in their org"
  ON public.hosting_projects FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE organization_members.organization_id = hosting_projects.organization_id
        AND organization_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Members can create hosting projects in their org"
  ON public.hosting_projects FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE organization_members.organization_id = hosting_projects.organization_id
        AND organization_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Members can update hosting projects in their org"
  ON public.hosting_projects FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE organization_members.organization_id = hosting_projects.organization_id
        AND organization_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Owners and admins can delete hosting projects"
  ON public.hosting_projects FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE organization_members.organization_id = hosting_projects.organization_id
        AND organization_members.user_id = auth.uid()
        AND organization_members.role IN ('owner', 'admin')
    )
  );

-- Hosting Deployments Policies
CREATE POLICY "Members can view deployments in their org"
  ON public.hosting_deployments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE organization_members.organization_id = hosting_deployments.organization_id
        AND organization_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Members can insert deployments in their org"
  ON public.hosting_deployments FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE organization_members.organization_id = hosting_deployments.organization_id
        AND organization_members.user_id = auth.uid()
    )
  );

-- Hosting Domains Policies
CREATE POLICY "Members can view domains in their org"
  ON public.hosting_domains FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE organization_members.organization_id = hosting_domains.organization_id
        AND organization_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Members can manage domains in their org"
  ON public.hosting_domains FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE organization_members.organization_id = hosting_domains.organization_id
        AND organization_members.user_id = auth.uid()
    )
  );
