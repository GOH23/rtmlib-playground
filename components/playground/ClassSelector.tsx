'use client';

import { useState, useMemo } from 'react';
import { Search, X, Filter, Grid3X3, List, Eye, EyeOff, CheckCircle2 } from 'lucide-react';
import { COCO_CLASSES } from 'rtmlib-ts';

export interface ClassSelectorProps {
  selectedClasses: string[];
  onToggleClass: (cls: string) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
}

export function ClassSelector({ selectedClasses, onToggleClass, onSelectAll, onDeselectAll }: ClassSelectorProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const filteredClasses = useMemo(() => {
    let classes = COCO_CLASSES;
    if (searchQuery) {
      classes = classes.filter(cls => cls.toLowerCase().includes(searchQuery.toLowerCase()));
    }
    if (!showAll) {
      classes = classes.slice(0, 20);
    }
    return classes;
  }, [searchQuery, showAll]);

  const selectedCount = selectedClasses.length;
  const totalCount = COCO_CLASSES.length;

  return (
    <div className="space-y-4">
      {/* Header with search and actions */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Search classes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 rounded-xl border border-white/15 bg-slate-900/80 text-slate-100 placeholder-slate-500 focus:border-blue-500/50 transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
            className="p-3 rounded-xl border border-white/15 bg-slate-900/80 text-slate-400 hover:text-slate-200 transition-all"
          >
            {viewMode === 'grid' ? <List className="w-5 h-5" /> : <Grid3X3 className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Stats and actions */}
      <div className="flex items-center justify-between flex-wrap gap-3 p-4 rounded-xl bg-slate-900/50 border border-white/10">
        <div className="flex items-center gap-3">
          <Filter className="w-5 h-5 text-blue-400" />
          <span className="text-slate-400">
            <span className="text-blue-400 font-bold">{selectedCount}</span> / {totalCount} selected
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onSelectAll}
            className="px-4 py-2 rounded-lg bg-blue-500/20 text-blue-400 font-medium hover:bg-blue-500/30 transition-all text-sm"
          >
            Select All
          </button>
          <button
            onClick={onDeselectAll}
            className="px-4 py-2 rounded-lg bg-red-500/20 text-red-400 font-medium hover:bg-red-500/30 transition-all text-sm"
          >
            Deselect All
          </button>
        </div>
      </div>

      {/* Classes grid/list */}
      <div className={viewMode === 'grid'
        ? 'grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 gap-2 max-h-[400px] overflow-y-auto p-2'
        : 'flex flex-col gap-2 max-h-[400px] overflow-y-auto p-2'
      }>
        {filteredClasses.map((cls) => {
          const isSelected = selectedClasses.includes(cls);
          return (
            <button
              key={cls}
              onClick={() => onToggleClass(cls)}
              className={`p-3 rounded-xl flex items-center gap-3 transition-all ${
                viewMode === 'list' ? 'justify-between' : 'flex-col text-center'
              } ${
                isSelected
                  ? 'bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-blue-500/30 text-slate-100'
                  : 'bg-slate-900/50 border border-white/10 text-slate-400 hover:bg-slate-800/50 hover:border-white/20'
              }`}
            >
              <span className={viewMode === 'list' ? 'font-medium' : 'text-sm font-medium'}>{cls}</span>
              {isSelected ? (
                <CheckCircle2 className="w-5 h-5 text-blue-400 flex-shrink-0" />
              ) : (
                <div className="w-5 h-5 rounded-full border-2 border-slate-600 flex-shrink-0" />
              )}
            </button>
          );
        })}
      </div>

      {/* Show more/less */}
      {!searchQuery && (
        <button
          onClick={() => setShowAll(!showAll)}
          className="w-full py-3 rounded-xl border border-white/15 bg-slate-900/50 text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 transition-all flex items-center justify-center gap-2"
        >
          {showAll ? (
            <>
              <EyeOff className="w-4 h-4" /> Show Less
            </>
          ) : (
            <>
              <Eye className="w-4 h-4" /> Show All {totalCount} Classes
            </>
          )}
        </button>
      )}
    </div>
  );
}
