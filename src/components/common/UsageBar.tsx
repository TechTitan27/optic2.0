import React from 'react';

interface UsageBarProps {
  label: string;
  used: number;
  total: number;
  unit: string;
  warningThreshold?: number; // e.g. 0.8
  className?: string;
}

export const UsageBar: React.FC<UsageBarProps> = ({
  label,
  used,
  total,
  unit,
  warningThreshold = 0.85,
  className = '',
}) => {
  const percentage = Math.min(100, Math.max(0, (used / (total || 1)) * 100));
  const isHigh = percentage / 100 >= warningThreshold;

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-zinc-300">{label}</span>
        <span className="font-mono text-zinc-400">
          <strong className="text-zinc-100 font-semibold">{used}</strong> / {total} {unit}
        </span>
      </div>
      <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden p-0.5 border border-zinc-700/40">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            isHigh ? 'bg-amber-500' : 'bg-sky-500'
          }`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};
