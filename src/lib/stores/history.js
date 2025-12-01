import { writable, get } from 'svelte/store';

const MAX_HISTORY_ENTRIES = 25;
const STORAGE_KEY = 'equationHistory';

function createHistoryStore() {
  // Load initial state from localStorage
  let initialHistory = [];
  if (typeof window !== 'undefined') {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        initialHistory = JSON.parse(saved);
      }
    } catch (e) {
      console.error('Failed to load history from localStorage:', e);
    }
  }

  const { subscribe, set, update } = writable(initialHistory);

  function saveToStorage(history) {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
      } catch (e) {
        console.error('Failed to save history to localStorage:', e);
      }
    }
  }

  return {
    subscribe,

    add(latex) {
      if (!latex || !latex.trim()) return;

      update(history => {
        // Avoid duplicate consecutive entries
        if (history.length > 0 && history[0].latex === latex) {
          return history;
        }

        const newEntry = {
          latex,
          timestamp: Date.now()
        };

        const newHistory = [newEntry, ...history].slice(0, MAX_HISTORY_ENTRIES);
        saveToStorage(newHistory);
        return newHistory;
      });
    },

    remove(index) {
      update(history => {
        const newHistory = history.filter((_, i) => i !== index);
        saveToStorage(newHistory);
        return newHistory;
      });
    },

    clear() {
      set([]);
      saveToStorage([]);
    }
  };
}

export const history = createHistoryStore();
