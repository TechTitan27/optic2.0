-- ============================================================
-- OPTIC HOSTING - PROJECT & DEPLOYMENT BUILD CONFIGURATION MIGRATION
-- Adds build specification and framework configuration columns
-- ============================================================

-- 1. Add build configuration columns to public.hosting_projects
ALTER TABLE IF EXISTS public.hosting_projects 
  ADD COLUMN IF NOT EXISTS build_command TEXT,
  ADD COLUMN IF NOT EXISTS output_directory TEXT DEFAULT 'dist',
  ADD COLUMN IF NOT EXISTS package_manager TEXT DEFAULT 'npm',
  ADD COLUMN IF NOT EXISTS node_version TEXT DEFAULT '20.x',
  ADD COLUMN IF NOT EXISTS install_command TEXT,
  ADD COLUMN IF NOT EXISTS root_directory TEXT DEFAULT './',
  ADD COLUMN IF NOT EXISTS build_config JSONB DEFAULT '{}'::jsonb;

-- 2. Add build configuration columns to public.projects (if used concurrently)
ALTER TABLE IF EXISTS public.projects 
  ADD COLUMN IF NOT EXISTS build_command TEXT,
  ADD COLUMN IF NOT EXISTS output_directory TEXT DEFAULT 'dist',
  ADD COLUMN IF NOT EXISTS package_manager TEXT DEFAULT 'npm',
  ADD COLUMN IF NOT EXISTS node_version TEXT DEFAULT '20.x',
  ADD COLUMN IF NOT EXISTS install_command TEXT,
  ADD COLUMN IF NOT EXISTS root_directory TEXT DEFAULT './',
  ADD COLUMN IF NOT EXISTS build_config JSONB DEFAULT '{}'::jsonb;

-- 3. Add framework and build specification columns to public.hosting_deployments
ALTER TABLE IF EXISTS public.hosting_deployments 
  ADD COLUMN IF NOT EXISTS framework TEXT,
  ADD COLUMN IF NOT EXISTS build_command TEXT,
  ADD COLUMN IF NOT EXISTS output_directory TEXT,
  ADD COLUMN IF NOT EXISTS package_manager TEXT,
  ADD COLUMN IF NOT EXISTS build_config JSONB DEFAULT '{}'::jsonb;

-- 4. Add framework and build specification columns to public.deployments
ALTER TABLE IF EXISTS public.deployments 
  ADD COLUMN IF NOT EXISTS framework TEXT,
  ADD COLUMN IF NOT EXISTS build_command TEXT,
  ADD COLUMN IF NOT EXISTS output_directory TEXT,
  ADD COLUMN IF NOT EXISTS package_manager TEXT,
  ADD COLUMN IF NOT EXISTS build_config JSONB DEFAULT '{}'::jsonb;
