import * as Typesense from 'typesense';

// Simple toast event emitter to allow typesense-api to show toasts
export const toastEvents = new EventTarget();
export const toast = {
  success: (msg) => toastEvents.dispatchEvent(new CustomEvent('toast', { detail: { type: 'success', message: msg } })),
  error: (msg) => toastEvents.dispatchEvent(new CustomEvent('toast', { detail: { type: 'error', message: msg } })),
  warning: (msg) => toastEvents.dispatchEvent(new CustomEvent('toast', { detail: { type: 'warning', message: msg } })),
  info: (msg) => toastEvents.dispatchEvent(new CustomEvent('toast', { detail: { type: 'info', message: msg } })),
};

function loadEnvConfigs() {
  const stored = localStorage.getItem('TYPESENSE_ENV_CONFIGS');
  if (stored) {
    try {
      return { ...JSON.parse(stored) };
    } catch (e) {
      console.error('Error loading env configs from localStorage:', e);
    }
  }
  return {
    LOCAL: { TS_NODES: [{ host: 'localhost', port: 8108, protocol: 'http' }], TS_SERVER_KEY: 'xyz' }
  };
}

let envConfigs = loadEnvConfigs();
let currentEnvName = localStorage.getItem('TYPESENSE_SELECTED_ENV') || 'PROD';
let activeEnv = envConfigs[currentEnvName] || envConfigs['PROD'];
const PAGE_LENGTH = 20;

let client;
function initClient() {
  if (!activeEnv || !activeEnv.TS_NODES || !activeEnv.TS_NODES[0]) {
    console.warn('Cannot initialize Typesense client: active environment configs are missing.');
    return;
  }
  
  // Format nodes as required by typesense package
  const nodes = activeEnv.TS_NODES.map(node => {
    let host = node.host || 'localhost';
    let path = node.path || '';
    
    // Auto-detect path suffix in host if any (e.g. mytypesense.com/server)
    if (host.includes('/')) {
      const firstSlashIdx = host.indexOf('/');
      path = host.substring(firstSlashIdx) + path;
      host = host.substring(0, firstSlashIdx);
      
      // Clean up trailing slash on path
      if (path.endsWith('/')) {
        path = path.slice(0, -1);
      }
    }

    const formatted = {
      host,
      protocol: node.protocol || 'http',
      path
    };
    if (node.port !== undefined && node.port !== null && node.port !== '') {
      formatted.port = parseInt(node.port);
    }
    return formatted;
  });

  client = new Typesense.Client({
    nodes,
    apiKey: activeEnv.TS_SERVER_KEY || 'xyz',
    connectionTimeoutSeconds: 5,
  });
}

// Initialize client
initClient();

const pendingRequests = new Map();

function dedupeRequest(key, fetchFn) {
  if (pendingRequests.has(key)) {
    return pendingRequests.get(key);
  }
  const promise = fetchFn().finally(() => {
    pendingRequests.delete(key);
  });
  pendingRequests.set(key, promise);
  return promise;
}

let initPromise = null;
async function loadDotEnv() {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    try {
      const response = await fetch('.env');
      if (!response.ok) return;
      const text = await response.text();
      const config = {};
      text.split('\n').forEach(line => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) return;
        const match = trimmed.match(/^([^=]+)=(.*)$/);
        if (match) {
          const key = match[1].trim();
          let val = match[2].trim();
          if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.slice(1, -1);
          }
          config[key] = val;
        }
      });

      const envKeys = ['LOCAL', 'UAT', 'PROD'];
      envKeys.forEach(env => {
        if (!envConfigs[env]) {
          envConfigs[env] = { TS_NODES: [{}] };
        }
        if (config[`${env}_TS_SERVER_KEY`]) {
          envConfigs[env].TS_SERVER_KEY = config[`${env}_TS_SERVER_KEY`];
        }
        if (config[`${env}_TS_HOST`]) {
          if (!envConfigs[env].TS_NODES) envConfigs[env].TS_NODES = [{}];
          envConfigs[env].TS_NODES[0].host = config[`${env}_TS_HOST`];
        }
        if (config[`${env}_TS_PORT`]) {
          if (!envConfigs[env].TS_NODES) envConfigs[env].TS_NODES = [{}];
          envConfigs[env].TS_NODES[0].port = config[`${env}_TS_PORT`];
        } else if (config[`${env}_TS_HOST`]) {
          if (envConfigs[env].TS_NODES && envConfigs[env].TS_NODES[0]) {
            delete envConfigs[env].TS_NODES[0].port;
          }
        }
        if (config[`${env}_TS_PROTOCOL`]) {
          if (!envConfigs[env].TS_NODES) envConfigs[env].TS_NODES = [{}];
          envConfigs[env].TS_NODES[0].protocol = config[`${env}_TS_PROTOCOL`];
        }
      });
      
      activeEnv = envConfigs[currentEnvName] || envConfigs['PROD'];
      initClient();
    } catch (e) {
      console.warn('Could not load .env file:', e);
    }
  })();
  return initPromise;
}

function setEnvironment(envName) {
  if (!envConfigs[envName]) return false;
  currentEnvName = envName;
  localStorage.setItem('TYPESENSE_SELECTED_ENV', envName);
  activeEnv = envConfigs[envName];
  pendingRequests.clear();
  initClient();
  return true;
}

function saveEnvConfigs(newConfigs) {
  envConfigs = { ...newConfigs };
  localStorage.setItem('TYPESENSE_ENV_CONFIGS', JSON.stringify(envConfigs));
  activeEnv = envConfigs[currentEnvName] || envConfigs['PROD'];
  pendingRequests.clear();
  initClient();
}

async function getColls() {
  if (!client) return [];
  const key = 'getColls';
  return dedupeRequest(key, () => client.collections().retrieve());
}

async function getQuery(queryData) {
  if (!client) return null;
  const { collName, ...searchParams } = queryData;
  const key = `getQuery:${collName}:${JSON.stringify(searchParams)}`;
  return dedupeRequest(key, () =>
    client
      .collections(collName)
      .documents()
      .search(searchParams)
      .catch((err) => {
        console.error(err);
        toast.error(err.message || 'Failed to search documents');
        throw err;
      })
  );
}

async function setDoc(queryData) {
  if (!client) return null;
  return client
    .collections(queryData.collName)
    .documents()
    .create(queryData.data)
    .catch((err) => {
      console.error(err);
      toast.error(err.message || 'Failed to create document');
      throw err;
    });
}

async function deleteDoc(queryData) {
  if (!client) return null;
  return client
    .collections(queryData.collName)
    .documents(queryData.which)
    .delete()
    .catch((err) => {
      console.error(err);
      toast.error(err.message || 'Failed to delete document');
      throw err;
    });
}

async function updateDoc(data) {
  if (!client) return null;
  return client
    .collections(data.collName)
    .documents(data.which)
    .update(data.data)
    .catch((err) => {
      console.error(err);
      toast.error(err.message || 'Failed to update document');
      throw err;
    });
}

async function searchDocuments(collectionName, searchParams = {}) {
  const queryData = {
    q: searchParams.q || '*',
    query_by: searchParams.query_by || '',
    filter_by: searchParams.filter_by || '',
    sort_by: searchParams.sort_by || '',
    per_page: searchParams.per_page || PAGE_LENGTH,
    page: searchParams.page || 1,
    collName: collectionName
  };

  return getQuery(queryData);
}

async function searchRaw(collectionName, searchParams = {}) {
  const queryData = {
    ...searchParams,
    collName: collectionName
  };
  return getQuery(queryData);
}

async function getCollectionSchema(collectionName) {
  if (!client) return null;
  const key = `getCollectionSchema:${collectionName}`;
  return dedupeRequest(key, async () => {
    try {
      return await client.collections(collectionName).retrieve();
    } catch (err) {
      console.error('Error fetching collection schema:', err);
      toast.error(err.message || 'Failed to fetch collection schema');
      throw err;
    }
  });
}

export const TypesenseAPI = {
  init: loadDotEnv,
  getColls: getColls,
  setDoc: setDoc,
  deleteDoc: deleteDoc,
  updateDoc: updateDoc,
  searchRaw: searchRaw,
  searchDocuments: searchDocuments,
  getCollectionSchema: getCollectionSchema,
  setEnvironment: setEnvironment,
  saveEnvConfigs: saveEnvConfigs,
  getCurrentEnvName: () => currentEnvName,
  getActiveEnv: () => activeEnv,
  getEnvConfigs: () => envConfigs
};
