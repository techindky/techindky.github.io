import React, { useState, useEffect } from 'react';
import { DocumentIcon, BeautifyIcon, CopyIcon } from './Icons';

// Recursive React component for pretty JSON syntax highlighting
export const JSONPretty = ({ val, indent = 0 }) => {
  const spaces = '  '.repeat(indent);
  if (val === null) {
    return <span className="json-null">null</span>;
  }
  if (val === undefined) {
    return <span className="json-undefined">undefined</span>;
  }
  if (typeof val === 'string') {
    return <span className="json-string">"{val}"</span>;
  }
  if (typeof val === 'number') {
    return <span className="json-number">{val}</span>;
  }
  if (typeof val === 'boolean') {
    return <span className="json-boolean">{val.toString()}</span>;
  }
  if (Array.isArray(val)) {
    if (val.length === 0) return <span>[]</span>;
    return (
      <span>
        {"[\n"}
        {val.map((item, idx) => (
          <React.Fragment key={idx}>
            {spaces}  <JSONPretty val={item} indent={indent + 1} />
            {idx < val.length - 1 ? ',' : ''}
            {"\n"}
          </React.Fragment>
        ))}
        {spaces}{"]"}
      </span>
    );
  }
  if (typeof val === 'object') {
    const keys = Object.keys(val);
    if (keys.length === 0) return <span>{"{}"}</span>;
    return (
      <span>
        {"{\n"}
        {keys.map((key, idx) => (
          <React.Fragment key={key}>
            {spaces}  <span className="json-key">"{key}"</span>: <JSONPretty val={val[key]} indent={indent + 1} />
            {idx < keys.length - 1 ? ',' : ''}
            {"\n"}
          </React.Fragment>
        ))}
        {spaces}{"}"}
      </span>
    );
  }
  return <span>{String(val)}</span>;
};

export default function DocumentList({
  documents = [],
  viewType = 'json',
  beautifyAll = false,
  onOpenDocumentModal,
  foundCount = 0,
  perPage = 20,
  currentPage = 1,
  onPageChange,
  sortBy = ''
}) {
  // Track overridden beautified state for individual documents
  const [individualCompact, setIndividualCompact] = useState({});

  // Reset overrides when beautifyAll or active documents change
  useEffect(() => {
    setIndividualCompact({});
  }, [beautifyAll, documents]);

  // Get first 6 keys across all documents to use as table headers
  const getDocumentFields = () => {
    const allFields = new Set();
    documents.forEach((doc) => {
      Object.keys(doc).forEach((key) => allFields.add(key));
    });
    return Array.from(allFields).slice(0, 6);
  };

  const fields = getDocumentFields();
  const totalPages = Math.ceil(foundCount / perPage) || 1;
  const startItem = (currentPage - 1) * perPage + 1;
  const endItem = Math.min(currentPage * perPage, foundCount);

  // Render pagination controls
  const renderPageButtons = () => {
    const buttons = [];
    const maxButtons = 5;
    let startPage = Math.max(1, currentPage - 2);
    let endPage = Math.min(totalPages, startPage + maxButtons - 1);
    
    if (endPage - startPage < maxButtons - 1) {
      startPage = Math.max(1, endPage - maxButtons + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
      const isCurrent = i === currentPage;
      buttons.push(
        <button
          key={i}
          onClick={() => onPageChange(i)}
          style={isCurrent ? {} : { backgroundColor: 'white', color: 'grey' }}
        >
          {i}
        </button>
      );
    }
    return buttons;
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-gray-50 overflow-hidden">
      {documents.length === 0 ? (
        <div className="flex-1 flex items-center justify-center p-8 bg-gray-50 overflow-y-auto">
          <div className="text-center text-gray-500 max-w-sm">
            <DocumentIcon className="w-16 h-16 mx-auto text-gray-300 mb-3" />
            <p className="text-lg font-medium text-gray-700">No documents found</p>
            <p className="text-sm text-gray-400 mt-1">Try refining your search query or removing active filters.</p>
          </div>
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-auto">
          {viewType === 'json' ? (
            /* JSON VIEW */
            <div className="p-6 space-y-4">
              {documents.map((doc, index) => {
                const docId = doc.id || doc._id || index;
                
                // Local compact overrides: compact defaults to true if not beautifyAll. 
                // Toggling it flips it.
                const isCompact = individualCompact[index] !== undefined
                  ? individualCompact[index]
                  : !beautifyAll;

                const toggleCompact = () => {
                  setIndividualCompact((prev) => ({
                    ...prev,
                    [index]: !isCompact
                  }));
                };

                return (
                  <div key={docId} className="bg-neutral rounded-corner border border-gray-200">
                    <div className="flex items-center justify-between px-2 border-b">
                      <span className="text-sm font-medium text-gray-600">
                        <span className="italic">#</span> {docId}
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          title="Copy document JSON"
                          onClick={() => {
                            navigator.clipboard.writeText(JSON.stringify(doc, null, 2));
                            window.toast?.success('Copied document JSON to clipboard');
                          }}
                          className="p-1 hover:bg-gray-100 rounded-md transition-colors flex items-center justify-center text-gray-500 hover:text-gray-700"
                          style={{ border: 'none', background: 'none', boxShadow: 'none', transform: 'none' }}
                        >
                          <CopyIcon className="w-4 h-4" stroke="#4b5563" strokeBg="#9ca3af" />
                        </button>
                        <BeautifyIcon
                          onClick={toggleCompact}
                          className={`w-[18px] h-[18px] json-beautify focus:outline-none transition-colors ${!isCompact ? 'active' : ''}`}
                        />
                      </div>
                    </div>
                    <div className="json-content">
                      <div className="text-sm font-mono p-2 bg-gray-50 rounded-b-corner">
                        <pre className={`json-pretty ${isCompact ? 'whitespace-normal' : ''}`}>
                          <JSONPretty val={doc} />
                        </pre>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* TABLE VIEW */
            <div className="p-6 h-full flex flex-col min-h-0">
              <div className="flex-1 min-h-0 border border-gray-200 rounded-corner overflow-auto bg-white shadow-sm">
                <table className="min-w-full divide-y divide-gray-200 table-fixed">
                  <thead className="bg-gray-50 sticky top-0 z-10">
                    <tr>
                      {fields.map((field) => (
                        <th
                          key={field}
                          scope="col"
                          className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider overflow-hidden truncate"
                          style={{ width: `${100 / fields.length}%` }}
                        >
                          {field}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody id="table-body" className="bg-white divide-y divide-gray-200">
                    {documents.map((doc, idx) => (
                      <tr
                        key={doc.id || doc._id || idx}
                        onClick={() => onOpenDocumentModal(doc)}
                        className="hover:bg-[#25d56411] cursor-pointer transition-colors"
                      >
                        {fields.map((field) => {
                          const value = doc[field];
                          let cellText = '';
                          if (value === null) {
                            cellText = 'null';
                          } else if (value === undefined) {
                            cellText = '';
                          } else if (typeof value === 'object') {
                            cellText = JSON.stringify(value);
                          } else {
                            cellText = String(value);
                          }

                          return (
                            <td
                              key={field}
                              className="px-6 py-4 whitespace-nowrap text-sm text-neutral-foreground truncate"
                            >
                              {cellText}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Pagination Footer */}
      {documents.length > 0 && (
        <div className="bg-neutral border-t border-gray-200 px-6 py-2 flex flex-col md:flex-row gap-4 md:gap-0 items-center justify-between flex-shrink-0">
          <div id="current-page" className="text-sm font-medium text-gray-500 flex flex-col sm:flex-row items-center gap-2 text-center sm:text-left">
              <span>Showing {startItem} to {endItem} of {foundCount.toLocaleString()} results</span>
              {sortBy && (
                <span className="px-2 py-0.5 bg-gray-100 border border-gray-200 rounded-md text-xs text-gray-600 inline-flex items-center gap-1">
                  Sorted by <span className="font-semibold text-gray-700">{sortBy.split(':')[0]}</span> ({sortBy.split(':')[1] === 'asc' ? 'Ascending' : 'Descending'})
                </span>
              )}
            </div>
          <div className="flex items-center space-x-2">
            <button
              disabled={currentPage === 1}
              onClick={() => onPageChange(currentPage - 1)}
              style={currentPage === 1 ? { backgroundColor: 'white', color: 'grey', opacity: 0.5, cursor: 'not-allowed' } : {}}
            >
              Previous
            </button>
            {renderPageButtons()}
            <button
              disabled={currentPage === totalPages}
              onClick={() => onPageChange(currentPage + 1)}
              style={currentPage === totalPages ? { backgroundColor: 'white', color: 'grey', opacity: 0.5, cursor: 'not-allowed' } : {}}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
