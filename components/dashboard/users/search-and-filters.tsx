'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { X, Search, SlidersHorizontal } from 'lucide-react';
import type { AuthProvider } from '@/actions/users';
import { type Filters, USER_STATUS_MAP, ROLE_COLORS } from './types';
import { PROVIDER_CONFIG } from './provider-icons';

interface SearchAndFiltersProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  filters: Filters;
  onFiltersChange: (filters: Filters) => void;
  activeFilterCount: number;
}

export function SearchAndFilters({
  searchQuery,
  onSearchChange,
  filters,
  onFiltersChange,
  activeFilterCount,
}: SearchAndFiltersProps) {
  const toggleRole = (role: string) => {
    const newRoles = filters.roles.includes(role)
      ? filters.roles.filter((r) => r !== role)
      : [...filters.roles, role];
    onFiltersChange({ ...filters, roles: newRoles });
  };

  const toggleStatus = (status: string) => {
    const newStatuses = filters.statuses.includes(status)
      ? filters.statuses.filter((s) => s !== status)
      : [...filters.statuses, status];
    onFiltersChange({ ...filters, statuses: newStatuses });
  };

  const toggleProvider = (provider: AuthProvider) => {
    const newProviders = filters.providers.includes(provider)
      ? filters.providers.filter((p) => p !== provider)
      : [...filters.providers, provider];
    onFiltersChange({ ...filters, providers: newProviders });
  };

  const clearFilters = () => {
    onFiltersChange({ roles: [], statuses: [], providers: [] });
  };

  return (
    <div className='flex flex-col sm:flex-row gap-3'>
      {/* Search Input */}
      <div className='relative flex-1'>
        <Search className='absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground' />
        <Input
          placeholder='Search by name or email...'
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className='h-9 font-mono text-sm pl-9 bg-background border-border'
        />
        {searchQuery && (
          <button
            type='button'
            aria-label='Clear search'
            onClick={() => onSearchChange('')}
            className='absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground'
          >
            <X className='h-4 w-4' />
          </button>
        )}
      </div>

      {/* Filters */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant='outline' size='sm' className='gap-2 shrink-0'>
            <SlidersHorizontal className='h-4 w-4' />
            Filters
            {activeFilterCount > 0 && (
              <span className='rounded bg-muted px-1.5 text-[13px]'>
                {activeFilterCount}
              </span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent align='end' className='w-80 p-0 bg-card border-border'>
          {/* Header */}
          <div className='flex items-center justify-between px-4 py-3 border-b border-border'>
            <h4 className='text-sm font-semibold'>Filters</h4>
            {activeFilterCount > 0 && (
              <button
                type='button'
                onClick={clearFilters}
                className='text-xs text-link hover:underline font-normal'
              >
                Clear all
              </button>
            )}
          </div>

          <div className='p-4 space-y-5'>
            {/* Role Filter */}
            <div className='space-y-3'>
              <label className='text-sm text-muted-foreground font-normal'>
                Role
              </label>
              <div className='flex flex-wrap gap-2'>
                {['admin', 'moderator', 'user'].map((role) => (
                  <button
                    key={role}
                    type='button'
                    onClick={() => toggleRole(role)}
                    className={`px-3 py-1.5 text-xs border rounded-md capitalize transition-colors ${
                      filters.roles.includes(role)
                        ? ROLE_COLORS[role]
                        : 'border-border text-muted-foreground hover:text-foreground hover:border-muted-foreground hover:bg-muted/50'
                    }`}
                  >
                    {role}
                  </button>
                ))}
              </div>
            </div>

            {/* Status Filter */}
            <div className='space-y-3'>
              <label className='text-sm text-muted-foreground font-normal'>
                Status
              </label>
              <div className='flex flex-wrap gap-2'>
                {Object.entries(USER_STATUS_MAP).map(([key, { label }]) => (
                  <button
                    key={key}
                    type='button'
                    onClick={() => toggleStatus(key)}
                    className={`px-3 py-1.5 text-xs border rounded-md transition-colors ${
                      filters.statuses.includes(key)
                        ? 'bg-muted text-foreground border-foreground/20'
                        : 'border-border text-muted-foreground hover:text-foreground hover:border-muted-foreground hover:bg-muted/50'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Provider Filter */}
            <div className='space-y-3'>
              <label className='text-sm text-muted-foreground font-normal'>
                Auth Provider
              </label>
              <div className='flex flex-wrap gap-2'>
                {(Object.keys(PROVIDER_CONFIG) as AuthProvider[]).map((provider) => {
                  const config = PROVIDER_CONFIG[provider];
                  const Icon = config.icon;
                  return (
                    <button
                      key={provider}
                      type='button'
                      onClick={() => toggleProvider(provider)}
                      className={`px-3 py-1.5 text-xs border rounded-md transition-colors flex items-center gap-2 ${
                        filters.providers.includes(provider)
                          ? 'bg-muted text-foreground border-foreground/20'
                          : 'border-border text-muted-foreground hover:text-foreground hover:border-muted-foreground hover:bg-muted/50'
                      }`}
                    >
                      <Icon className='h-3.5 w-3.5' />
                      {config.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
