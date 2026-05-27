// @ts-nocheck
"use client";
// @ts-nocheck

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { api } from "@/trpc/react";
import { cn, timeAgo } from "@/lib/utils";
import Link from "next/link";
import {
  Search,
  FileText,
  ArrowLeft,
  Loader2,
  X,
  Clock,
  Boxes,
  SlidersHorizontal,
} from "lucide-react";

export default function SearchPage() {
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get("q") ?? "";

  const [query, setQuery] = useState(initialQuery);
  const [debouncedQuery, setDebouncedQuery] = useState(initialQuery);
  const [selectedSpace, setSelectedSpace] = useState<string | undefined>();
  const [showFilters, setShowFilters] = useState(false);

  const { data: spaces = [] } = api.documents.spaces.list.useQuery();

  const { data, isLoading, isFetching } = api.documents.search.query.useQuery(
    { query: debouncedQuery, spaceId: selectedSpace, limit: 30 },
    { enabled: debouncedQuery.length > 0 }
  );

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(timer);
  }, [query]);

  const results = data?.results ?? [];
  const total = data?.total ?? 0;
  const isSearching = isLoading || isFetching;

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/documents" className="text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-xl font-bold">Search Documents</h1>
      </div>

      {/* Search input */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <input
            autoFocus
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search across all documents…"
            className="w-full bg-card border border-border rounded-2xl pl-11 pr-12 py-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 shadow-sm"
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
            {isSearching && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
            {query && (
              <button
                onClick={() => setQuery("")}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={cn(
                "p-1 rounded-lg transition-colors",
                showFilters || selectedSpace ? "text-brand-600 bg-brand-500/10" : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              <SlidersHorizontal className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Filters */}
        {showFilters && (
          <div className="bg-card border border-border rounded-xl p-3 space-y-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Filter by Space</label>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setSelectedSpace(undefined)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors",
                    !selectedSpace
                      ? "border-brand-500 bg-brand-500/10 text-brand-600"
                      : "border-border text-muted-foreground hover:bg-muted"
                  )}
                >
                  All spaces
                </button>
                {spaces.map((space) => (
                  <button
                    key={space.id}
                    onClick={() => setSelectedSpace(space.id)}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors",
                      selectedSpace === space.id
                        ? "border-brand-500 bg-brand-500/10 text-brand-600"
                        : "border-border text-muted-foreground hover:bg-muted"
                    )}
                  >
                    <span>{space.icon ?? "📄"}</span>
                    {space.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Results */}
      {!debouncedQuery ? (
        <div className="flex flex-col items-center gap-4 py-16 text-center text-muted-foreground">
          <Search className="w-12 h-12 text-muted-foreground/30" />
          <p className="text-sm">Type to search across all your documents</p>
        </div>
      ) : isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : results.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <Search className="w-12 h-12 text-muted-foreground/30" />
          <div>
            <p className="font-semibold">No results found</p>
            <p className="text-sm text-muted-foreground mt-1">
              Try different keywords or check your filters
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {total} result{total !== 1 ? "s" : ""} for <span className="font-medium text-foreground">"{debouncedQuery}"</span>
              {selectedSpace && (
                <span className="ml-1">
                  in{" "}
                  <button onClick={() => setSelectedSpace(undefined)} className="text-brand-500 hover:underline">
                    {spaces.find((s) => s.id === selectedSpace)?.name ?? "space"}
                    <X className="w-3 h-3 inline ml-0.5" />
                  </button>
                </span>
              )}
            </p>
          </div>

          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            {results.map((result, idx) => {
              const spaceData = result.space_id
                ? spaces.find((s) => s.id === result.space_id)
                : null;

              return (
                <Link
                  key={result.id}
                  href={`/documents/${result.id}`}
                  className={cn(
                    "flex items-center gap-4 px-5 py-4 hover:bg-muted/30 transition-colors group",
                    idx > 0 && "border-t border-border"
                  )}
                >
                  {/* Icon */}
                  <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center flex-shrink-0 text-lg">
                    {result.icon ? (
                      <span>{result.icon}</span>
                    ) : (
                      <FileText className="w-5 h-5 text-muted-foreground" />
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate group-hover:text-brand-500 transition-colors">
                      {result.title}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {result.breadcrumb_path && (
                        <span className="text-xs text-muted-foreground truncate">
                          {result.breadcrumb_path}
                        </span>
                      )}
                      {spaceData && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground flex-shrink-0">
                          <Boxes className="w-3 h-3" />
                          {spaceData.name}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Time */}
                  <span className="text-xs text-muted-foreground flex-shrink-0 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {timeAgo(result.updated_at)}
                  </span>
                </Link>
              );
            })}
          </div>

          {total > results.length && (
            <p className="text-xs text-center text-muted-foreground">
              Showing {results.length} of {total} results. Refine your query for more specific results.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
