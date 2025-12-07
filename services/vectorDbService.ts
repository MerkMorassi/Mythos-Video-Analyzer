export interface VectorRecord {
  id: number;
  text: string;
  vector: number[];
  source: string;
  timestamp: number;
}

export interface ChatLogRecord {
    id: string;
    role: 'user' | 'model';
    parts: {
      text?: string;
      inlineData?: {
        mimeType: string;
        data: string;
        fileName?: string;
      };
    }[];
}

const DB_NAME = 'mythos_vault';
const DB_VERSION = 2; // Incremented version for new object store
const STORE_VECTORS = 'vectors';
const STORE_AGENT_CHAT = 'agentChatLogs';

class VectorDbService {
  private db: IDBDatabase | null = null;

  async open(): Promise<IDBDatabase> {
    if (this.db) return this.db;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (e) => {
        const db = (e.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_VECTORS)) {
          db.createObjectStore(STORE_VECTORS, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORE_AGENT_CHAT)) {
          db.createObjectStore(STORE_AGENT_CHAT, { keyPath: 'id' });
        }
      };

      request.onsuccess = (e) => {
        this.db = (e.target as IDBOpenDBRequest).result;
        resolve(this.db);
      };

      request.onerror = (e) => {
        reject((e.target as IDBOpenDBRequest).error);
      };
    });
  }

  // --- Vector Store Methods ---

  async addVectors(vectors: VectorRecord[]): Promise<void> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_VECTORS, 'readwrite');
      const store = tx.objectStore(STORE_VECTORS);
      vectors.forEach(v => store.put(v));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async getAllVectors(): Promise<VectorRecord[]> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_VECTORS, 'readonly');
      const store = tx.objectStore(STORE_VECTORS);
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async clearVectors(): Promise<void> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_VECTORS, 'readwrite');
      const store = tx.objectStore(STORE_VECTORS);
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
  
  async getVectorCount(): Promise<number> {
      const db = await this.open();
      return new Promise((resolve, reject) => {
          const tx = db.transaction(STORE_VECTORS, 'readonly');
          const store = tx.objectStore(STORE_VECTORS);
          const request = store.count();
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
      });
  }

  // --- Agent Chat Log Methods ---

  async saveAgentChatLogs(logs: ChatLogRecord[]): Promise<void> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_AGENT_CHAT, 'readwrite');
      const store = tx.objectStore(STORE_AGENT_CHAT);
      // Clear old logs and save new ones to keep it simple.
      // For very large logs, a more granular approach might be better.
      store.clear(); 
      logs.forEach(log => store.put(log));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async getAgentChatLogs(): Promise<ChatLogRecord[]> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_AGENT_CHAT, 'readonly');
      const store = tx.objectStore(STORE_AGENT_CHAT);
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async clearAgentChatLogs(): Promise<void> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_AGENT_CHAT, 'readwrite');
      const store = tx.objectStore(STORE_AGENT_CHAT);
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
}

export const vectorDb = new VectorDbService();