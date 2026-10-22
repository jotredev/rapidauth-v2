import Link from 'next/link';
import { cn } from '@/lib/utils';

interface SupportLinkProps {
  className?: string;
}

export function SupportLink({ className }: SupportLinkProps) {
  return (
    <p className={cn('text-xs text-muted-foreground', className)}>
      Need help?{' '}
      <Link
        href="/support"
        className="font-normal text-link underline-offset-4 hover:underline"
      >
        Contact support
      </Link>
    </p>
  );
}
