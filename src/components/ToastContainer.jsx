import React, { useState, useEffect, useCallback, useRef } from 'react';
import { toastEvents } from '../typesense-api';
import { SuccessToastIcon, ErrorToastIcon, WarningToastIcon, InfoToastIcon, SpinnerToastIcon, ToastCloseIcon, HistoryIcon } from './Icons';

const getTypeConfig = (type) => {
  const configs = {
    success: {
      title: 'Success',
      bg: 'bg-green-50',
      icon: <SuccessToastIcon className="h-6 w-6 text-green-500" />,
      progressColor: 'bg-green-500'
    },
    error: {
      title: 'Error',
      bg: 'bg-red-50',
      icon: <ErrorToastIcon className="h-6 w-6 text-red-500" />,
      progressColor: 'bg-red-500'
    },
    warning: {
      title: 'Warning',
      bg: 'bg-yellow-50',
      icon: <WarningToastIcon className="h-6 w-6 text-yellow-500" />,
      progressColor: 'bg-yellow-500'
    },
    info: {
      title: 'Info',
      bg: 'bg-blue-50',
      icon: <InfoToastIcon className="h-6 w-6 text-blue-500" />,
      progressColor: 'bg-blue-500'
    },
    loading: {
      title: 'Loading',
      bg: 'bg-gray-50',
      icon: <SpinnerToastIcon className="animate-spin h-6 w-6 text-gray-400" />,
      progressColor: 'bg-gray-500'
    }
  };
  return configs[type] || configs.info;
};

export default function ToastContainer() {
  const [toasts, setToasts] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const activeTimeoutRef = useRef(null);

  const dismissAll = useCallback(() => {
    setToasts((prevToasts) => prevToasts.map((t) => ({ ...t, exiting: true })));
    setShowHistory(false);
    setTimeout(() => {
      setToasts([]);
    }, 300);
  }, []);

  const dismissIndividual = useCallback((id) => {
    setToasts((prevToasts) => {
      const activeToast = prevToasts[prevToasts.length - 1];
      if (activeToast && activeToast.id === id) {
        dismissAll();
        return prevToasts;
      }
      return prevToasts.filter((t) => t.id !== id);
    });
  }, [dismissAll]);

  const toggleHistory = useCallback(() => {
    setShowHistory((prev) => {
      const nextShow = !prev;
      if (nextShow) {
        if (activeTimeoutRef.current) {
          clearTimeout(activeTimeoutRef.current);
          activeTimeoutRef.current = null;
        }
      } else {
        const active = toasts[toasts.length - 1];
        if (active && active.duration > 0) {
          activeTimeoutRef.current = setTimeout(() => {
            dismissAll();
          }, active.duration);
        }
      }
      return nextShow;
    });
  }, [toasts, dismissAll]);

  const addToast = useCallback((message, type = 'info', duration = 5000) => {
    if (activeTimeoutRef.current) {
      clearTimeout(activeTimeoutRef.current);
      activeTimeoutRef.current = null;
    }

    const id = Date.now() + Math.random().toString();
    setToasts((prev) => [...prev, { id, message, type, duration, exiting: false }]);

    if (duration > 0 && !showHistory) {
      activeTimeoutRef.current = setTimeout(() => {
        dismissAll();
      }, duration);
    }
    return id;
  }, [dismissAll, showHistory]);

  useEffect(() => {
    if (toasts.length === 0) {
      setShowHistory(false);
    }
  }, [toasts.length]);

  useEffect(() => {
    // Bind to window.toast for global backwards compatibility
    window.toast = {
      show: (msg, type, duration) => addToast(msg, type, duration),
      success: (msg, duration = 4000) => addToast(msg, 'success', duration),
      error: (msg, duration = 10000) => addToast(msg, 'error', duration),
      warning: (msg, duration = 5000) => addToast(msg, 'warning', duration),
      info: (msg, duration = 4000) => addToast(msg, 'info', duration),
      loading: (msg, duration = 0) => addToast(msg, 'loading', duration),
      dismiss: (id) => dismissIndividual(id),
      dismissAll: () => dismissAll()
    };

    const handleToastEvent = (e) => {
      const { type, message } = e.detail;
      let duration = 5000;
      if (type === 'success' || type === 'info') duration = 4000;
      if (type === 'error') duration = 10000;
      if (type === 'loading') duration = 0;
      addToast(message, type, duration);
    };

    toastEvents.addEventListener('toast', handleToastEvent);
    return () => {
      toastEvents.removeEventListener('toast', handleToastEvent);
    };
  }, [addToast, dismissIndividual, dismissAll]);

  const activeToast = toasts[toasts.length - 1];
  const historyToasts = toasts.slice(0, toasts.length - 1);
  const hasHistory = historyToasts.length > 0;

  const getHistoryStatusColor = () => {
    const types = historyToasts.map((t) => t.type);
    if (types.includes('error')) {
      return {
        bg: showHistory ? 'bg-red-200 border-red-300' : 'bg-red-100 hover:bg-red-200 border-red-200',
        text: 'text-red-700'
      };
    }
    if (types.includes('warning')) {
      return {
        bg: showHistory ? 'bg-yellow-200 border-yellow-300' : 'bg-yellow-100 hover:bg-yellow-200 border-yellow-200',
        text: 'text-yellow-700'
      };
    }
    if (types.includes('info')) {
      return {
        bg: showHistory ? 'bg-blue-200 border-blue-300' : 'bg-blue-100 hover:bg-blue-200 border-blue-200',
        text: 'text-blue-700'
      };
    }
    if (types.includes('success')) {
      return {
        bg: showHistory ? 'bg-green-200 border-green-300' : 'bg-green-100 hover:bg-green-200 border-green-200',
        text: 'text-green-700'
      };
    }
    return {
      bg: showHistory ? 'bg-gray-300 border-gray-400' : 'bg-gray-100 hover:bg-gray-200 border-gray-200',
      text: 'text-gray-600'
    };
  };

  const statusStyle = getHistoryStatusColor();

  const activeConfig = activeToast ? getTypeConfig(activeToast.type) : null;
  const activeAnimationClass = activeToast ? (activeToast.exiting ? 'toast-exit' : 'toast-enter') : '';

  return (
    <div id="toast-container" className="toast-container fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex flex-col space-y-2 pointer-events-none w-full max-w-md px-4">
      {/* If showHistory is true, render all history toasts vertically */}
      {showHistory && hasHistory && historyToasts.map((toast) => {
        const config = getTypeConfig(toast.type);
        const animationClass = toast.exiting ? 'toast-exit' : 'toast-enter';
        
        return (
          <div key={toast.id} className="w-full flex items-center gap-3 pointer-events-auto">
            {/* History Toast Card */}
            <div
              className={`${config.bg} ${animationClass} toast flex-1 bg-[#FFFFFF00] shadow-lg rounded-full ring-1 ring-black ring-opacity-5 overflow-hidden transform transition-all`}
            >
              <div className="py-3 px-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0 flex items-center">{config.icon}</div>
                  <div className="ml-3 min-w-0 flex-1">
                    <p className="text-sm font-semibold text-gray-900 leading-tight">{config.title}</p>
                    <p className="text-xs text-gray-500 break-words leading-snug">{toast.message}</p>
                  </div>
                </div>
              </div>
            </div>
            {/* Invisible spacer to exactly mirror the active row's divider + circular button width */}
            <div className="flex items-center gap-3 flex-shrink-0 invisible select-none" aria-hidden="true">
              <span className="text-xl font-semibold">/</span>
              <div className="w-14 h-14" />
            </div>
          </div>
        );
      })}

      {/* Active Toast Row */}
      {activeToast && (
        <div className="w-full flex items-center gap-3 pointer-events-auto">
          {/* Active Toast */}
          <div
            key={activeToast.id}
            className={`${activeConfig.bg} ${activeAnimationClass} toast flex-1 bg-[#FFFFFF00] shadow-lg rounded-full ring-1 ring-black ring-opacity-5 overflow-hidden transform transition-all`}
          >
            <div className="py-3 px-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center min-w-0 flex-1">
                  <div className="flex-shrink-0 flex items-center">{activeConfig.icon}</div>
                  <div className="ml-3 min-w-0 flex-1">
                    <p className="text-sm font-semibold text-gray-900 leading-tight">{activeConfig.title}</p>
                    <p className="text-xs text-gray-500 break-words leading-snug">{activeToast.message}</p>
                  </div>
                </div>
                <div className="ml-4 flex-shrink-0 flex items-center">
                  <button
                    onClick={dismissAll}
                    className="toast-close inline-flex p-1 cursor-pointer text-gray-400 hover:text-gray-600 hover:bg-black/5 rounded-full"
                    style={{ boxShadow: 'none', background: 'none', border: 'none', transform: 'none' }}
                  >
                    <span className="sr-only">Close</span>
                    <ToastCloseIcon className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </div>
            {activeToast.duration > 0 && (
              <div className="h-1 bg-black bg-opacity-5">
                <div
                  key={`progress-${activeToast.id}-${showHistory}`}
                  className={`toast-progress h-full ${activeConfig.progressColor}`}
                  style={{ 
                    '--duration': `${activeToast.duration}ms`,
                    animationPlayState: showHistory ? 'paused' : 'running'
                  }}
                />
              </div>
            )}
          </div>

          {/* Divider and Circular History Button */}
          {hasHistory && (
            <div className="flex items-center gap-3 flex-shrink-0">
              <span className="text-gray-300 text-xl select-none">/</span>
              <button
                onClick={toggleHistory}
                className={`w-14 h-14 rounded-full flex items-center justify-center relative cursor-pointer transition-all border shadow-sm ${statusStyle.bg} ${statusStyle.text}`}
                style={{ boxShadow: 'none', transform: 'none' }}
                title="View notification history"
              >
                <HistoryIcon className="w-7 h-7" />
                <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white ring-2 ring-white">
                  {historyToasts.length}
                </span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
