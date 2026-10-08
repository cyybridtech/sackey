import React from 'react';
import { cn } from '../../lib/utils';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: {
    value: number;
    label?: string;
    isPositive?: boolean;
  };
  color?: 'blue' | 'red' | 'green' | 'yellow' | string;
  iconBg?: string;
  className?: string;
}

const colorStyles: Record<string, string> = {
  blue: 'bg-blue-50 text-blue-700',
  red: 'bg-red-50 text-red-700',
  green: 'bg-green-50 text-green-700',
  yellow: 'bg-yellow-50 text-yellow-700',
};

export function StatCard({ title, value, icon, trend, color, iconBg, className }: StatCardProps) {
  const resolvedBg = iconBg || (color && colorStyles[color]) || 'bg-primary-50 text-primary-700';
  return (
    <div
      className={cn(
        'bg-white rounded-xl border border-gray-200 shadow-sm p-5 flex items-start gap-4',
        className,
      )}
    >
      <div
        className={cn(
          'p-3 rounded-xl shrink-0',
          resolvedBg,
        )}
      >
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-500">{title}</p>
        <p className="mt-0.5 text-2xl font-bold text-gray-900 truncate">{value}</p>
        {trend && (
          <p
            className={cn(
              'mt-1 text-xs font-medium flex items-center gap-1',
              trend.isPositive ? 'text-green-600' : 'text-red-500',
            )}
          >
            {trend.isPositive ? '↑' : '↓'} {Math.abs(trend.value)}%{' '}
            {trend.label || 'vs yesterday'}
          </p>
        )}
      </div>
    </div>
  );
}

export default StatCard;
