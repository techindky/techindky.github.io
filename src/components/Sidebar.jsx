import React, { useState } from 'react';
import { FolderIcon, RefreshIcon } from './Icons';

export default function Sidebar({
  collections = [],
  currentCollection,
  onSelectCollection,
  sidebarOpen = false,
  onCloseSidebar,
  onRefreshCollections,
  isLoadingCollections = false
}) {
  const [isSpinning, setIsSpinning] = useState(false);

  const handleRefreshClick = () => {
    setIsSpinning(true);
    onRefreshCollections?.();
    setTimeout(() => {
      setIsSpinning(false);
    }, 1000);
  };

  return (
    <>
      {/* Sidebar Overlay for Mobile */}
      {sidebarOpen && (
        <div
          onClick={onCloseSidebar}
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden transition-opacity duration-300"
        />
      )}

      {/* Sidebar Container */}
      <aside
        id="sidebar"
        className={`fixed inset-y-0 left-0 w-64 bg-neutral border-r border-gray-200 flex flex-col z-40 transform transition-transform duration-300 ease-in-out lg:static lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Logo/Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex flex-col gap-3">
          <img src="logo.png" />
        </div>

        {/* Collections List */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-medium text-[#111b21] tracking-wide">Collections</h2>
            <button
              id="refresh-collections-btn"
              onClick={handleRefreshClick}
              className="p-1 hover:bg-gray-100 rounded-md transition-colors flex items-center justify-center"
              style={{ boxShadow: 'none', background: 'none', border: 'none', padding: '4px', transform: 'none' }}
              title="Refresh collection list"
            >
              <RefreshIcon className={`w-4 h-4 ${isLoadingCollections || isSpinning ? 'animate-spin' : ''}`} />
            </button>
          </div>
          <nav className="space-y-1">
            {collections.length === 0 ? (
              <div className="text-xs text-gray-400 p-2 italic">No collections found</div>
            ) : (
              collections.map((collection) => {
                const isActive = currentCollection === collection.name;
                return (
                  <a
                    key={collection.name}
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      onSelectCollection(collection.name);
                      onCloseSidebar(); // Close sidebar on mobile
                    }}
                    className={`collection-item flex items-center px-3 py-2 text-sm font-medium text-neutral-foreground rounded-md hover:bg-[#25d56417] transition-colors ${
                      isActive ? 'active' : ''
                    }`}
                  >
                    <FolderIcon className="w-4 h-4 mr-1.5 flex-shrink-0" active={isActive} />
                    {collection.name}
                    <span className="ml-auto text-xs text-gray-400">
                      {collection.num_documents.toLocaleString()}
                    </span>
                  </a>
                );
              })
            )}
          </nav>
        </div>

      </aside>
    </>
  );
}
