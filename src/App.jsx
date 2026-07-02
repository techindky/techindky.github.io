import React, { useState, useEffect, useCallback, useRef } from 'react';
import { TypesenseAPI } from './typesense-api';
import Sidebar from './components/Sidebar';
import Filters from './components/Filters';
import DocumentList from './components/DocumentList';
import DocumentModal from './components/DocumentModal';
import ToastContainer from './components/ToastContainer';
import { FolderIcon, RefreshIcon, HourglassIcon, MenuIcon } from './components/Icons';

const PAGE_LENGTH = 20;

function RelativeTime({ timestamp }) {
  const [timeAgo, setTimeAgo] = useState('');

  useEffect(() => {
    const calculateTimeAgo = () => {
      const diffMs = Date.now() - timestamp;
      const diffSec = Math.floor(diffMs / 1000);
      const diffMin = Math.floor(diffSec / 60);

      if (diffSec < 5) {
        setTimeAgo('just now');
      } else if (diffSec < 60) {
        setTimeAgo(`${diffSec} seconds ago`);
      } else if (diffMin === 1) {
        setTimeAgo('1 minute ago');
      } else {
        setTimeAgo(`${diffMin} minutes ago`);
      }
    };

    calculateTimeAgo();
    const interval = setInterval(calculateTimeAgo, 5000);
    return () => clearInterval(interval);
  }, [timestamp]);

  return <span>{timeAgo}</span>;
}

export default function App() {
  // ── Core state ────────────────────────────────────────────────────────────
  const [collections, setCollections] = useState([]);
  const [currentCollection, setCurrentCollection] = useState(null);
  const [collectionSchema, setCollectionSchema] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [foundCount, setFoundCount] = useState(0);

  // ── UI state ──────────────────────────────────────────────────────────────
  const [viewType, setViewType] = useState('json'); // 'json' | 'table'
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [beautifyAll, setBeautifyAll] = useState(false);
  const [envMenuOpen, setEnvMenuOpen] = useState(false);

  // ── Query / filter state ──────────────────────────────────────────────────
  const [queryMode, setQueryMode] = useState('builder'); // 'builder' | 'raw'
  const [rawQueryText, setRawQueryText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilters, setActiveFilters] = useState([]);
  const [sortBy, setSortBy] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [lastUpdated, setLastUpdated] = useState(Date.now());
  const searchDebounceRef = useRef(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // ── Environment ───────────────────────────────────────────────────────────
  const [currentEnv, setCurrentEnv] = useState('PROD');

  // ── Modal ─────────────────────────────────────────────────────────────────
  const [modalDoc, setModalDoc] = useState(null);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const getQueryByFields = useCallback((schema) => {
    if (!schema?.fields) return '';
    return schema.fields
      .filter((f) => f.index && (f.type === 'string' || f.type === 'string[]'))
      .map((f) => f.name)
      .join(',');
  }, []);

  const buildFilterString = useCallback(() => {
    return activeFilters
      .map((f) => {
        switch (f.operator) {
          case '=': return `${f.field}:=${f.value}`;
          case '>': return `${f.field}:>${f.value}`;
          case '<': return `${f.field}:<${f.value}`;
          case 'contains': return `${f.field}:${f.value}`;
          case 'starts_with': return `${f.field}:${f.value}*`;
          default: return `${f.field}:${f.value}`;
        }
      })
      .join(' && ');
  }, [activeFilters]);

  // ── Load Collections ──────────────────────────────────────────────────────
  const loadCollections = useCallback(async (ctx) => {
    try {
      setIsLoading(true);
      const colls = await TypesenseAPI.getColls();
      if (ctx?.ignore) return [];
      if (!isMountedRef.current) return [];
      setCollections(colls);
      setLastUpdated(Date.now());
      if (colls.length > 0) {
        window.toast?.success(`Loaded ${colls.length} collection${colls.length !== 1 ? 's' : ''}`);
      } else {
        window.toast?.warning('No collections found in your Typesense instance');
      }
      return colls;
    } catch (err) {
      if (ctx?.ignore) return [];
      if (!isMountedRef.current) return [];
      console.error('Error loading collections:', err);
      window.toast?.error('Failed to load collections. Check your Typesense connection and API key.');
      setCollections([]);
      return [];
    } finally {
      if (!ctx?.ignore && isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, []);

  // ── Load Documents ────────────────────────────────────────────────────────
  const loadDocuments = useCallback(
    async (
      query = '*',
      page = 1,
      filters = activeFilters,
      sort = sortBy,
      schema = collectionSchema,
      collection = currentCollection,
      mode = queryMode,
      rawText = rawQueryText
    ) => {
      if (!collection) return;
      try {
        setIsLoading(true);
        let result;
        if (mode === 'raw') {
          let searchParams;
          try {
            searchParams = JSON.parse(rawText || '{}');
          } catch (e) {
            if (!isMountedRef.current) return;
            window.toast?.error('Invalid JSON in raw query');
            return;
          }
          // Merge page parameter if not explicitly set or override it for pagination buttons
          searchParams = {
            per_page: PAGE_LENGTH,
            page,
            ...searchParams
          };
          result = await TypesenseAPI.searchRaw(collection, searchParams);
        } else {
          const queryBy = getQueryByFields(schema);
          const filterStr = filters
            .map((f) => {
              switch (f.operator) {
                case '=': return `${f.field}:=${f.value}`;
                case '>': return `${f.field}:>${f.value}`;
                case '<': return `${f.field}:<${f.value}`;
                case 'contains': return `${f.field}:${f.value}`;
                case 'starts_with': return `${f.field}:${f.value}*`;
                default: return `${f.field}:${f.value}`;
              }
            })
            .join(' && ');

          result = await TypesenseAPI.searchDocuments(collection, {
            q: query || '*',
            query_by: queryBy,
            filter_by: filterStr,
            sort_by: sort || '',
            per_page: PAGE_LENGTH,
            page,
          });
        }

        if (!isMountedRef.current) return;

        if (result?.hits) {
          setDocuments(result.hits.map((h) => h.document));
          setFoundCount(result.found ?? 0);
          if (mode === 'search' || mode === 'builder') {
            const hasQueryOrFilter = (query !== '*' && query !== '') || filters.length > 0;
            if (hasQueryOrFilter) {
              const count = result.found ?? 0;
              if (count > 0) {
                window.toast?.success(`Found ${count.toLocaleString()} matching document${count !== 1 ? 's' : ''}`);
              } else {
                window.toast?.info('No documents match your search criteria');
              }
            }
          } else {
            window.toast?.success(`Raw query returned ${result.found ?? 0} results`);
          }
        } else if (result?.grouped_hits) {
          const flattenedDocs = result.grouped_hits.flatMap((gh) =>
            (gh.hits || []).map((h) => ({
              ...h.document,
              _group_value: gh.group_values ? gh.group_values.join(', ') : 'N/A',
            }))
          );
          setDocuments(flattenedDocs);
          setFoundCount(result.found ?? 0);
          window.toast?.success(`Grouped query returned ${result.grouped_hits.length} groups (${flattenedDocs.length} total hits)`);
        } else {
          setDocuments([]);
          setFoundCount(0);
          if (result !== null) window.toast?.warning('No documents found');
        }
      } catch (err) {
        if (!isMountedRef.current) return;
        console.error('Error loading documents:', err);
        const msg = err?.message || '';
        if (msg.includes('CORS')) window.toast?.error('CORS error: enable CORS in your Typesense server config');
        else if (msg.includes('401')) window.toast?.error('Authentication failed: check your API key');
        else if (msg.includes('404')) window.toast?.error(`Collection "${collection}" not found`);
        else if (msg.includes('timeout')) window.toast?.error('Request timeout: check your server connection');
        else window.toast?.error(`Failed to load documents: ${msg || 'Unknown error'}`);
        setDocuments([]);
        setFoundCount(0);
      } finally {
        if (isMountedRef.current) {
          setIsLoading(false);
        }
      }
    },
    [activeFilters, sortBy, collectionSchema, currentCollection, getQueryByFields, queryMode, rawQueryText]
  );

  // ── Select Collection ─────────────────────────────────────────────────────
  const selectCollection = useCallback(async (collectionName, ctx) => {
    try {
      setIsLoading(true);
      setCurrentCollection(collectionName);
      setCurrentPage(1);
      setActiveFilters([]);
      setSortBy('');
      setSearchQuery('');
      setBeautifyAll(false);
      setDocuments([]);
      setFoundCount(0);
      setQueryMode('builder');
      setRawQueryText('');

      const schema = await TypesenseAPI.getCollectionSchema(collectionName);
      if (ctx?.ignore) return;
      if (!isMountedRef.current) return;
      setCollectionSchema(schema);
      setLastUpdated(Date.now());

      if (!schema) {
        window.toast?.error(`Failed to load schema for: ${collectionName}`);
        return;
      }

      const queryBy = schema.fields
        ?.filter((f) => f.index && (f.type === 'string' || f.type === 'string[]'))
        .map((f) => f.name)
        .join(',') ?? '';

      const result = await TypesenseAPI.searchDocuments(collectionName, {
        q: '*',
        query_by: queryBy,
        filter_by: '',
        sort_by: '',
        per_page: PAGE_LENGTH,
        page: 1,
      });

      if (ctx?.ignore) return;
      if (!isMountedRef.current) return;

      if (result?.hits) {
        setDocuments(result.hits.map((h) => h.document));
        setFoundCount(result.found ?? 0);
      } else {
        setDocuments([]);
        setFoundCount(0);
      }
    } catch (err) {
      if (ctx?.ignore) return;
      if (!isMountedRef.current) return;
      console.error('Error selecting collection:', err);
      window.toast?.error(`Failed to load collection: ${collectionName}. ${err.message || 'Check your connection.'}`);
    } finally {
      if (!ctx?.ignore && isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, []);

  // ── Handle Environment Change ─────────────────────────────────────────────
  const handleEnvChange = useCallback(async (envName) => {
    const success = TypesenseAPI.setEnvironment(envName);
    if (!success) {
      window.toast?.error(`Failed to switch to environment: ${envName}`);
      return;
    }
    setCurrentEnv(envName);
    window.toast?.info(`Switched to ${envName}`);
    setCollections([]);
    setCurrentCollection(null);
    setCollectionSchema(null);
    setDocuments([]);
    setFoundCount(0);
    setActiveFilters([]);
    setSortBy('');
    setSearchQuery('');
    setCurrentPage(1);

    const colls = await loadCollections();
    if (!isMountedRef.current) return;
    if (colls.length > 0) {
      await selectCollection(colls[0].name);
    }
  }, [loadCollections, selectCollection]);

  // ── Search with debounce ──────────────────────────────────────────────────
  const handleSearchChange = useCallback((val) => {
    setSearchQuery(val);
    if (queryMode === 'raw') {
      try {
        const parsed = JSON.parse(rawQueryText || '{}');
        parsed.q = val || '*';
        setRawQueryText(JSON.stringify(parsed, null, 2));
      } catch (e) {
        // do nothing
      }
    }
    clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      setCurrentPage(1);
      loadDocuments(val || '*', 1, activeFilters, sortBy, collectionSchema, currentCollection);
    }, 300);
  }, [loadDocuments, activeFilters, sortBy, collectionSchema, currentCollection, queryMode, rawQueryText]);

  // ── Filters ───────────────────────────────────────────────────────────────
  const handleAddFilter = useCallback(({ field, operator, value }) => {
    const exists = activeFilters.find((f) => f.field === field && f.operator === operator && f.value === value);
    if (exists) {
      window.toast?.warning('This filter already exists');
      return false;
    }
    const newFilters = [...activeFilters, { field, operator, value, id: Date.now() }];
    setActiveFilters(newFilters);
    setCurrentPage(1);
    loadDocuments(searchQuery || '*', 1, newFilters, sortBy, collectionSchema, currentCollection);
    window.toast?.success(`Filter added: ${field} ${operator} "${value}"`);
    return true;
  }, [activeFilters, loadDocuments, searchQuery, sortBy, collectionSchema, currentCollection]);

  const handleSetFilters = useCallback((filters) => {
    setActiveFilters(filters);
    setCurrentPage(1);
    loadDocuments(searchQuery || '*', 1, filters, sortBy, collectionSchema, currentCollection);
  }, [loadDocuments, searchQuery, sortBy, collectionSchema, currentCollection]);

  const handleSearchAndFiltersChange = useCallback((query, filters) => {
    setSearchQuery(query);
    setActiveFilters(filters);
    setCurrentPage(1);
    loadDocuments(query || '*', 1, filters, sortBy, collectionSchema, currentCollection);
  }, [loadDocuments, sortBy, collectionSchema, currentCollection]);

  const handleRemoveFilter = useCallback((filterId) => {
    const newFilters = activeFilters.filter((f) => f.id !== filterId);
    setActiveFilters(newFilters);
    setCurrentPage(1);
    loadDocuments(searchQuery || '*', 1, newFilters, sortBy, collectionSchema, currentCollection);
  }, [activeFilters, loadDocuments, searchQuery, sortBy, collectionSchema, currentCollection]);

  const handleClearAllFilters = useCallback(() => {
    const count = activeFilters.length;
    setActiveFilters([]);
    setSortBy('');
    setSearchQuery('');
    setCurrentPage(1);
    if (count > 0) {
      window.toast?.info(`Cleared ${count} filter${count !== 1 ? 's' : ''}`);
    }
    loadDocuments('*', 1, [], '', collectionSchema, currentCollection);
  }, [activeFilters, loadDocuments, collectionSchema, currentCollection]);

  // ── Sort ──────────────────────────────────────────────────────────────────
  const handleSortChange = useCallback((sort) => {
    setSortBy(sort);
    setCurrentPage(1);
    loadDocuments(searchQuery || '*', 1, activeFilters, sort, collectionSchema, currentCollection);
  }, [loadDocuments, searchQuery, activeFilters, collectionSchema, currentCollection]);

  // ── Refresh ───────────────────────────────────────────────────────────────
  const handleRefresh = useCallback(() => {
    const loadingToast = window.toast?.loading('Refreshing data…');
    loadDocuments(searchQuery || '*', currentPage, activeFilters, sortBy, collectionSchema, currentCollection, queryMode, rawQueryText)
      .finally(() => {
        window.toast?.success('Data refreshed');
        window.toast?.dismiss(loadingToast);
      });
  }, [loadDocuments, searchQuery, currentPage, activeFilters, sortBy, collectionSchema, currentCollection, queryMode, rawQueryText]);

  // ── Pagination ────────────────────────────────────────────────────────────
  const handlePageChange = useCallback((page) => {
    setCurrentPage(page);
    loadDocuments(searchQuery || '*', page, activeFilters, sortBy, collectionSchema, currentCollection, queryMode, rawQueryText);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [loadDocuments, searchQuery, activeFilters, sortBy, collectionSchema, currentCollection, queryMode, rawQueryText]);

  // ── Builder-to-Raw sync useEffect ─────────────────────────────────────────
  useEffect(() => {
    if (queryMode === 'builder' && currentCollection) {
      const filterStr = activeFilters
        .map((f) => {
          switch (f.operator) {
            case '=': return `${f.field}:=${f.value}`;
            case '>': return `${f.field}:>${f.value}`;
            case '<': return `${f.field}:<${f.value}`;
            case 'contains': return `${f.field}:${f.value}`;
            case 'starts_with': return `${f.field}:${f.value}*`;
            default: return `${f.field}:${f.value}`;
          }
        })
        .join(' && ');

      const params = {
        q: searchQuery || '*',
        query_by: getQueryByFields(collectionSchema),
        filter_by: filterStr,
      };
      if (sortBy) {
        params.sort_by = sortBy;
      }
      setRawQueryText(JSON.stringify(params, null, 2));
    }
  }, [queryMode, searchQuery, activeFilters, sortBy, collectionSchema, currentCollection, getQueryByFields]);

  // ── Raw-to-Builder mode switching handler ──────────────────────────────────
  const handleQueryModeChange = useCallback((mode) => {
    if (mode === 'raw') {
      setQueryMode('raw');
    } else {
      try {
        let newSearchQuery = searchQuery;
        let newActiveFilters = activeFilters;
        let newSortBy = sortBy;

        if (rawQueryText && rawQueryText.trim()) {
          const parsed = JSON.parse(rawQueryText);
          newSearchQuery = parsed.q === '*' ? '' : (parsed.q || '');
          newSortBy = parsed.sort_by || '';

          const filterStr = parsed.filter_by || '';
          const parsedFilters = [];
          if (filterStr.trim()) {
            const parts = filterStr.split('&&').map(p => p.trim()).filter(Boolean);
            parts.forEach((part, index) => {
              const match = part.match(/^([a-zA-Z0-9_$.]+)\s*(::=|:=|:!=|:>=|:<=|:>|:<|:)\s*(.*)$/);
              if (match) {
                const field = match[1];
                const opSymbol = match[2];
                let val = match[3].trim();
                
                let operator = '=';
                if (opSymbol === ':') {
                  if (val.endsWith('*')) {
                    operator = 'starts_with';
                    val = val.slice(0, -1);
                  } else {
                    operator = 'contains';
                  }
                } else if (opSymbol === ':>' || opSymbol === ':>=') {
                  operator = '>';
                } else if (opSymbol === ':<' || opSymbol === ':<=') {
                  operator = '<';
                } else if (opSymbol === ':=') {
                  operator = '=';
                }
                
                parsedFilters.push({
                  field,
                  operator,
                  value: val,
                  id: Date.now() + index
                });
              }
            });
          }
          newActiveFilters = parsedFilters;
        }

        setSearchQuery(newSearchQuery);
        setActiveFilters(newActiveFilters);
        setSortBy(newSortBy);
        setQueryMode(mode);
        setCurrentPage(1);
      } catch (e) {
        console.error('Error switching query mode:', e);
        setQueryMode(mode);
        setCurrentPage(1);
        window.toast?.error('Switched to Builder with empty state: Invalid JSON');
      }
    }
  }, [rawQueryText, searchQuery, activeFilters, sortBy]);

  // ── Raw query execution ───────────────────────────────────────────────────
  const handleExecuteRawQuery = useCallback(async () => {
    setCurrentPage(1);
    await loadDocuments(searchQuery || '*', 1, activeFilters, sortBy, collectionSchema, currentCollection, 'raw', rawQueryText);
  }, [loadDocuments, searchQuery, activeFilters, sortBy, collectionSchema, currentCollection, rawQueryText]);

  // ── Initial load ──────────────────────────────────────────────────────────
  useEffect(() => {
    const ctx = { ignore: false };
    const boot = async () => {
      await TypesenseAPI.init();
      if (ctx.ignore) return;
      setCurrentEnv(TypesenseAPI.getCurrentEnvName());
      const colls = await loadCollections(ctx);
      if (ctx.ignore) return;
      if (colls.length > 0) {
        await selectCollection(colls[0].name, ctx);
      }
    };
    boot();
    return () => {
      ctx.ignore = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Derived data ──────────────────────────────────────────────────────────
  const currentCollectionMeta = collections.find((c) => c.name === currentCollection);
  const defaultQueryBy = collectionSchema?.fields
    ?.filter((f) => f.index && (f.type === 'string' || f.type === 'string[]'))
    .map((f) => f.name)
    .join(',') ?? '';

  const envBorder = currentEnv === 'LOCAL' ? 'border-success' : currentEnv === 'UAT' ? 'border-warning' : 'border-error';
  const envBg = currentEnv === 'LOCAL' ? 'bg-success' : currentEnv === 'UAT' ? 'bg-warning' : 'bg-error';

  const renderEnvDropdown = () => (
    <div className="relative">
      <div
        onClick={() => setEnvMenuOpen((prev) => !prev)}
        className={`inline-flex items-center rounded-full ${envBg} p-px shadow-sm text-xs font-semibold overflow-hidden cursor-pointer focus:outline-none`}
        title="Switch Environment"
      >
        <div className={`inline-flex items-center rounded-full overflow-hidden`}>
          <div className={`bg-gray-100 text-gray-600 pl-3 pr-2.5 py-1 flex items-center gap-1.5 border-r`}>
            <span className="flex h-2 w-2 relative">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${envBg} opacity-75`} />
              <span className={`relative inline-flex rounded-full h-2 w-2 ${envBg}`} />
            </span>
            <span>Env</span>
          </div>
          <div className={`px-4 py-1 text-white font-bold`}>
            <span>{currentEnv}</span>
          </div>
        </div>
      </div>

      {envMenuOpen && (
        <>
          {/* Overlay backdrop to close dropdown on click outside */}
          <div 
            className="fixed inset-0 z-10" 
            onClick={() => setEnvMenuOpen(false)}
          />
          {/* Dropdown Menu */}
          <div className="absolute right-0 mt-2 w-32 bg-white rounded-md border border-gray-200 shadow-lg z-20 overflow-hidden py-1">
            {['LOCAL', 'UAT', 'PROD'].map((env) => {
              const isCurrent = env === currentEnv;
              return (
                <button
                  key={env}
                  onClick={() => {
                    handleEnvChange(env);
                    setEnvMenuOpen(false);
                  }}
                  className={`w-full text-left px-4 py-2 text-xs font-semibold flex items-center justify-between hover:bg-gray-100 transition-colors ${
                    isCurrent ? 'text-success bg-[#25d56408]' : 'text-gray-700'
                  }`}
                  style={{ background: isCurrent ? '#25d56408' : 'none', border: 'none', boxShadow: 'none', transform: 'none' }}
                >
                  <span>{env}</span>
                  {isCurrent && (
                    <span className="flex h-1.5 w-1.5 relative">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-success" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* ── Sidebar ─────────────────────────────────────────────────────── */}
      <Sidebar
        collections={collections}
        currentCollection={currentCollection}
        onSelectCollection={selectCollection}
        sidebarOpen={sidebarOpen}
        onCloseSidebar={() => setSidebarOpen(false)}
        onRefreshCollections={loadCollections}
        isLoadingCollections={isLoading}
      />

      {/* ── Main content ─────────────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Collection title bar */}
        <div className="bg-neutral px-6 py-4 border-b border-gray-200 flex-shrink-0 flex flex-col gap-2.5">
          {/* Line 1: Collection Name (Desktop: name + tags, Env on right; Mobile: name only) */}
          <div className="flex items-center justify-between min-w-0">
            <div className="flex items-center min-w-0 flex-1 gap-2">
              {/* Mobile Menu Toggle */}
              <button
                id="mobile-menu-toggle"
                className="lg:hidden mr-1.5 cursor-pointer flex-shrink-0"
                onClick={() => setSidebarOpen((o) => !o)}
                style={{ boxShadow: 'none', background: 'none', border: 'none', padding: '4px', transform: 'none' }}
              >
                <MenuIcon className="w-6 h-6 text-[#111b21]" />
              </button>
              <h2 id="collection-name" className="text-2xl font-semibold text-[#111b21] flex items-center min-w-0 flex-1 gap-2">
                {currentCollection ? (
                  <>
                    <FolderIcon className="w-6 h-6 mr-1 flex-shrink-0" active={true} />
                    <span className="truncate" title={currentCollection}>
                      {currentCollection}
                    </span>
                    
                    {/* Tags next to collection name on Desktop only */}
                    <span className="hidden md:inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-success text-white">Active</span>
                    <span className="hidden md:inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-[#111b21]">Indexed</span>
                  </>
                ) : (
                  <span>'No Collection Selected'</span>
                )}
              </h2>
            </div>
            
            {/* Env dropdown on desktop only (hidden on mobile) */}
            <div className="hidden md:block flex-shrink-0">
              {renderEnvDropdown()}
            </div>
          </div>

          {/* Line 2 on Mobile: Active & Indexed tags on left, Env on right (hidden on desktop) */}
          <div className="flex items-center justify-between gap-4 md:hidden">
            {currentCollection && (
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-success text-white">Active</span>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-[#111b21]">Indexed</span>
              </div>
            )}
            <div className="flex-shrink-0">
              {renderEnvDropdown()}
            </div>
          </div>

          {/* Line 3: Documents and Last Updated stats (visible on all views) */}
          {currentCollection && (
            <p className="text-sm text-[#111b21] flex items-center gap-1.5 flex-wrap">
              <span id="document-count" className="font-semibold">
                {currentCollectionMeta ? currentCollectionMeta.num_documents.toLocaleString() : '0'}
              </span>
              <span>documents</span>
              <span className="text-gray-300 select-none">•</span>
              <HourglassIcon className="w-3.5 h-3.5" />
              <span>Last updated <RelativeTime timestamp={lastUpdated} /></span>
              {isLoading && (
                <span className="ml-1 inline-flex items-center gap-1 text-xs text-primary animate-pulse">
                  <RefreshIcon className="w-3 h-3 animate-spin" stroke="currentColor" />
                  Loading…
                </span>
              )}
            </p>
          )}
        </div>

        {/* Filter bar */}
        {currentCollection && currentCollectionMeta?.num_documents > 0 && (
          <Filters
            collectionSchema={collectionSchema}
            activeFilters={activeFilters}
            onAddFilter={handleAddFilter}
            onSetFilters={handleSetFilters}
            onRemoveFilter={handleRemoveFilter}
            onClearAllFilters={handleClearAllFilters}
            onSearchAndFiltersChange={handleSearchAndFiltersChange}
            sortBy={sortBy}
            onSortByChange={handleSortChange}
            onRefresh={handleRefresh}
            isLoading={isLoading}
            queryMode={queryMode}
            onQueryModeChange={handleQueryModeChange}
            rawQueryText={rawQueryText}
            onRawQueryTextChange={setRawQueryText}
            onExecuteRawQuery={handleExecuteRawQuery}
            searchQuery={searchQuery}
            onSearchChange={handleSearchChange}
            viewType={viewType}
            onViewTypeChange={setViewType}
            beautifyAll={beautifyAll}
            onToggleBeautifyAll={() => setBeautifyAll((b) => !b)}
          />
        )}

        {/* Main view area */}
        <div className="flex-1 overflow-hidden flex flex-col min-h-0">
          <DocumentList
            documents={documents}
            viewType={viewType}
            beautifyAll={beautifyAll}
            onOpenDocumentModal={setModalDoc}
            foundCount={foundCount}
            perPage={PAGE_LENGTH}
            currentPage={currentPage}
            onPageChange={handlePageChange}
            sortBy={sortBy}
          />
        </div>
      </main>

      {/* ── Document detail modal ─────────────────────────────────────────── */}
      {modalDoc && (
        <DocumentModal document={modalDoc} onClose={() => setModalDoc(null)} />
      )}

      {/* ── Toast overlay ─────────────────────────────────────────────────── */}
      <ToastContainer />
    </div>
  );
}
