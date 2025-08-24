/* =========================================================
   index.js — Inputs + Live Preview page logic
   - Loads templates from localStorage (ETCore)
   - Renders preview with {{placeholders}} and date filters
   - Counts missing fields
   - Clear and Copy actions
   - Remembers last-used template + inputs (optional)
   ========================================================= */

document.addEventListener('DOMContentLoaded', () => {
  // ---------- Elements ----------
  const els = {
    firstName:  document.getElementById('firstName'),
    spokeTo:    document.getElementById('spokeTo'),
    company:    document.getElementById('companyName'),
    competitor: document.getElementById('competitor'),
    date1:      document.getElementById('date1'),
    date2:      document.getElementById('date2'),
    templateSel:document.getElementById('templateSelect'),
    clearBtn:   document.getElementById('clearBtn'),
    copyBtn:    document.getElementById('copyBtn'),
    preview:    document.getElementById('preview'),
    emptyState: document.getElementById('emptyState'),
    missing:    document.getElementById('missingBadge')
  };

  // ---------- State / Cache keys ----------
  const CACHE_KEY_INPUTS = 'emailTemplates.index.inputs';
  const CACHE_KEY_TPLID  = 'emailTemplates.index.templateId';

  const state = {
    selectedTemplateId: localStorage.getItem(CACHE_KEY_TPLID) || '',
    inputs: loadInputsCache()
  };

  // ---------- Init ----------
  buildTemplateOptions();
  hydrateInputs(state.inputs); // fill from cache (optional)
  if (state.selectedTemplateId) {
    els.templateSel.value = state.selectedTemplateId;
  }
  wireInputListeners();
  wireActions();
  refreshPreview();

  // ========================================================
  // Functions
  // ========================================================

  function loadInputsCache() {
    try {
      const raw = localStorage.getItem(CACHE_KEY_INPUTS);
      const obj = JSON.parse(raw || '{}');
      // ensure we only keep known keys
      const allowed = new Set(ETCore.PLACEHOLDER_KEYS);
      return Object.fromEntries(Object.entries(obj).filter(([k]) => allowed.has(k)));
    } catch {
      return {};
    }
  }

  function saveInputsCache() {
    try {
      localStorage.setItem(CACHE_KEY_INPUTS, JSON.stringify(state.inputs));
    } catch {}
  }

  function saveTemplateIdCache() {
    try {
      localStorage.setItem(CACHE_KEY_TPLID, state.selectedTemplateId || '');
    } catch {}
  }

  function buildTemplateOptions() {
    // Clear current options (keep placeholder first option)
    els.templateSel.querySelectorAll('option:not([value=""])').forEach(o => o.remove());

    const folders = ETCore.listFolders();
    const folderNameById = new Map(folders.map(f => [f.id, f.name]));
    const templates = ETCore.listTemplates(); // all templates, alpha by name (core.js)

    for (const t of templates) {
      const opt = document.createElement('option');
      opt.value = t.id;
      opt.textContent = t.folderId ? `${folderNameById.get(t.folderId) || 'Folder' } / ${t.name}` : t.name;
      els.templateSel.appendChild(opt);
    }
  }

  function hydrateInputs(obj) {
    // Fill the UI from cached inputs if present
    if (obj.first_name !== undefined) els.firstName.value = obj.first_name;
    if (obj.spoke_to !== undefined) els.spokeTo.value = obj.spoke_to;
    if (obj.company_name !== undefined) els.company.value = obj.company_name;
    if (obj.competitor !== undefined) els.competitor.value = obj.competitor;
    if (obj.date_1 !== undefined) els.date1.value = obj.date_1;
    if (obj.date_2 !== undefined) els.date2.value = obj.date_2;
  }

  function collectInputs() {
    // Read all fields with data-field attributes (future-proof if we add more)
    const data = {};
    document.querySelectorAll('[data-field]').forEach(input => {
      const key = input.dataset.field; // matches ETCore placeholders
      let val = input.value || '';
      // Trim spaces except dates
      if (!key.startsWith('date_')) val = val.trim();
      data[key] = val;
    });
    return data;
  }

  function getSelectedTemplate() {
    const id = state.selectedTemplateId;
    if (!id) return null;
    return ETCore.getTemplate(id);
  }

  function setPreview(text) {
    // Render plain text; preserve newlines
    if (text && String(text).trim().length > 0) {
      els.emptyState?.classList.add('hidden');
      // Use textContent to avoid injecting HTML
      els.preview.textContent = text;
      els.copyBtn.disabled = false;
    } else {
      els.preview.textContent = '';
      els.emptyState?.classList.remove('hidden');
      els.copyBtn.disabled = true;
    }
  }

  function updateMissingBadge(templateStr, data) {
    const miss = ETCore.missingFields(templateStr, data);
    els.missing.textContent = `Missing fields: ${miss.length}`;
    els.missing.title = miss.length ? `Missing: ${miss.join(', ')}` : 'All placeholders filled';
  }

  function refreshPreview() {
    state.inputs = collectInputs();
    saveInputsCache();

    const tpl = getSelectedTemplate();
    if (!tpl) {
      setPreview('');
      updateMissingBadge('', state.inputs);
      return;
    }

    const output = ETCore.render(tpl.content, state.inputs);
    setPreview(output);
    updateMissingBadge(tpl.content, state.inputs);
  }

  function wireInputListeners() {
    // Any change re-renders
    document.querySelectorAll('[data-field]').forEach(input => {
      input.addEventListener('input', refreshPreview);
      input.addEventListener('change', refreshPreview);
    });

    els.templateSel.addEventListener('change', () => {
      state.selectedTemplateId = els.templateSel.value;
      saveTemplateIdCache();
      refreshPreview();
    });
  }

  function wireActions() {
    els.clearBtn.addEventListener('click', () => {
      document.querySelectorAll('[data-field]').forEach(input => {
        input.value = '';
      });
      state.inputs = {};
      saveInputsCache();
      refreshPreview();
    });

    els.copyBtn.addEventListener('click', async () => {
      const currentText = els.preview.textContent || '';
      if (!currentText.trim()) return;

      const ok = await ETCore.copyToClipboard(currentText);
      const original = els.copyBtn.textContent;
      els.copyBtn.textContent = ok ? 'Copied!' : 'Copy failed';
      els.copyBtn.disabled = true;

      setTimeout(() => {
        els.copyBtn.textContent = original;
        refreshPreview(); // re-enable based on content
      }, 1200);
    });
  }
});
