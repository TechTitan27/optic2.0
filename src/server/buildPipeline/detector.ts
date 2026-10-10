import { DetectionResult, FrameworkId, Language, RuntimeType, SourceFile } from './types.js';

interface PackageJson {
  name?: string;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  main?: string;
}

export function detectFrameworkAndLanguage(
  files: { relativePath: string; buffer?: Buffer }[],
  rootDirectory: string = ''
): DetectionResult {
  const normRoot = rootDirectory ? rootDirectory.replace(/^\/+|\/+$/g, '') + '/' : '';
  const filePaths = files.map((f) => f.relativePath);

  const getFileContent = (relPath: string): string | null => {
    const fullTarget = normRoot ? `${normRoot}${relPath}` : relPath;
    const match = files.find((f) => f.relativePath === fullTarget || f.relativePath === relPath);
    if (!match || !match.buffer) return null;
    return match.buffer.toString('utf-8');
  };

  const hasFile = (relPath: string): boolean => {
    const fullTarget = normRoot ? `${normRoot}${relPath}` : relPath;
    return filePaths.includes(fullTarget) || filePaths.includes(relPath);
  };

  const hasAnyFileMatching = (pattern: RegExp): boolean => {
    return filePaths.some((p) => {
      const stripped = normRoot && p.startsWith(normRoot) ? p.slice(normRoot.length) : p;
      return pattern.test(stripped);
    });
  };

  // 1. Check for Node.js / JavaScript / TypeScript ecosystem
  if (hasFile('package.json')) {
    let pkg: PackageJson = {};
    try {
      const raw = getFileContent('package.json');
      if (raw) pkg = JSON.parse(raw);
    } catch {
      // Malformed package.json
    }

    const allDeps = {
      ...(pkg.dependencies || {}),
      ...(pkg.devDependencies || {}),
    };
    const scripts = pkg.scripts || {};
    const hasTs = hasFile('tsconfig.json') || hasAnyFileMatching(/\.tsx?$/i);
    const lang: Language = hasTs ? 'typescript' : 'javascript';
    const langName = hasTs ? 'TypeScript' : 'JavaScript';

    // Package manager determination
    let installCmd = 'npm install';
    if (hasFile('bun.lock') || hasFile('bun.lockb')) {
      installCmd = 'bun install';
    } else if (hasFile('pnpm-lock.yaml')) {
      installCmd = 'pnpm install';
    } else if (hasFile('yarn.lock')) {
      installCmd = 'yarn install';
    }

    // 1a. Next.js
    if (allDeps['next']) {
      // Check if project specifies static export
      const nextConfigRaw = getFileContent('next.config.js') || getFileContent('next.config.mjs') || '';
      const isExplicitExport =
        nextConfigRaw.includes("output: 'export'") ||
        nextConfigRaw.includes('output: "export"') ||
        (scripts['build'] && scripts['build'].includes('next export'));

      if (isExplicitExport) {
        return {
          framework: 'nextjs',
          frameworkName: 'Next.js (Static Export)',
          language: lang,
          languageName: langName,
          runtimeType: 'static',
          buildCommand: scripts['build'] ? 'npm run build' : 'npx next build',
          installCommand: installCmd,
          outputDir: 'out',
          startCommand: '',
          rootDirectory: normRoot,
          isStaticExport: true,
          confidence: 'high',
          detectedFiles: ['package.json'],
          envSuggestions: { NODE_ENV: 'production' },
          reasons: ['Detected "next" dependency with static export configuration'],
        };
      }

      // Next.js with Server-Side Rendering
      return {
        framework: 'nextjs',
        frameworkName: 'Next.js (SSR / Hybrid)',
        language: lang,
        languageName: langName,
        runtimeType: 'server',
        buildCommand: scripts['build'] ? 'npm run build' : 'npx next build',
        installCommand: installCmd,
        outputDir: '.next',
        startCommand: 'npm run start',
        rootDirectory: normRoot,
        isStaticExport: false,
        confidence: 'high',
        detectedFiles: ['package.json'],
        envSuggestions: { NODE_ENV: 'production', PORT: '3000' },
        reasons: ['Detected "next" dependency requiring Node.js runtime'],
      };
    }

    // 1b. Astro
    if (allDeps['astro']) {
      return {
        framework: 'astro',
        frameworkName: 'Astro',
        language: lang,
        languageName: langName,
        runtimeType: 'static',
        buildCommand: scripts['build'] ? 'npm run build' : 'npx astro build',
        installCommand: installCmd,
        outputDir: 'dist',
        startCommand: '',
        rootDirectory: normRoot,
        isStaticExport: true,
        confidence: 'high',
        detectedFiles: ['package.json'],
        envSuggestions: { NODE_ENV: 'production' },
        reasons: ['Detected "astro" framework dependency'],
      };
    }

    // 1c. Svelte / SvelteKit
    if (allDeps['@sveltejs/kit'] || allDeps['svelte']) {
      const isKit = Boolean(allDeps['@sveltejs/kit']);
      return {
        framework: 'svelte',
        frameworkName: isKit ? 'SvelteKit' : 'Svelte',
        language: lang,
        languageName: langName,
        runtimeType: 'static',
        buildCommand: scripts['build'] ? 'npm run build' : 'npm run build',
        installCommand: installCmd,
        outputDir: hasFile('build') ? 'build' : 'dist',
        startCommand: isKit ? 'node build' : '',
        rootDirectory: normRoot,
        isStaticExport: true,
        confidence: 'high',
        detectedFiles: ['package.json'],
        envSuggestions: { NODE_ENV: 'production' },
        reasons: ['Detected Svelte dependencies and build scripts'],
      };
    }

    // 1d. Angular
    if (allDeps['@angular/core'] || hasFile('angular.json')) {
      return {
        framework: 'angular',
        frameworkName: 'Angular',
        language: 'typescript',
        languageName: 'TypeScript',
        runtimeType: 'static',
        buildCommand: scripts['build'] ? 'npm run build' : 'npx ng build --configuration production',
        installCommand: installCmd,
        outputDir: 'dist',
        startCommand: '',
        rootDirectory: normRoot,
        isStaticExport: true,
        confidence: 'high',
        detectedFiles: hasFile('angular.json') ? ['angular.json', 'package.json'] : ['package.json'],
        envSuggestions: { NODE_ENV: 'production' },
        reasons: ['Detected Angular CLI configuration and dependencies'],
      };
    }

    // 1e. NestJS Backend
    if (allDeps['@nestjs/core']) {
      return {
        framework: 'nestjs',
        frameworkName: 'NestJS Backend',
        language: 'typescript',
        languageName: 'TypeScript',
        runtimeType: 'server',
        buildCommand: scripts['build'] ? 'npm run build' : 'npx nest build',
        installCommand: installCmd,
        outputDir: 'dist',
        startCommand: scripts['start:prod'] ? 'npm run start:prod' : 'node dist/main.js',
        rootDirectory: normRoot,
        isStaticExport: false,
        confidence: 'high',
        detectedFiles: ['package.json'],
        envSuggestions: { NODE_ENV: 'production', PORT: '3000' },
        reasons: ['Detected NestJS core framework dependency'],
      };
    }

    // 1f. Express / Fastify / Koa Backend
    if (allDeps['express'] || allDeps['fastify'] || allDeps['koa']) {
      const frameworkName = allDeps['fastify'] ? 'Fastify' : allDeps['koa'] ? 'Koa' : 'Express';
      let startCmd = scripts['start'] ? 'npm start' : 'node server.js';
      if (!scripts['start'] && hasFile('index.js')) startCmd = 'node index.js';
      if (!scripts['start'] && hasFile('app.js')) startCmd = 'node app.js';

      return {
        framework: 'express',
        frameworkName: `${frameworkName} Server`,
        language: lang,
        languageName: langName,
        runtimeType: 'server',
        buildCommand: scripts['build'] ? 'npm run build' : '',
        installCommand: installCmd,
        outputDir: '.',
        startCommand: startCmd,
        rootDirectory: normRoot,
        isStaticExport: false,
        confidence: 'high',
        detectedFiles: ['package.json'],
        envSuggestions: { NODE_ENV: 'production', PORT: '3000' },
        reasons: [`Detected ${frameworkName} server dependency requiring persistent runtime`],
      };
    }

    // 1g. Vite (React, Vue, Svelte, Vanilla)
    if (allDeps['vite'] || hasFile('vite.config.ts') || hasFile('vite.config.js')) {
      const isVue = Boolean(allDeps['vue']);
      const isReact = Boolean(allDeps['react']);
      const subname = isVue ? 'Vue (Vite)' : isReact ? 'React (Vite)' : 'Vite';

      return {
        framework: 'vite',
        frameworkName: subname,
        language: lang,
        languageName: langName,
        runtimeType: 'static',
        buildCommand: scripts['build'] ? 'npm run build' : 'npx vite build',
        installCommand: installCmd,
        outputDir: 'dist',
        startCommand: '',
        rootDirectory: normRoot,
        isStaticExport: true,
        confidence: 'high',
        detectedFiles: ['package.json'],
        envSuggestions: { NODE_ENV: 'production' },
        reasons: ['Detected Vite build tooling in package configuration'],
      };
    }

    // 1h. Vue CLI / Nuxt
    if (allDeps['nuxt']) {
      return {
        framework: 'nuxt',
        frameworkName: 'Nuxt',
        language: lang,
        languageName: langName,
        runtimeType: 'static',
        buildCommand: scripts['build'] ? 'npm run build' : 'npx nuxt build',
        installCommand: installCmd,
        outputDir: '.output/public',
        startCommand: 'node .output/server/index.mjs',
        rootDirectory: normRoot,
        isStaticExport: true,
        confidence: 'high',
        detectedFiles: ['package.json'],
        envSuggestions: { NODE_ENV: 'production' },
        reasons: ['Detected Nuxt framework dependency'],
      };
    }

    if (allDeps['vue']) {
      return {
        framework: 'vue',
        frameworkName: 'Vue',
        language: lang,
        languageName: langName,
        runtimeType: 'static',
        buildCommand: scripts['build'] ? 'npm run build' : '',
        installCommand: installCmd,
        outputDir: 'dist',
        startCommand: '',
        rootDirectory: normRoot,
        isStaticExport: true,
        confidence: 'medium',
        detectedFiles: ['package.json'],
        envSuggestions: { NODE_ENV: 'production' },
        reasons: ['Detected Vue dependencies'],
      };
    }

    // 1i. Standard React (Create React App or Webpack)
    if (allDeps['react'] || allDeps['react-scripts']) {
      const isCra = Boolean(allDeps['react-scripts']);
      return {
        framework: 'react',
        frameworkName: 'React App',
        language: lang,
        languageName: langName,
        runtimeType: 'static',
        buildCommand: scripts['build'] ? 'npm run build' : 'npm run build',
        installCommand: installCmd,
        outputDir: isCra ? 'build' : 'dist',
        startCommand: '',
        rootDirectory: normRoot,
        isStaticExport: true,
        confidence: 'high',
        detectedFiles: ['package.json'],
        envSuggestions: { NODE_ENV: 'production' },
        reasons: ['Detected React library and build scripts'],
      };
    }

    // 1j. Generic Node.js with build or start script
    if (scripts['build']) {
      return {
        framework: 'other',
        frameworkName: 'Node.js Build',
        language: lang,
        languageName: langName,
        runtimeType: scripts['start'] ? 'server' : 'static',
        buildCommand: 'npm run build',
        installCommand: installCmd,
        outputDir: hasFile('dist') ? 'dist' : hasFile('build') ? 'build' : '.',
        startCommand: scripts['start'] ? 'npm start' : '',
        rootDirectory: normRoot,
        isStaticExport: !scripts['start'],
        confidence: 'medium',
        detectedFiles: ['package.json'],
        envSuggestions: { NODE_ENV: 'production' },
        reasons: ['Detected package.json with build script'],
      };
    }
  }

  // 2. Python Ecosystem (requirements.txt, pyproject.toml, Pipfile, setup.py)
  const isPython =
    hasFile('requirements.txt') ||
    hasFile('pyproject.toml') ||
    hasFile('Pipfile') ||
    hasFile('setup.py') ||
    hasAnyFileMatching(/\.py$/i);

  if (isPython) {
    const reqs =
      (getFileContent('requirements.txt') || '') +
      '\n' +
      (getFileContent('pyproject.toml') || '') +
      '\n' +
      (getFileContent('Pipfile') || '');

    // 2a. FastAPI
    if (reqs.includes('fastapi') || reqs.includes('uvicorn')) {
      return {
        framework: 'fastapi',
        frameworkName: 'FastAPI',
        language: 'python',
        languageName: 'Python',
        runtimeType: 'server',
        buildCommand: hasFile('requirements.txt') ? 'pip install -r requirements.txt' : 'pip install fastapi uvicorn',
        installCommand: 'pip install -r requirements.txt',
        outputDir: '.',
        startCommand: 'uvicorn main:app --host 0.0.0.0 --port 3000',
        rootDirectory: normRoot,
        isStaticExport: false,
        confidence: 'high',
        detectedFiles: hasFile('requirements.txt') ? ['requirements.txt'] : ['pyproject.toml'],
        envSuggestions: { PYTHONUNBUFFERED: '1', PORT: '3000' },
        reasons: ['Detected FastAPI / Uvicorn dependencies in Python manifest'],
      };
    }

    // 2b. Django
    if (reqs.includes('django') || hasFile('manage.py')) {
      return {
        framework: 'django',
        frameworkName: 'Django',
        language: 'python',
        languageName: 'Python',
        runtimeType: 'server',
        buildCommand: 'pip install -r requirements.txt && python manage.py collectstatic --noinput',
        installCommand: 'pip install -r requirements.txt',
        outputDir: 'staticfiles',
        startCommand: 'gunicorn wsgi:application --bind 0.0.0.0:3000',
        rootDirectory: normRoot,
        isStaticExport: false,
        confidence: 'high',
        detectedFiles: hasFile('manage.py') ? ['manage.py'] : ['requirements.txt'],
        envSuggestions: { PYTHONUNBUFFERED: '1', PORT: '3000' },
        reasons: ['Detected Django framework and manage.py entrypoint'],
      };
    }

    // 2c. Flask
    if (reqs.includes('flask') || hasFile('app.py') || hasFile('wsgi.py')) {
      return {
        framework: 'flask',
        frameworkName: 'Flask',
        language: 'python',
        languageName: 'Python',
        runtimeType: 'server',
        buildCommand: hasFile('requirements.txt') ? 'pip install -r requirements.txt' : 'pip install flask gunicorn',
        installCommand: 'pip install -r requirements.txt',
        outputDir: '.',
        startCommand: 'gunicorn app:app --bind 0.0.0.0:3000',
        rootDirectory: normRoot,
        isStaticExport: false,
        confidence: 'high',
        detectedFiles: ['requirements.txt'],
        envSuggestions: { PYTHONUNBUFFERED: '1', PORT: '3000' },
        reasons: ['Detected Flask dependencies and WSGI structure'],
      };
    }

    // Generic Python
    return {
      framework: 'other',
      frameworkName: 'Python Application',
      language: 'python',
      languageName: 'Python',
      runtimeType: 'server',
      buildCommand: hasFile('requirements.txt') ? 'pip install -r requirements.txt' : '',
      installCommand: 'pip install -r requirements.txt',
      outputDir: '.',
      startCommand: hasFile('main.py') ? 'python main.py' : 'python app.py',
      rootDirectory: normRoot,
      isStaticExport: false,
      confidence: 'medium',
      detectedFiles: hasFile('requirements.txt') ? ['requirements.txt'] : ['pyproject.toml'],
      envSuggestions: { PYTHONUNBUFFERED: '1', PORT: '3000' },
      reasons: ['Detected Python manifest files'],
    };
  }

  // 3. Go Ecosystem (go.mod, main.go)
  if (hasFile('go.mod') || hasFile('main.go')) {
    return {
      framework: 'go',
      frameworkName: 'Go Web Application',
      language: 'go',
      languageName: 'Go',
      runtimeType: 'server',
      buildCommand: 'go build -v -o app .',
      installCommand: 'go mod download',
      outputDir: '.',
      startCommand: './app',
      rootDirectory: normRoot,
      isStaticExport: false,
      confidence: 'high',
      detectedFiles: hasFile('go.mod') ? ['go.mod'] : ['main.go'],
      envSuggestions: { PORT: '3000' },
      reasons: ['Detected Go module (go.mod) and entrypoint'],
    };
  }

  // 4. Rust Ecosystem (Cargo.toml)
  if (hasFile('Cargo.toml')) {
    return {
      framework: 'rust',
      frameworkName: 'Rust Application',
      language: 'rust',
      languageName: 'Rust',
      runtimeType: 'server',
      buildCommand: 'cargo build --release',
      installCommand: 'cargo fetch',
      outputDir: 'target/release',
      startCommand: './target/release/app',
      rootDirectory: normRoot,
      isStaticExport: false,
      confidence: 'high',
      detectedFiles: ['Cargo.toml'],
      envSuggestions: { PORT: '3000', RUST_LOG: 'info' },
      reasons: ['Detected Cargo manifest (Cargo.toml)'],
    };
  }

  // 5. PHP Ecosystem (composer.json, index.php)
  if (hasFile('composer.json') || hasFile('index.php')) {
    const isLaravel = hasFile('artisan');
    return {
      framework: 'php',
      frameworkName: isLaravel ? 'Laravel' : 'PHP Application',
      language: 'php',
      languageName: 'PHP',
      runtimeType: 'server',
      buildCommand: hasFile('composer.json') ? 'composer install --no-dev --optimize-autoloader' : '',
      installCommand: 'composer install',
      outputDir: isLaravel ? 'public' : '.',
      startCommand: isLaravel ? 'php artisan serve --host=0.0.0.0 --port=3000' : 'php -S 0.0.0.0:3000 index.php',
      rootDirectory: normRoot,
      isStaticExport: false,
      confidence: 'high',
      detectedFiles: hasFile('composer.json') ? ['composer.json'] : ['index.php'],
      envSuggestions: { PORT: '3000' },
      reasons: [isLaravel ? 'Detected Laravel artisan and project structure' : 'Detected PHP files'],
    };
  }

  // 6. Static HTML / CSS / JS site
  if (hasFile('index.html')) {
    return {
      framework: 'static',
      frameworkName: 'Static HTML / CSS / JS',
      language: 'html',
      languageName: 'HTML / CSS / JS',
      runtimeType: 'static',
      buildCommand: '',
      installCommand: '',
      outputDir: '.',
      startCommand: '',
      rootDirectory: normRoot,
      isStaticExport: true,
      confidence: 'high',
      detectedFiles: ['index.html'],
      envSuggestions: {},
      reasons: ['Found root index.html without build tool requirement'],
    };
  }

  // Fallback: Default to static
  return {
    framework: 'static',
    frameworkName: 'Static Assets',
    language: 'html',
    languageName: 'Static',
    runtimeType: 'static',
    buildCommand: '',
    installCommand: '',
    outputDir: '.',
    startCommand: '',
    rootDirectory: normRoot,
    isStaticExport: true,
    confidence: 'low',
    detectedFiles: [],
    envSuggestions: {},
    reasons: ['No known build manifest detected; defaulting to static file serving'],
  };
}
