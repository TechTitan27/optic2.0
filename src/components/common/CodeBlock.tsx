import React, { useState } from 'react';
import { Check, Copy } from 'lucide-react';

interface CodeBlockProps {
  code: string;
  language?: string;
  filename?: string;
  className?: string;
}

export const CodeBlock: React.FC<CodeBlockProps> = ({
  code,
  language = 'bash',
  filename,
  className = '',
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  return (
    <div
      className={`rounded-xl border border-zinc-800 bg-zinc-950 font-mono text-xs overflow-hidden shadow-inner ${className}`}
    >
      <div className="flex items-center justify-between px-3.5 py-2 bg-zinc-900/90 border-b border-zinc-800/80 text-zinc-400">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 opacity-60">
            <span className="w-2.5 h-2.5 rounded-full bg-zinc-700" />
            <span className="w-2.5 h-2.5 rounded-full bg-zinc-700" />
            <span className="w-2.5 h-2.5 rounded-full bg-zinc-700" />
          </div>
          {filename && <span className="text-zinc-300 font-medium ml-1.5">{filename}</span>}
        </div>
        <div className="flex items-center gap-2">
          {language && <span className="uppercase text-[10px] tracking-wider text-zinc-500 font-semibold">{language}</span>}
          <button
            onClick={handleCopy}
            className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
            title="Copy code"
            aria-label="Copy code"
          >
            {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
          </button>
        </div>
      </div>
      <pre className="p-4 overflow-x-auto text-zinc-200 leading-relaxed scrollbar-thin scrollbar-thumb-zinc-800">
        <code>{code}</code>
      </pre>
    </div>
  );
};
