/* =========================================================
   core.js — Shared utilities for Email Templates app
   - localStorage CRUD (folders + templates)
   - simple templating with {{placeholders}} (+ optional |longdate / |shortdate)
   - copy-to-clipboard helper
   - first-run sample template seeding
   - lightweight API exposed at window.ETCore
   ========================================================= */

(() => {
  const STORAGE_KEY = 'emailTemplates.v1';

  // Canonical placeholder keys used by inputs across pages
  const PLACEHOLDER_KEYS = [
    'first_name',
    'spoke_to',
    'company_name',
    'competitor',
    'date_1',
    'date_2'
  ];

  // -------------------------------
  // Helpers
  // -------------------------------
  const uid = () =>
    'id_' + Math.random().toString(36).slice(2, 9) + Date.now().toString(36);

  const nowISO = () => new Date().toISOString();

  function safeParse(json, fallback) {
    try { return JSON.parse(json); }
    catch { return fallback; }
  }

  function getStore() {
    const raw = localStorage.getItem(STORAGE_KEY);
    const store = safeParse(raw, null);
    if (!store) {
      const initial = { version: 1, folders: [], templates: [], settings: {} };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
      return initial;
    }
    // Minimal migration example (reserved for future versions)
    if (!store.version) store.version = 1;
    if (!store.folders) store.folders = [];
    if (!store.templates) store.templates = [];
    if (!store.settings) store.settings = {};
    return store;
  }

  function saveStore(next) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    return next;
  }

    // Seed a friendly sample template ONLY on first install.
// After that, never re-add it (even if the user deletes all templates).
function ensureSampleTemplate() {
  const store = getStore();

  if (store.settings.sampleSeeded === true) return;

  if (store.templates.length === 0) {
    const sample = {
      id: uid(),
      name: 'Sample — Quick Follow-up',
      subject: 'Quick follow-up with {{company_name}}', // NEW
      // Supported placeholders: {{first_name}}, {{spoke_to}}, {{company_name}}, {{competitor}}, {{date_1}}, {{date_2}}
      // Optional filters: |longdate, |shortdate  e.g., {{date_1|longdate}}
      content:
`Hi {{first_name}},

Nice speaking with {{spoke_to}} at {{company_name}}.

As mentioned, compared to {{competitor}}, we can streamline your process and reduce admin. 
Are you free on {{date_1|longdate}} or {{date_2|shortdate}} to chat?

Thanks,
— Your Name`,
      folderId: null,
      createdAt: nowISO(),
      updatedAt: nowISO()
    };
    store.templates.push(sample);
  }

  store.settings.sampleSeeded = true;
  saveStore(store);
}


  // Date formatting
  function formatDate(input, style = 'long') {
    // Accept "YYYY-MM-DD" (from <input type="date">) or any Date-parsable string.
    if (!input) return '';
    const hasDash = /^\d{4}-\d{2}-\d{2}$/.test(input);
    const d = hasDash ? new Date(input + 'T12:00:00') : new Date(input);
    if (Number.isNaN(d.getTime())) return input;

    const formatters = {
      long: new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'long', day: 'numeric' }),
      short: new Intl.DateTimeFormat(undefined, { year: '2-digit', month: 'short', day: 'numeric' })
    };
    return style === 'short' ? formatters.short.format(d) : formatters.long.format(d);
  }

  // Core render — replace {{token}} with data[key]
  // Supports filters: |longdate, |shortdate for date-looking values
  function render(template, data) {
    if (!template || typeof template !== 'string') return '';
    const re = /{{\s*([a-z0-9_]+)(?:\|([a-z]+))?\s*}}/gi;
    return template.replace(re, (_, key, filter) => {
      const raw = (data && key in data) ? data[key] : '';
      if (!raw) return '';
      if (key.startsWith('date_')) {
        if (filter === 'shortdate') return formatDate(raw, 'short');
        if (filter === 'longdate') return formatDate(raw, 'long');
        // No filter -> return as-is (usually YYYY-MM-DD from date input)
        return raw;
      }
      return String(raw);
    });
  }

  // Scan a template for placeholders and count which ones are empty in the provided data
  function missingFields(template, data) {
    if (!template) return [];
    const re = /{{\s*([a-z0-9_]+)(?:\|[a-z]+)?\s*}}/gi;
    const found = new Set();
    let m;
    while ((m = re.exec(template)) !== null) {
      found.add(m[1]);
    }
    const missing = [];
    for (const key of found) {
      const val = data?.[key];
      if (val === undefined || val === null || String(val).trim() === '') missing.push(key);
    }
    return missing;
  }

  async function copyToClipboard(text) {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return true;
      }
      // Fallback for non-secure contexts
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }

  // -------------------------------
  // Folders API
  // -------------------------------
  function listFolders() {
    return getStore().folders.slice();
  }

  function createFolder(name) {
    const store = getStore();
    const folder = { id: uid(), name: String(name || 'New Folder').trim() || 'New Folder', createdAt: nowISO() };
    store.folders.push(folder);
    saveStore(store);
    return folder;
  }

  function renameFolder(id, newName) {
    const store = getStore();
    const f = store.folders.find(x => x.id === id);
    if (!f) return false;
    f.name = String(newName || '').trim() || f.name;
    saveStore(store);
    return true;
  }

  // mode:
  // - 'keep' (default): do not delete templates, just set their folderId = null
  // - 'deleteTemplates': remove all templates within the folder
  function deleteFolder(id, mode = 'keep') {
    const store = getStore();
    const idx = store.folders.findIndex(x => x.id === id);
    if (idx === -1) return false;

    if (mode === 'deleteTemplates') {
      store.templates = store.templates.filter(t => t.folderId !== id);
    } else {
      for (const t of store.templates) {
        if (t.folderId === id) t.folderId = null;
      }
    }
    store.folders.splice(idx, 1);
    saveStore(store);
    return true;
  }

  function moveTemplatesToFolder(templateIds, folderId) {
    const store = getStore();
    for (const t of store.templates) {
      if (templateIds.includes(t.id)) t.folderId = folderId || null;
    }
    saveStore(store);
    return true;
  }

  // -------------------------------
  // Templates API
  // -------------------------------
  function listTemplates(filter = {}) {
    const { folderId = undefined } = filter;
    const all = getStore().templates.slice().sort((a, b) => a.name.localeCompare(b.name));
    if (folderId === undefined) return all;
    return all.filter(t => (folderId === null ? t.folderId === null : t.folderId === folderId));
  }

  function getTemplate(id) {
    return getStore().templates.find(t => t.id === id) || null;
  }

  function createTemplate({ name, subject = '', content, folderId = null }) {
  const store = getStore();
  const t = {
    id: uid(),
    name: String(name || 'Untitled Template').trim() || 'Untitled Template',
    subject: String(subject || '').trim(), // NEW
    content: String(content || '').trim(),
    folderId,
    createdAt: nowISO(),
    updatedAt: nowISO()
  };
  store.templates.push(t);
  saveStore(store);
  return t;
}


  function updateTemplate(id, patch = {}) {
  const store = getStore();
  const t = store.templates.find(x => x.id === id);
  if (!t) return false;
  if (patch.name !== undefined)    t.name    = String(patch.name).trim() || t.name;
  if (patch.subject !== undefined) t.subject = String(patch.subject).trim(); // NEW
  if (patch.content !== undefined) t.content = String(patch.content);
  if (patch.folderId !== undefined) t.folderId = patch.folderId;
  t.updatedAt = nowISO();
  saveStore(store);
  return true;
}


  function deleteTemplate(id) {
    const store = getStore();
    const i = store.templates.findIndex(x => x.id === id);
    if (i === -1) return false;
    store.templates.splice(i, 1);
    saveStore(store);
    return true;
  }

  // Ensure there’s at least one template the very first time
  ensureSampleTemplate();

  // Expose a tiny API for other pages
  window.ETCore = {
    // constants
    PLACEHOLDER_KEYS,

    // storage
    getStore,
    saveStore,

    // folders
    listFolders,
    createFolder,
    renameFolder,
    deleteFolder,
    moveTemplatesToFolder,

    // templates
    listTemplates,
    getTemplate,
    createTemplate,
    updateTemplate,
    deleteTemplate,

    // render helpers
    render,
    missingFields,
    formatDate,
    copyToClipboard
  };
})();
