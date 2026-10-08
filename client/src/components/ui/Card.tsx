import React from 'react';
import { cn } from '../../lib/utils';

interface CardProps {
  children: React.ReactNode;
  title?: string;
  actions?: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  noPadding?: boolean;
}

export function Card({ children, title, actions, className, bodyClassName, noPadding }: CardProps) {
  return (
    <div className={cn('bg-white rounded-xl border border-gray-200 shadow-sm', className)}>
      {(title || actions) && (
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          {title && <h3 className="font-semibold text-gray-800 text-base">{title}</h3>}
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className={cn(noPadding ? '' : 'p-5', bodyClassName)}>{children}</div>
    </div>
  );
}

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: {
    value: number;
    label?: string;
    positive?: boolean;
  };
  className?: string;
  iconBg?: string;
}

export function StatCard({ title, value, icon, trend, className, iconBg }: StatCardProps) {
  return (
    <div className={cn('bg-white rounded-xl border border-gray-200 shadow-sm p-5', className)}>
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <p className="mt-1 text-2xl font-bold text-gray-900 truncate">{value}</p>
          {trend && (
            <p
              className={cn(
                'mt-1 text-xs font-medium flex items-center gap-1',
                trend.positive ? 'text-green-600' : 'text-red-500',
              )}
            >
              <span>{trend.positive ? '↑' : '↓'}</span>
              <span>
                {trend.value}% {trend.label || 'vs yesterday'}
              </span>
            </p>
          )}
        </div>
        <div
          className={cn(
            'p-3 rounded-xl shrink-0',
            iconBg || 'bg-primary-50 text-primary-700',
          )}
        >
          {icon}
        </div>
      </div>
    </div>
  );
}
