-- =========================================================================
-- OPTIC HOSTING - PHASE 1: GITHUB INTEGRATION MIGRATION
-- Smallest secure schema addition for GitHub OAuth & Project Git targeting
-- =========================================================================

-- 1. Create table for storing user GitHub OAuth connection credentials
CREATE TABLE IF NOT EXISTS public.github_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  github_user_id BIGINT NOT NULL,
  github_username TEXT NOT NULL,
  avatar_url TEXT,
  access_token TEXT NOT NULL,
  scope TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT uq_github_connections_user_id UNIQUE (user_id)
);

-- 2. Enable Row Level Security (RLS)
ALTER TABLE public.github_connections ENABLE ROW LEVEL SECURITY;

-- 3. Strict RLS Policies: Authenticated users can ONLY access their own GitHub connection
DROP POLICY IF EXISTS "Users can view own github connection" ON public.github_connections;
CREATE POLICY "Users can view own github connection"
  ON public.github_connections
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own github connection" ON public.github_connections;
CREATE POLICY "Users can insert own github connection"
  ON public.github_connections
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own github connection" ON public.github_connections;
CREATE POLICY "Users can update own github connection"
  ON public.github_connections
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own github connection" ON public.github_connections;
CREATE POLICY "Users can delete own github connection"
  ON public.github_connections
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- 4. Add git targeting columns to public.projects table
ALTER TABLE public.projects 
  ADD COLUMN IF NOT EXISTS git_repo TEXT,
  ADD COLUMN IF NOT EXISTS git_branch TEXT DEFAULT 'main',
  ADD COLUMN IF NOT EXISTS git_provider TEXT DEFAULT 'github';

-- 5. Indexes for fast user lookup and project repository mapping
CREATE INDEX IF NOT EXISTS idx_github_connections_user_id ON public.github_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_git_repo ON public.projects(git_repo);
