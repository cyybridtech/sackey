import React from 'react';
import { cn } from '../../lib/utils';

type BadgeVariant = 'blue' | 'red' | 'green' | 'yellow' | 'gray' | 'orange' | 'purple';

interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  className?: string;
  dot?: boolean;
}

const variantClasses: Record<BadgeVariant, string> = {
  blue: 'bg-blue-100 text-blue-800 border-blue-200',
  red: 'bg-red-100 text-red-800 border-red-200',
  green: 'bg-green-100 text-green-800 border-green-200',
  yellow: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  gray: 'bg-gray-100 text-gray-700 border-gray-200',
  orange: 'bg-orange-100 text-orange-800 border-orange-200',
  purple: 'bg-purple-100 text-purple-800 border-purple-200',
};

const dotColors: Record<BadgeVariant, string> = {
  blue: 'bg-blue-500',
  red: 'bg-red-500',
  green: 'bg-green-500',
  yellow: 'bg-yellow-500',
  gray: 'bg-gray-400',
  orange: 'bg-orange-500',
  purple: 'bg-purple-500',
};

export function Badge({ variant = 'gray', children, className, dot = false }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border',
        variantClasses[variant],
        className,
      )}
    >
      {dot && <span className={cn('w-1.5 h-1.5 rounded-full', dotColors[variant])} />}
      {children}
    </span>
  );
}

// Specific status badge for sales
interface SaleStatusBadgeProps {
  status: string;
  workerView?: boolean;
}

export function SaleStatusBadge({ status, workerView = false }: SaleStatusBadgeProps) {
  if (workerView) {
    const workerMap: Record<string, { label: string; variant: BadgeVariant }> = {
      BLUE: { label: 'Pending Confirmation', variant: 'gray' },
      RED: { label: 'Awaiting Review', variant: 'gray' },
      GREEN: { label: 'Confirmed', variant: 'gray' },
      FLAGGED: { label: 'Issue — Contact Admin', variant: 'gray' },
    };
    const config = workerMap[status] || { label: status, variant: 'gray' as BadgeVariant };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  }

  const adminMap: Record<string, { label: string; variant: BadgeVariant }> = {
    BLUE: { label: 'Pending (A)', variant: 'blue' },
    RED: { label: 'Pending (B)', variant: 'red' },
    GREEN: { label: 'Confirmed', variant: 'green' },
    FLAGGED: { label: 'Flagged', variant: 'orange' },
  };
  const config = adminMap[status] || { label: status, variant: 'gray' as BadgeVariant };
  return (
    <Badge variant={config.variant} dot>
      {config.label}
    </Badge>
  );
}

export default Badge;
