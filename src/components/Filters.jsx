import React, { useState, useEffect } from 'react';
import { RefreshIcon, CloseIcon, PlayIcon, InfoIcon, SearchIcon, SortIcon, BeautifyIcon, TableViewIcon, CodeIcon } from './Icons';

// ─── Filter string parser ────────────────────────────────────────────────────
function splitTopLevel(str) {
  let depth = 0;
  const parts = [];
  const operators = [];
  let lastIndex = 0;

  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    if (char === '(') depth++;
    else if (char === ')') depth--;
    else if (depth === 0) {
      if (str.substring(i, i + 2) === '&&') {
        parts.push(str.substring(lastIndex, i).trim());
        operators.push('AND');
        i++;
        lastIndex = i + 1;
      } else if (str.substring(i, i + 2) === '||') {
        parts.push(str.substring(lastIndex, i).trim());
        operators.push('OR');
        i++;
        lastIndex = i + 1;
      }
    }
  }
  parts.push(str.substring(lastIndex).trim());
  return { parts: parts.filter((p) => p.length > 0), operators };
}

function parseNode(str) {
  str = str.trim();
  if (!str) return null;

  const { parts, operators } = splitTopLevel(str);
  if (parts.length > 1) {
    return {
      type: 'group',
      operators,
      rules: parts.map((p) => parseNode(p)).filter(Boolean),
    };
  }

  if (str.startsWith('(') && str.endsWith(')')) {
    const inner = str.slice(1, -1).trim();
    let depth = 0;
    let ok = true;
    for (let i = 0; i < inner.length; i++) {
      if (inner[i] === '(') depth++;
      else if (inner[i] === ')') depth--;
      if (depth < 0) { ok = false; break; }
    }
    if (ok) {
      const parsed = parseNode(inner);
      if (parsed) {
        if (parsed.type === 'group') return parsed;
        return { type: 'group', operators: [], rules: [parsed] };
      }
    }
  }

  const joinMatch = str.match(/^(\$[a-zA-Z0-9_]+)\((.*)\)$/s);
  if (joinMatch) {
    return { type: 'join', field: joinMatch[1], rules: parseNode(joinMatch[2]) };
  }

  const opRegex = /([a-zA-Z0-9_$.]+)\s*(::=|:=|:!=|:>=|:<=|:>|:<|:)\s*(.*)/;
  const opMatch = str.match(opRegex);
  if (opMatch) {
    return { type: 'condition', field: opMatch[1], operator: opMatch[2], value: opMatch[3].trim() };
  }

  return { type: 'raw', value: str };
}

function parseFilterString(filterStr) {
  if (!filterStr) return null;
  return parseNode(filterStr.trim());
}

// ─── Filter renderer ─────────────────────────────────────────────────────────
const opDescMap = {
  ':=': 'equals',
  ':!=': 'does not equal',
  ':>=': 'is ≥',
  ':<=': 'is ≤',
  ':>': 'is >',
  ':<': 'is <',
  ':': 'matches',
};

function RenderFilterNode({ node }) {
  if (!node) return null;

  if (node.type === 'group') {
    return (
      <div className="pl-3 border-l border-gray-300 my-1.5 space-y-1.5">
        {node.rules.map((rule, idx) => (
          <React.Fragment key={idx}>
            {idx > 0 && (
              <div className="my-0.5">
                <span
                  className={`text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded border ${
                    (node.operators[idx - 1] || 'AND') === 'OR'
                      ? 'bg-amber-50 text-amber-800 border-amber-200'
                      : 'bg-blue-50 text-blue-800 border-blue-200'
                  }`}
                >
                  {node.operators[idx - 1] || 'AND'}
                </span>
              </div>
            )}
            <RenderFilterNode node={rule} />
          </React.Fragment>
        ))}
      </div>
    );
  }

  if (node.type === 'join') {
    return (
      <div className="pl-3 border-l-2 border-purple-500 my-2 bg-purple-50 p-2 rounded-md">
        <div className="text-xs font-semibold text-purple-700 mb-1">
          Joined Collection: <span className="font-mono text-purple-900">{node.field}</span>
        </div>
        <div className="space-y-1">
          <RenderFilterNode node={node.rules} />
        </div>
      </div>
    );
  }

  if (node.type === 'condition') {
    const { field, operator, value } = node;
    const opDesc = opDescMap[operator] || operator;
    let valueEl = (
      <span className="font-semibold text-gray-800 bg-gray-100 px-1 py-0.5 rounded border border-gray-200 font-mono text-xs">
        {value}
      </span>
    );

    // Geo-point detection
    const geoMatch = value.match(/^\(([-0-9.]+),\s*([-0-9.]+),\s*([a-zA-Z0-9\s.]+)\)$/);
    if (geoMatch) {
      valueEl = (
        <span>
          within{' '}
          <span className="font-semibold text-teal-700 bg-teal-50 px-1 py-0.5 rounded border border-teal-200">
            {geoMatch[3]}
          </span>{' '}
          of [{<span className="font-mono text-teal-800">{geoMatch[1]}</span>},{' '}
          {<span className="font-mono text-teal-800">{geoMatch[2]}</span>}]
        </span>
      );
    }

    // Unix timestamp detection
    if (/^\d{10}$/.test(value)) {
      const ts = parseInt(value);
      const date = new Date(ts * 1000);
      if (!isNaN(date.getTime()) && ts > 946684800 && ts < 2082758400) {
        valueEl = (
          <span>
            <span className="font-semibold text-gray-800 bg-gray-100 px-1 py-0.5 rounded border border-gray-200 font-mono text-xs" title={ts}>
              {value}
            </span>{' '}
            <span className="text-xs text-gray-500">({date.toLocaleString()})</span>
          </span>
        );
      }
    }

    return (
      <div className="py-0.5 px-2 hover:bg-gray-100 rounded flex flex-wrap items-center gatext-sm">
        <span className="font-mono text-blue-700 font-medium">{field}</span>
        <span className="text-gray-400 italic text-xs">&nbsp;{opDesc}&nbsp;</span>
        {valueEl}
      </div>
    );
  }

  if (node.type === 'raw') {
    return (
      <div className="py-1 px-2 bg-red-50 text-red-700 rounded text-xs font-mono border border-red-100">
        Unparsed: {node.value}
      </div>
    );
  }

  return null;
}

// ─── Smart Explanation ───────────────────────────────────────────────────────
function SmartExplanation({ params }) {
  const q = params.q || '*';
  const queryBy = params.query_by || '';
  const filterBy = params.filter_by;
  const parsedFilters = filterBy && filterBy.trim() ? parseFilterString(filterBy) : null;

  const extraStats = [];
  if (params.group_by) extraStats.push({ label: 'Grouped by', value: params.group_by, color: 'bg-purple-50 text-purple-700 border-purple-200' });
  if (params.sort_by) extraStats.push({ label: 'Sorted by', value: params.sort_by, color: 'bg-blue-50 text-blue-700 border-blue-200' });
  if (params.facet_by) extraStats.push({ label: 'Facets', value: params.facet_by, color: 'bg-teal-50 text-teal-700 border-teal-200' });
  if (params.include_fields) extraStats.push({ label: 'Include fields', value: params.include_fields, color: 'bg-gray-100 text-gray-700 border-gray-200' });
  if (params.exclude_fields) extraStats.push({ label: 'Exclude fields', value: params.exclude_fields, color: 'bg-gray-100 text-gray-700 border-gray-200' });
  if (params.page || params.per_page) extraStats.push({ label: 'Pagination', value: `Page ${params.page || 1}, ${params.per_page || 20} per page`, color: 'bg-gray-100 text-gray-700 border-gray-200' });

  return (
    <div className="space-y-4 text-sm">
      {/* Search Scope */}
      <div className="border-b border-gray-100 pb-3">
        <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Search Scope</div>
        <div className="text-[#111b21]">
          Searching for{' '}
          <span className="font-semibold text-primary">"{q}"</span>{' '}
          {queryBy ? (
            <>across <span className="font-mono text-xs bg-gray-100 px-1 py-0.5 rounded border border-gray-200">{queryBy}</span></>
          ) : 'across all fields'}
        </div>
      </div>

      {/* Filters */}
      <div>
        <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Filters</div>
        {parsedFilters ? (
          <div className="bg-gray-50 p-3 rounded-corner border border-gray-200">
            <RenderFilterNode node={parsedFilters} />
          </div>
        ) : (
          <div className="text-gray-400 italic">No filters applied — matches all records.</div>
        )}
      </div>

      {/* Extra Directives */}
      {extraStats.length > 0 && (
        <div className="border-t border-gray-100 pt-3">
          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Execution Directives</div>
          <ul className="space-y-1 list-disc pl-4">
            {extraStats.map((s) => (
              <li key={s.label}>
                {s.label}:{' '}
                <span className={`font-mono text-xs px-1 py-0.5 rounded border ${s.color}`}>{s.value}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ─── Filter Autocomplete Parser and State Machine ────────────────────────────
function parseFilterInput(input, schemaFields = []) {
  const trimmed = input.trim();
  if (!trimmed) return null;

  // 1. Try to match standard comparison or verbal operator:
  const sqlLikeRegex = /^([a-zA-Z0-9_$.]+)\s*(=|!=|>=|<=|>|<|contains|starts_with|starts\s+with)\s*(.*)$/i;
  const sqlMatch = trimmed.match(sqlLikeRegex);

  if (sqlMatch) {
    const fieldName = sqlMatch[1].trim();
    let op = sqlMatch[2].trim().toLowerCase();
    let val = sqlMatch[3].trim();

    // Map operator
    if (op === '=' || op === '==') {
      op = '=';
    } else if (op === '>' || op === '>=') {
      op = '>';
    } else if (op === '<' || op === '<=') {
      op = '<';
    } else if (op === 'contains') {
      op = 'contains';
    } else if (op === 'starts_with' || op === 'starts with') {
      op = 'starts_with';
    } else {
      op = '=';
    }

    // Check if value ends with '*' for starts_with shorthand
    if (val.endsWith('*') && op === '=') {
      op = 'starts_with';
      val = val.slice(0, -1).trim();
    }

    return { field: fieldName, operator: op, value: val };
  }

  // 2. Try to match colon-based shorthand:
  const colonRegex = /^([a-zA-Z0-9_$.]+)\s*:\s*(.*)$/;
  const colonMatch = trimmed.match(colonRegex);
  if (colonMatch) {
    const fieldName = colonMatch[1].trim();
    let val = colonMatch[2].trim();
    let op = '='; // default for colon shorthand

    // Check if value has prefix operator like >, <, >=, <=, =, !=
    if (val.startsWith('>=') || val.startsWith('>=')) {
      op = '>';
      val = val.substring(2).trim();
    } else if (val.startsWith('<=') || val.startsWith('<=')) {
      op = '<';
      val = val.substring(2).trim();
    } else if (val.startsWith('>')) {
      op = '>';
      val = val.substring(1).trim();
    } else if (val.startsWith('<')) {
      op = '<';
      val = val.substring(1).trim();
    } else if (val.startsWith('=')) {
      op = '=';
      val = val.substring(1).trim();
    }

    // Check if value ends with '*' for starts_with shorthand
    if (val.endsWith('*')) {
      op = 'starts_with';
      val = val.slice(0, -1).trim();
    }

    return { field: fieldName, operator: op, value: val };
  }

  // 3. Fallback: If no operator found but there's a space, try to parse
  const spaceIndex = trimmed.indexOf(' ');
  if (spaceIndex !== -1) {
    const firstWord = trimmed.substring(0, spaceIndex).trim();
    const rest = trimmed.substring(spaceIndex + 1).trim();
    const isField = schemaFields.some(f => f.name === firstWord) || firstWord === 'id';
    if (isField) {
      let val = rest;
      let op = '=';
      if (val.endsWith('*')) {
        op = 'starts_with';
        val = val.slice(0, -1).trim();
      }
      return { field: firstWord, operator: op, value: val };
    }
  }

  return null;
}

function parseAllFilters(input, schemaFields = []) {
  const trimmed = input.trim();
  if (!trimmed) return [];

  // Split by '&&'
  const parts = trimmed.split(/\s+&&\s+/);
  const filters = [];

  for (let part of parts) {
    part = part.trim();
    if (!part) continue;
    const parsed = parseFilterInput(part, schemaFields);
    if (parsed) {
      filters.push({ ...parsed, id: Date.now() + Math.random() });
    }
  }
  return filters;
}

function getSuggestionsState(inputValue, indexableFields = []) {
  // Find the last token after the last '&&'
  const andIndex = inputValue.lastIndexOf('&&');
  let currentToken = inputValue;
  let prefix = '';
  
  if (andIndex !== -1) {
    prefix = inputValue.substring(0, andIndex + 2);
    currentToken = inputValue.substring(andIndex + 2);
  }

  const val = currentToken.trimStart();
  if (!val) {
    return {
      phase: 'field',
      suggestions: ['id', ...indexableFields.map(f => f.name)],
      query: '',
      prefix,
    };
  }

  const colonIndex = val.indexOf(':');
  const spaceIndex = val.indexOf(' ');
  
  let delimiterIndex = -1;
  let hasColon = false;
  if (colonIndex !== -1 && (spaceIndex === -1 || colonIndex < spaceIndex)) {
    delimiterIndex = colonIndex;
    hasColon = true;
  } else if (spaceIndex !== -1) {
    delimiterIndex = spaceIndex;
  }

  if (delimiterIndex === -1) {
    const query = val.toLowerCase();
    const allFields = ['id', ...indexableFields.map(f => f.name)];
    const filtered = allFields.filter(f => f.toLowerCase().includes(query));
    return {
      phase: 'field',
      suggestions: filtered,
      query,
      prefix,
    };
  }

  const fieldName = val.substring(0, delimiterIndex).trim();
  const isFieldValid = indexableFields.some(f => f.name === fieldName) || fieldName === 'id';
  const fieldMeta = indexableFields.find(f => f.name === fieldName);

  if (!isFieldValid) {
    return {
      phase: 'field',
      suggestions: [],
      query: fieldName,
      prefix,
    };
  }

  const rest = val.substring(delimiterIndex + 1);

  if (hasColon) {
    const opMatch = rest.match(/^\s*(>=|<=|>|<|=)/);
    if (opMatch) {
      const op = opMatch[1];
      const typedValue = rest.substring(opMatch[0].length);
      return {
        phase: 'value',
        field: fieldName,
        fieldType: fieldMeta ? fieldMeta.type : 'string',
        operator: op,
        value: typedValue,
        suggestions: [],
        prefix,
      };
    } else {
      return {
        phase: 'value',
        field: fieldName,
        fieldType: fieldMeta ? fieldMeta.type : 'string',
        operator: '=',
        value: rest,
        suggestions: [],
        prefix,
      };
    }
  }

  const trimmedRest = rest.trimStart();
  const opPattern = /^(starts_with|starts\s+with|contains|=|>|<|!=)\s+(.*)$/i;
  const opMatch = trimmedRest.match(opPattern);

  if (opMatch) {
    let op = opMatch[1];
    if (op.toLowerCase().startsWith('starts')) {
      op = 'starts_with';
    }
    const typedValue = opMatch[2];
    return {
      phase: 'value',
      field: fieldName,
      fieldType: fieldMeta ? fieldMeta.type : 'string',
      operator: op,
      value: typedValue,
      suggestions: [],
      prefix,
    };
  }

  const operators = ['=', '>', '<', 'contains', 'starts_with'];
  const query = trimmedRest.toLowerCase();
  const filteredOps = operators.filter(o => o.toLowerCase().startsWith(query) || (o === 'starts_with' && 'starts with'.startsWith(query)));

  return {
    phase: 'operator',
    field: fieldName,
    fieldType: fieldMeta ? fieldMeta.type : 'string',
    suggestions: filteredOps,
    query,
    prefix,
  };
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function Filters({
  collectionSchema,
  activeFilters = [],
  onAddFilter,
  onSetFilters,
  onRemoveFilter,
  onClearAllFilters,
  onSearchAndFiltersChange,
  sortBy = '',
  onSortByChange,
  onRefresh,
  isLoading = false,
  queryMode = 'builder',
  onQueryModeChange,
  rawQueryText = '',
  onRawQueryTextChange,
  onExecuteRawQuery,
  searchQuery = '',
  onSearchChange,
  viewType = 'json',
  onViewTypeChange,
  beautifyAll = false,
  onToggleBeautifyAll
}) {
  const [inputValue, setInputValue] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [showInfoPopup, setShowInfoPopup] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);

  const [parsedParams, setParsedParams] = useState({});
  const [parseError, setParseError] = useState(null);
  const [isSpinning, setIsSpinning] = useState(false);

  const suggestionsRef = React.useRef(null);
  const infoRef = React.useRef(null);

  const handleRefreshClick = () => {
    setIsSpinning(true);
    onRefresh?.();
    setTimeout(() => {
      setIsSpinning(false);
    }, 1000);
  };

  // Parse raw JSON query parameters live for explanation
  useEffect(() => {
    try {
      if (rawQueryText && rawQueryText.trim()) {
        const parsed = JSON.parse(rawQueryText);
        setParsedParams(parsed);
        setParseError(null);
      } else {
        setParsedParams({});
        setParseError(null);
      }
    } catch (e) {
      setParseError(e.message);
    }
  }, [rawQueryText]);

  // Click outside to close suggestions and info popup
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(event.target)) {
        setShowSuggestions(false);
      }
      if (infoRef.current && !infoRef.current.contains(event.target)) {
        setShowInfoPopup(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Sync activeFilters and searchQuery to inputValue
  useEffect(() => {
    const parts = [];
    if (searchQuery && searchQuery !== '*') {
      parts.push(searchQuery);
    }
    if (activeFilters.length > 0) {
      const filterStr = activeFilters
        .map((f) => {
          if (f.operator === '=') {
            return `${f.field}:${f.value}`;
          } else if (f.operator === 'contains') {
            return `${f.field} contains ${f.value}`;
          } else if (f.operator === 'starts_with') {
            return `${f.field}:${f.value}*`;
          } else {
            return `${f.field} ${f.operator} ${f.value}`;
          }
        })
        .join(' && ');
      parts.push(filterStr);
    }
    setInputValue(parts.join(' && '));
  }, [activeFilters, searchQuery]);

  // Get indexable fields from schema
  const indexableFields = React.useMemo(() => {
    return collectionSchema?.fields
      ? collectionSchema.fields.filter((f) => f.index)
      : [];
  }, [collectionSchema]);

  // Get sortable fields from schema
  const sortableFields = React.useMemo(() => {
    return collectionSchema?.fields
      ? collectionSchema.fields.filter((f) => f.sort)
      : [];
  }, [collectionSchema]);

  // Suggestions state
  const suggestionsState = React.useMemo(() => {
    return getSuggestionsState(inputValue, indexableFields);
  }, [inputValue, indexableFields]);

  // Reset highlighted index when suggestions change
  useEffect(() => {
    setHighlightedIndex(0);
  }, [suggestionsState.suggestions]);

  const handleInputChange = (e) => {
    setInputValue(e.target.value);
    setShowSuggestions(true);
  };

  const handleClearInput = () => {
    setInputValue('');
    setShowSuggestions(false);
    onClearAllFilters?.();
  };

  const handleSelectSuggestion = (suggestion) => {
    if (!suggestionsState) return;
    const prefix = suggestionsState.prefix || '';

    if (suggestionsState.phase === 'field') {
      const newVal = `${prefix}${suggestion} `;
      setInputValue(newVal);
    } else if (suggestionsState.phase === 'operator') {
      const newVal = `${prefix}${suggestionsState.field} ${suggestion} `;
      setInputValue(newVal);
    }
    
    // Keep focus
    setTimeout(() => {
      const inputEl = document.getElementById('filter-autocomplete-input');
      if (inputEl) {
        inputEl.focus();
      }
    }, 0);
  };

  const handleApplyFilters = () => {
    const parts = inputValue.split(/\s+&&\s+/).map(p => p.trim()).filter(Boolean);
    if (parts.length === 0) {
      onClearAllFilters?.();
      setShowSuggestions(false);
      return;
    }
    
    const parsedFilters = [];
    const searchTerms = [];
    
    parts.forEach((part) => {
      const parsed = parseFilterInput(part, indexableFields);
      if (parsed) {
        parsedFilters.push({ ...parsed, id: Date.now() + Math.random() });
      } else {
        searchTerms.push(part);
      }
    });
    
    const combinedSearchQuery = searchTerms.join(' ');
    
    if (onSearchAndFiltersChange) {
      onSearchAndFiltersChange(combinedSearchQuery, parsedFilters);
    } else {
      onSearchChange?.(combinedSearchQuery);
      onSetFilters?.(parsedFilters);
    }
    setShowSuggestions(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && (!showSuggestions || !suggestionsState || suggestionsState.suggestions.length === 0)) {
      e.preventDefault();
      handleApplyFilters();
      return;
    }

    if (!showSuggestions || !suggestionsState) return;

    const suggestions = suggestionsState.suggestions;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (suggestions.length > 0) {
        setHighlightedIndex((prev) => (prev + 1) % suggestions.length);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (suggestions.length > 0) {
        setHighlightedIndex((prev) => (prev - 1 + suggestions.length) % suggestions.length);
      }
    } else if (e.key === 'Tab') {
      if (suggestions.length > 0 && highlightedIndex >= 0 && highlightedIndex < suggestions.length) {
        e.preventDefault();
        handleSelectSuggestion(suggestions[highlightedIndex]);
      }
    } else if (e.key === 'Enter') {
      if (suggestions.length > 0 && highlightedIndex >= 0 && highlightedIndex < suggestions.length) {
        e.preventDefault();
        handleSelectSuggestion(suggestions[highlightedIndex]);
      } else {
        e.preventDefault();
        handleApplyFilters();
      }
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  };

  const handleFormat = () => {
    try {
      const parsed = JSON.parse(rawQueryText.trim());
      onRawQueryTextChange(JSON.stringify(parsed, null, 2));
      setParsedParams(parsed);
      setParseError(null);
      window.toast?.success('Formatted JSON successfully');
    } catch {
      window.toast?.error('Cannot format: Invalid JSON structure');
    }
  };

  const handleClear = () => {
    onRawQueryTextChange('');
    setParsedParams({});
    setParseError(null);
    window.toast?.info('Raw query cleared');
  };

  const explanationParams = React.useMemo(() => {
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

    return {
      filter_by: filterStr,
    };
  }, [activeFilters]);

  return (
    <div className="flex flex-col bg-neutral px-6 py-2 border-b border-gray-200">
      {/* Top Filter Row - Always Visible */}
      <div className="flex items-center justify-between gap-4">
        {/* Left: Input Field - stretches to maximum width */}
        <div className="flex-1 relative" ref={suggestionsRef}>
          <div className="relative w-full">
            <input
              type="text"
              id="filter-autocomplete-input"
              value={inputValue}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              onFocus={() => setShowSuggestions(true)}
              disabled={queryMode === 'raw'}
              placeholder={queryMode === 'raw' ? "Filters parsed from Raw Query JSON" : "Search and filter documents (e.g. apple && status:active)"}
              className={`w-full border border-gray-300 rounded-md px-3 py-3 text-sm text-[#111b21] font-mono placeholder-gray-400 focus:ring-2 focus:ring-primary focus:border-transparent focus:outline-none ${
                queryMode === 'raw' ? 'bg-gray-100 opacity-70 cursor-not-allowed' : 'bg-gray-50 focus:bg-white'
              }`}
              autoComplete="off"
            />
            {inputValue && queryMode !== 'raw' && (
              <button
                type="button"
                onClick={handleClearInput}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 hover:bg-gray-200 rounded-full text-gray-400 hover:text-gray-600 transition-colors flex items-center justify-center"
                style={{ boxShadow: 'none', background: 'none', border: 'none', padding: 0, transform: 'translateY(-50%)' }}
              >
                <CloseIcon className="w-3.5 h-3.5" stroke="currentColor" strokeWidth="2" />
              </button>
            )}
          </div>

          {/* Suggestions Dropdown */}
          {showSuggestions && queryMode === 'builder' && suggestionsState && (suggestionsState.suggestions.length > 0 || suggestionsState.phase === 'value') && (
            <div
              id="filter-suggestions-card"
              className="absolute z-50 left-0 right-0 mt-1 bg-white border-2 border-[#111b21] rounded-md shadow-[0.2em_0.2em_#111b21] max-h-60 overflow-y-auto"
            >
              {suggestionsState.phase === 'field' && (
                <div>
                  <div className="px-3 py-1.5 bg-gray-50 text-[10px] font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100">
                    Fields
                  </div>
                  {suggestionsState.suggestions.map((item, idx) => {
                    const isHighlighted = idx === highlightedIndex;
                    const fieldType = item === 'id' ? 'string' : (indexableFields.find(f => f.name === item)?.type || 'string');
                    return (
                      <div
                        key={item}
                        onClick={() => handleSelectSuggestion(item)}
                        onMouseEnter={() => setHighlightedIndex(idx)}
                        className={`px-3 py-2 text-sm font-mono cursor-pointer flex items-center justify-between ${
                          isHighlighted ? 'bg-blue-50 text-blue-900 font-semibold' : 'text-[#111b21] hover:bg-gray-50'
                        }`}
                      >
                        <span>{item}</span>
                        <span className="text-xs text-gray-400 font-sans italic">{fieldType}</span>
                      </div>
                    );
                  })}
                </div>
              )}

              {suggestionsState.phase === 'operator' && (
                <div>
                  <div className="px-3 py-1.5 bg-gray-50 text-[10px] font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100">
                    Operators
                  </div>
                  {suggestionsState.suggestions.map((item, idx) => {
                    const isHighlighted = idx === highlightedIndex;
                    const opLabel = opDescMap[item] || (item === '=' ? 'equals' : item === '>' ? 'greater than' : item === '<' ? 'less than' : item);
                    return (
                      <div
                        key={item}
                        onClick={() => handleSelectSuggestion(item)}
                        onMouseEnter={() => setHighlightedIndex(idx)}
                        className={`px-3 py-2 text-sm font-mono cursor-pointer flex items-center justify-between ${
                          isHighlighted ? 'bg-blue-50 text-blue-900 font-semibold' : 'text-[#111b21] hover:bg-gray-50'
                        }`}
                      >
                        <span>{item}</span>
                        <span className="text-xs text-gray-400 font-sans italic">{opLabel}</span>
                      </div>
                    );
                  })}
                </div>
              )}

              {suggestionsState.phase === 'value' && (
                <div className="p-3 text-xs text-gray-500 font-sans">
                  <div className="font-semibold text-gray-700 mb-1">
                    Type value for <span className="font-mono text-blue-700 font-medium">{suggestionsState.field}</span> ({suggestionsState.fieldType})
                  </div>
                  <div className="text-[11px] text-gray-400">
                    Press <kbd className="bg-gray-100 border px-1 py-0.5 rounded font-mono">Enter</kbd> to apply filters.
                  </div>
                  <div className="mt-1.5 border-t pt-1.5 text-[10px] text-gray-400">
                    Examples: <code className="bg-gray-50 p-0.5 rounded font-mono">active</code>, <code className="bg-gray-50 p-0.5 rounded font-mono">100</code>, <code className="bg-gray-50 p-0.5 rounded font-mono">2026-04-07</code>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Actions: Info Icon, Toggle, Sort, Reset, Refresh */}
        <div className="flex items-center space-x-3 shrink-0">
          {/* Info Icon & Explanation Dropdown */}
          {activeFilters.length > 0 && (
            <div className="relative" ref={infoRef}>
              <button
                type="button"
                onClick={() => setShowInfoPopup(!showInfoPopup)}
                className="hover:bg-gray-100 rounded-md transition-colors flex items-center justify-center text-gray-500 hover:text-gray-700"
                style={{ boxShadow: 'none', background: 'none', border: 'none', padding: '6px', transform: 'none' }}
                title="Filter explanation"
              >
                <InfoIcon className="w-5 h-5" />
              </button>

              {showInfoPopup && (
                <div
                  id="filter-info-card"
                  className="absolute z-50 right-0 mt-1 w-80 bg-white border-2 border-[#111b21] rounded-md shadow-[0.2em_0.2em_#111b21] p-4 max-h-80 overflow-y-auto"
                >
                  <h4 className="text-sm font-semibold text-[#111b21] pb-2 border-b mb-3">
                    Applied Filters Explanation
                  </h4>
                  <SmartExplanation params={explanationParams} />
                </div>
              )}
            </div>
          )}

          {/* Mode Toggle */}
          <button
            type="button"
            onClick={() => onQueryModeChange?.(queryMode === 'builder' ? 'raw' : 'builder')}
            className={`rounded-md transition-colors flex items-center justify-center border-none ${
              queryMode === 'raw'
                ? 'bg-[#26d4654a] text-[#07a440]'
                : 'bg-white text-gray-500 hover:bg-gray-100'
            }`}
            style={{ boxShadow: 'none', padding: '10px', transform: 'none' }}
            title={queryMode === 'raw' ? "Switch to Builder Mode" : "Switch to Raw Query Mode"}
          >
            <CodeIcon
              className="w-[24px] h-[24px]"
              stroke={queryMode === 'raw' ? "#07a440" : "#4b5563"}
            />
          </button>

          {/* Table View Toggle */}
          <button
            type="button"
            onClick={() => onViewTypeChange?.(viewType === 'json' ? 'table' : 'json')}
            className={`rounded-md transition-colors flex items-center justify-center border-none ${
              viewType === 'table'
                ? 'bg-[#26d4654a] text-[#07a440]'
                : 'bg-white text-gray-500 hover:bg-gray-100'
            }`}
            style={{ boxShadow: 'none', padding: '10px', transform: 'none' }}
            title={viewType === 'table' ? "Switch to JSON View" : "Switch to Table View"}
          >
            <TableViewIcon
              className="w-[24px] h-[24px]"
              fill={viewType === 'table' ? "#07a440" : "#4b5563"}
            />
          </button>

          {/* Sort Selector */}
          {sortableFields.length > 0 && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setSortOpen((prev) => !prev)}
                className={`rounded-md transition-colors flex items-center justify-center border-none ${
                  sortBy
                    ? 'bg-[#26d4654a] text-[#07a440]'
                    : 'bg-white text-gray-500 hover:bg-gray-100'
                }`}
                style={{ boxShadow: 'none', padding: '10px', transform: 'none' }}
                title="Sort options"
              >
                <SortIcon
                  className="w-[24px] h-[24px]"
                  fill={sortBy ? "#07a440" : "#4b5563"}
                />
              </button>

              {sortOpen && (
                <>
                  {/* Overlay backdrop to close dropdown on click outside */}
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setSortOpen(false)}
                  />
                  {/* Dropdown Menu */}
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-corner border border-gray-200 shadow-lg p-2 z-20 flex flex-col gap-1">
                    <button
                      onClick={() => {
                        onSortByChange?.('');
                        setSortOpen(false);
                      }}
                      className={`w-full text-left px-3 py-1.5 text-xs rounded-md transition-colors ${
                        sortBy === ''
                          ? 'bg-[#26d4651f] text-[#07a440] font-medium'
                          : 'text-gray-700 hover:bg-gray-50'
                      }`}
                      style={{ border: 'none', background: sortBy === '' ? '#26d4651f' : 'none', boxShadow: 'none' }}
                    >
                      No sorting
                    </button>
                    {sortableFields.map((f) => {
                      const ascVal = `${f.name}:asc`;
                      const descVal = `${f.name}:desc`;
                      return (
                        <React.Fragment key={f.name}>
                          <button
                            onClick={() => {
                              onSortByChange?.(ascVal);
                              setSortOpen(false);
                            }}
                            className={`w-full text-left px-3 py-1.5 text-xs rounded-md transition-colors ${
                              sortBy === ascVal
                                ? 'bg-[#26d4651f] text-[#07a440] font-medium'
                                : 'text-gray-700 hover:bg-gray-50'
                            }`}
                            style={{ border: 'none', background: sortBy === ascVal ? '#26d4651f' : 'none', boxShadow: 'none' }}
                          >
                            {f.name} (A-Z)
                          </button>
                          <button
                            onClick={() => {
                              onSortByChange?.(descVal);
                              setSortOpen(false);
                            }}
                            className={`w-full text-left px-3 py-1.5 text-xs rounded-md transition-colors ${
                              sortBy === descVal
                                ? 'bg-[#26d4651f] text-[#07a440] font-medium'
                                : 'text-gray-700 hover:bg-gray-50'
                            }`}
                            style={{ border: 'none', background: sortBy === descVal ? '#26d4651f' : 'none', boxShadow: 'none' }}
                          >
                            {f.name} (Z-A)
                          </button>
                        </React.Fragment>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Beautify All Toggler */}
          <button
            type="button"
            disabled={viewType !== 'json'}
            onClick={onToggleBeautifyAll}
            className={`rounded-md transition-colors flex items-center justify-center border-none ${
              viewType !== 'json'
                ? ''
                : beautifyAll
                ? 'bg-[#26d4654a] text-[#07a440]'
                : 'bg-white text-gray-500 hover:bg-gray-100'
            }`}
            style={
              viewType !== 'json'
                ? {
                    backgroundColor: '#f9fafb',
                    color: '#d1d5db',
                    opacity: 0.5,
                    cursor: 'not-allowed',
                    boxShadow: 'none',
                    padding: '10px',
                    transform: 'none',
                  }
                : {
                    boxShadow: 'none',
                    padding: '10px',
                    transform: 'none',
                  }
            }
            title={viewType !== 'json' ? "Beautify All (Only for JSON View)" : beautifyAll ? "Compact All" : "Beautify All"}
          >
            <BeautifyIcon
              className={`w-[24px] h-[24px] json-beautify focus:outline-none transition-colors ${
                viewType !== 'json' ? 'disabled' : beautifyAll ? 'active' : ''
              }`}
            />
          </button>





          {/* Refresh Button */}
          <button
            id="refresh-btn"
            onClick={handleRefreshClick}
            className="p-1 hover:bg-gray-100 rounded-md transition-colors flex items-center justify-center"
            style={{ boxShadow: 'none', background: 'none', border: 'none', padding: '4px', transform: 'none' }}
            title="Refresh documents"
          >
            <RefreshIcon className={`w-6 h-6 ${isLoading || isSpinning ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Raw Query Mode UI */}
      {queryMode === 'raw' && (
        <div className="flex gap-6 min-h-0 items-stretch mt-2 border-t pt-4">
          {/* Left: Query Editor Card */}
          <div className="w-1/2 flex flex-col gap-3 bg-white p-4 rounded-corner border border-gray-200 shadow-sm">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-[#111b21]">Typesense Raw Query (SearchParameters)</h4>
              <div className="flex gap-2">
                <button
                  id="format-raw-query"
                  onClick={handleFormat}
                  className="text-xs px-2.5 py-1 bg-gray-100 hover:bg-gray-200 border border-gray-300"
                  style={{ fontSize: '11px', padding: '0.2em 0.5em', background: '#f3f4f6', boxShadow: 'none' }}
                >
                  Format
                </button>
                <button
                  id="clear-raw-query"
                  onClick={handleClear}
                  className="text-xs px-2.5 py-1 bg-white hover:bg-gray-100 border border-gray-300 text-gray-600"
                  style={{ fontSize: '11px', padding: '0.2em 0.5em', background: '#ffffff', color: '#4b5563', boxShadow: 'none' }}
                >
                  Clear
                </button>
              </div>
            </div>
            <textarea
              id="raw-query-input"
              value={rawQueryText}
              onChange={(e) => onRawQueryTextChange(e.target.value)}
              placeholder="Paste your SearchParameters JSON here..."
              className={`w-full h-44 font-mono text-sm p-3 border rounded-md focus:ring-2 focus:ring-primary focus:border-transparent text-[#111b21] bg-gray-50 resize-y focus:outline-none transition-colors ${
                parseError ? 'border-red-400 bg-red-50' : 'border-gray-300'
              }`}
            />
            {parseError && (
              <div className="p-2 bg-red-50 border border-red-200 text-red-700 rounded text-xs font-mono">
                <span className="font-semibold">Invalid JSON: </span>{parseError}
              </div>
            )}
            <div className="flex gap-3 justify-end items-center mt-1">
              <button
                id="execute-raw-query"
                onClick={onExecuteRawQuery}
                disabled={isLoading || !!parseError}
                style={isLoading || parseError ? { backgroundColor: '#9ca3af', color: '#e5e7eb', opacity: 0.7, cursor: 'not-allowed', boxShadow: 'none' } : {}}
                className="bg-success text-white font-semibold flex items-center gap-2 px-4 py-2 transition-colors text-sm"
              >
                {isLoading ? (
                  <RefreshIcon className="w-4 h-4 animate-spin" stroke="currentColor" />
                ) : (
                  <PlayIcon className="w-4 h-4 fill-current" />
                )}
                {isLoading ? 'Executing…' : 'Run Raw Query'}
              </button>
            </div>
          </div>

          {/* Right: Smart Decoder Card */}
          <div className="w-1/2 flex flex-col gap-3 bg-white p-4 rounded-corner border border-gray-200 shadow-sm overflow-y-auto max-h-[300px]">
            <h4 className="text-sm font-semibold text-[#111b21] flex items-center gap-2 sticky top-0 bg-white pb-2 border-b">
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-success" />
              </span>
              Smart Query Explanation
            </h4>
            <div id="smart-query-explanation" className="text-sm flex-1">
              {parseError ? (
                <div className="text-gray-400 italic">Fix JSON errors to see the explanation.</div>
              ) : rawQueryText.trim() ? (
                <SmartExplanation params={parsedParams} />
              ) : (
                <div className="text-gray-400 italic">Paste or edit your query parameters to see a smart explanation.</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
