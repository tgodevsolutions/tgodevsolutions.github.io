/* =========================================================
   index.js — Inputs + Live Preview page logic
   - Loads templates from localStorage (ETCore)
   - Renders SUBJECT and BODY separately
   - Counts missing fields (subject + body)
   - Clear and Copy actions (two buttons)
   - Remembers last-used template + inputs (optional)
   ========================================================= */

document.addEventListener('DOMContentLoaded', () => {
  // ---------- Elements ----------
  const els = {
    firstName:   document.getElementById('firstName'),
    spokeTo:     document.getElementById('spokeTo'),
    company:     document.getElementById('companyName'),
    competitor:  document.getElementById('competitor'),
    date1:       document.getElementById('date1'),
    date2:       document.getElementById('date2'),
    templateSel: document.getElementById('templateSelect'),
    clearBtn:    document.getElementById('clearBtn'),

    copySubjectBtn: document.getElementById('copySubjectBtn'),
    copyBodyBtn:    document.getElementById('copyBodyBtn'),

    subjectPreview: document.getElementById('subjectPreview'),
    bodyPreview:    document.getElementById('bodyPreview'),
    emptyState:     document.getElementById('emptyState'),
    missing:        document.getElementById('missingBadge')
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
  hydrateInputs(state.inputs);
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
    els.templateSel.querySelectorAll('option:not([value=""])').forEach(o => o.remove());

    const folders = ETCore.listFolders();
    const folderNameById = new Map(folders.map(f => [f.id, f.name]));
    const templates = ETCore.listTemplates();

    for (const t of templates) {
      const opt = document.createElement('option');
      opt.value = t.id;
      opt.textContent = t.folderId ? `${folderNameById.get(t.folderId) || 'Folder' } / ${t.name}` : t.name;
      els.templateSel.appendChild(opt);
    }
  }

  function hydrateInputs(obj) {
    if (obj.first_name   !== undefined) els.firstName.value = obj.first_name;
    if (obj.spoke_to     !== undefined) els.spokeTo.value   = obj.spoke_to;
    if (obj.company_name !== undefined) els.company.value   = obj.company_name;
    if (obj.competitor   !== undefined) els.competitor.value= obj.competitor;
    if (obj.date_1       !== undefined) els.date1.value     = obj.date_1;
    if (obj.date_2       !== undefined) els.date2.value     = obj.date_2;
  }

  function collectInputs() {
    const data = {};
    document.querySelectorAll('[data-field]').forEach(input => {
      const key = input.dataset.field;
      let val = input.value || '';
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

  function applyPreviews(subjectOut, bodyOut) {
    const hasSubject = subjectOut && subjectOut.trim().length > 0;
    const hasBody    = bodyOut && bodyOut.trim().length > 0;
    const hasAny     = hasSubject || hasBody;

    els.subjectPreview.textContent = hasSubject ? subjectOut : '';
    els.bodyPreview.textContent    = hasBody ? bodyOut : '';

    els.copySubjectBtn.disabled = !hasSubject;
    els.copyBodyBtn.disabled    = !hasBody;

    if (hasAny) {
      els.emptyState.classList.add('hidden');
    } else {
      els.emptyState.classList.remove('hidden');
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
      applyPreviews('', '');
      updateMissingBadge('', state.inputs);
      return;
    }

    const subjectStr = tpl.subject || '';
    const bodyStr    = tpl.content || '';

    const subjectOut = ETCore.render(subjectStr, state.inputs);
    const bodyOut    = ETCore.render(bodyStr, state.inputs);

    applyPreviews(subjectOut, bodyOut);

    // Count missing fields across both templates
    const combinedTemplateForMissing = `${subjectStr}\n${bodyStr}`;
    updateMissingBadge(combinedTemplateForMissing, state.inputs);
  }

  function wireInputListeners() {
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
      document.querySelectorAll('[data-field]').forEach(input => { input.value = ''; });
      state.inputs = {};
      saveInputsCache();
      refreshPreview();
    });

    els.copySubjectBtn.addEventListener('click', async () => {
      const text = els.subjectPreview.textContent || '';
      if (!text.trim()) return;
      const ok = await ETCore.copyToClipboard(text);
      const original = els.copySubjectBtn.textContent;
      els.copySubjectBtn.textContent = ok ? 'Copied!' : 'Copy failed';
      els.copySubjectBtn.disabled = true;
      setTimeout(() => {
        els.copySubjectBtn.textContent = original;
        refreshPreview();
      }, 1200);
    });

    els.copyBodyBtn.addEventListener('click', async () => {
      const text = els.bodyPreview.textContent || '';
      if (!text.trim()) return;
      const ok = await ETCore.copyToClipboard(text);
      const original = els.copyBodyBtn.textContent;
      els.copyBodyBtn.textContent = ok ? 'Copied!' : 'Copy failed';
      els.copyBodyBtn.disabled = true;
      setTimeout(() => {
        els.copyBodyBtn.textContent = original;
        refreshPreview();
      }, 1200);
    });
  }
});
