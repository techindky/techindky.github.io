import React from 'react';
import { CloseIcon, CopyIcon } from './Icons';
import { JSONPretty } from './DocumentList';

export default function DocumentModal({ document: doc, onClose }) {
  if (!doc) return null;

  const docId = doc.id || doc._id || 'N/A';
  const createdAt = doc.created_at || doc.timestamp || 'N/A';
  const sizeBytes = JSON.stringify(doc).length;

  return (
    <div
      id="document-modal"
      className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target.id === 'document-modal') onClose();
      }}
    >
      <div className="bg-neutral rounded-corner max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 flex-shrink-0">
          <h3 className="text-lg font-medium text-[#111b21]">Document Details</h3>
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
              <CopyIcon className="w-5 h-5" stroke="#4b5563" strokeBg="#9ca3af" />
            </button>
            <button
              id="close-modal"
              onClick={onClose}
              className="cursor-pointer"
              style={{ boxShadow: 'none', background: 'none', border: 'none', padding: '4px', transform: 'none' }}
            >
              <CloseIcon className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto max-h-96">
          <div
            id="modal-content"
            className="json-tree text-sm"
          >
            <JSONPretty val={doc} />
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-6 border-t border-gray-200 bg-gray-50 flex-shrink-0">
          <div className="text-xs text-[#111b21]">
            <div>Document ID: <span id="modal-doc-id">{docId}</span></div>
            <div>Created: <span id="modal-created">{createdAt}</span></div>
            <div>Size: <span id="modal-size">{sizeBytes} bytes</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}
