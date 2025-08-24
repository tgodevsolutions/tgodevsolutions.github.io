/* =========================================================
   library.js — Saved Templates & Folders manager
   - Folder CRUD (add/rename/delete with keep-or-delete option)
   - List templates by folder (or All), search by name
   - Template actions: Edit inline, Move to folder, Delete
   - Uses ETCore (localStorage)
   ========================================================= */

document.addEventListener('DOMContentLoaded', () => {
  // ---------- Elements ----------
  const els = {
    // Folders
    folderList: document.getElementById('folderList'),
    addFolderBtn: document.getElementById('addFolderBtn'),
    renameFolderBtn: document.getElementById('renameFolderBtn'),
    deleteFolderBtn: document.getElementById('deleteFolderBtn'),
    folderHint: document.getElementById('folderHint'),

    // Templates
    searchInput: document.getElementById('searchInput'),
    templateList: document.getElementById('templateList'),
    templatesEmpty: document.getElementById('templatesEmpty'),

    // Inline editor
    editorCard: document.getElementById('editorCard'),
    editName: document.getElementById('editName'),
    editFolder: document.getElementById('editFolder'),
    editMeta: document.getElementById('editMeta'),
    editBody: document.getElementById('editBody'),
    cancelEditBtn: document.getElementById('cancelEditBtn'),
    saveEditBtn: document.getElementById('saveEditBtn'),
    deleteEditBtn: document.getElementById('deleteEditBtn')
  };

  // ---------- State ----------
  // Sentinel 'ALL' means show all templates across folders
  let selectedFolderId = 'ALL';
  let editingTemplateId = null;

  // ---------- Init ----------
  renderFolders();
  renderTemplates();
  wireFolderButtons();
  wireSearch();
  wireEditorButtons();

  // ========================================================
  // Rendering — Folders
  // ========================================================
  function renderFolders() {
    els.folderList.innerHTML = '';

    const templates = ETCore.listTemplates();
    const folders = ETCore.listFolders();
    const countByFolder = countTemplatesByFolder(templates);

    // "All templates" pseudo-row
    const allCount = templates.length;
    els.folderList.appendChild(
      folderRow('ALL', 'All templates', allCount)
    );

    // Real folders
    for (const f of folders) {
      const count = countByFolder.get(f.id) || 0;
      els.folderList.appendChild(folderRow(f.id, f.name, count));
    }

    // Restore selection highlight
    highlightSelectedFolder();

    // Hint text
    els.folderHint.textContent =
      selectedFolderId === 'ALL' ? 'Viewing all templates' : 'Select a folder to manage it';
  }

  function countTemplatesByFolder(templates) {
    const m = new Map();
    for (const t of templates) {
      const id = t.folderId || null;
      if (!id) continue;
      m.set(id, (m.get(id) || 0) + 1);
    }
    return m;
  }

  function folderRow(id, name, count) {
    const row = document.createElement('div');
    row.className = 'list-item';
    row.dataset.id = id;
    row.tabIndex = 0;

    const left = document.createElement('div');
    const title = document.createElement('div');
    title.className = 'item-title';
    title.textContent = name;

    const sub = document.createElement('div');
    sub.className = 'item-sub';
    sub.textContent = `${count} template${count === 1 ? '' : 's'}`;

    left.appendChild(title);
    left.appendChild(sub);
    row.appendChild(left);

    row.addEventListener('click', () => {
      selectedFolderId = id;
      renderTemplates();
      highlightSelectedFolder();
    });
    row.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        row.click();
      }
    });

    return row;
  }

  function highlightSelectedFolder() {
    els.folderList.querySelectorAll('.list-item').forEach(li => {
      if (li.dataset.id === selectedFolderId) {
        li.setAttribute('aria-selected', 'true');
        li.style.outline = '2px solid rgba(124,92,255,0.6)';  // subtle highlight
        li.style.background = 'rgba(124,92,255,0.06)';
      } else {
        li.removeAttribute('aria-selected');
        li.style.outline = '';
        li.style.background = '';
      }
    });
  }

  // ========================================================
  // Rendering — Templates
  // ========================================================
  function renderTemplates() {
    els.templateList.innerHTML = '';
    const search = (els.searchInput.value || '').toLowerCase();

    // Gather templates for current folder
    let list = ETCore.listTemplates(); // already sorted by name (core.js)
    if (selectedFolderId !== 'ALL') {
      list = list.filter(t => t.folderId === selectedFolderId);
    }

    // Filter by search
    if (search) {
      list = list.filter(t => t.name.toLowerCase().includes(search));
    }

    const folders = ETCore.listFolders();
    const folderNameById = new Map(folders.map(f => [f.id, f.name]));

    if (list.length === 0) {
      els.templatesEmpty.classList.remove('hidden');
      return;
    } else {
      els.templatesEmpty.classList.add('hidden');
    }

    for (const t of list) {
      els.templateList.appendChild(templateRow(t, folderNameById));
    }
  }

  function templateRow(t, folderNameById) {
    const row = document.createElement('div');
    row.className = 'list-item';
    row.dataset.id = t.id;

    const left = document.createElement('div');
    const title = document.createElement('div');
    title.className = 'item-title';
    title.textContent = t.name;

    const sub = document.createElement('div');
    sub.className = 'item-sub';
    const folderLabel = t.folderId ? (folderNameById.get(t.folderId) || 'Folder') : 'No folder';
    const updated = formatDisplayDate(t.updatedAt);
    sub.textContent = `${folderLabel} • Updated ${updated}`;

    left.appendChild(title);
    left.appendChild(sub);

    const actions = document.createElement('div');
    actions.className = 'row';

    const editBtn = button('Edit', 'btn btn-outline btn-small', () => openEditor(t.id));
    const moveBtn = button('Move', 'btn btn-outline btn-small', () => moveTemplatePrompt(t.id));
    const delBtn = button('Delete', 'btn btn-danger btn-small', () => deleteTemplate(t.id));

    actions.appendChild(editBtn);
    actions.appendChild(moveBtn);
    actions.appendChild(delBtn);

    row.appendChild(left);
    row.appendChild(actions);

    return row;
  }

  function button(text, cls, onClick) {
    const b = document.createElement('button');
    b.className = cls;
    b.type = 'button';
    b.textContent = text;
    b.addEventListener('click', onClick);
    return b;
  }

  function formatDisplayDate(iso) {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    // Reuse ETCore formatter for consistency (short)
    try { return ETCore.formatDate(iso, 'short'); }
    catch { return d.toLocaleDateString(); }
  }

  // ========================================================
  // Folder button actions
  // ========================================================
  function wireFolderButtons() {
    els.addFolderBtn.addEventListener('click', () => {
      const name = prompt('New folder name:', 'My Folder');
      if (!name) return;
      const f = ETCore.createFolder(name);
      renderFolders();
      // Auto-select newly created folder
      selectedFolderId = f.id;
      renderTemplates();
      highlightSelectedFolder();
    });

    els.renameFolderBtn.addEventListener('click', () => {
      if (selectedFolderId === 'ALL') {
        alert('Select a folder to rename.');
        return;
      }
      const current = ETCore.listFolders().find(f => f.id === selectedFolderId);
      if (!current) {
        alert('Folder not found.');
        return;
      }
      const nextName = prompt('Rename folder:', current.name);
      if (!nextName) return;
      ETCore.renameFolder(current.id, nextName);
      renderFolders();
      renderTemplates();
    });

    els.deleteFolderBtn.addEventListener('click', () => {
      if (selectedFolderId === 'ALL') {
        alert('Select a folder to delete.');
        return;
      }
      const folder = ETCore.listFolders().find(f => f.id === selectedFolderId);
      if (!folder) {
        alert('Folder not found.');
        return;
      }
      const sure = confirm(`Delete folder "${folder.name}"?`);
      if (!sure) return;

      // Ask whether to also delete all templates in the folder
      const alsoDelete = confirm('Also delete all templates inside this folder?\nOK = delete templates, Cancel = keep templates (move to "No folder").');
      ETCore.deleteFolder(folder.id, alsoDelete ? 'deleteTemplates' : 'keep');

      // Reset selection to All after deletion
      selectedFolderId = 'ALL';
      closeEditor();
      renderFolders();
      renderTemplates();
      highlightSelectedFolder();
    });
  }

  // ========================================================
  // Search
  // ========================================================
  function wireSearch() {
    els.searchInput.addEventListener('input', () => {
      renderTemplates();
    });
  }

  // ========================================================
  // Template editor (inline)
  // ========================================================
  function openEditor(templateId) {
    const t = ETCore.getTemplate(templateId);
    if (!t) return;

    editingTemplateId = t.id;
    els.editName.value = t.name || '';
    els.editBody.value = t.content || '';
    els.editMeta.textContent = `Created ${formatDisplayDate(t.createdAt)} • Updated ${formatDisplayDate(t.updatedAt)}`;

    populateEditFolderOptions(t.folderId);

    els.editorCard.classList.remove('hidden');
    els.editorCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function closeEditor() {
    editingTemplateId = null;
    els.editorCard.classList.add('hidden');
    els.editName.value = '';
    els.editBody.value = '';
    els.editMeta.textContent = '—';
    // keep folder select as-is; it will be repopulated when reopened
  }

  function populateEditFolderOptions(selectedId) {
    // keep first placeholder
    els.editFolder.querySelectorAll('option:not([value=""])').forEach(o => o.remove());
    const folders = ETCore.listFolders();
    for (const f of folders) {
      const opt = document.createElement('option');
      opt.value = f.id;
      opt.textContent = f.name;
      els.editFolder.appendChild(opt);
    }
    els.editFolder.value = selectedId || '';
  }

  function wireEditorButtons() {
    els.cancelEditBtn.addEventListener('click', () => {
      closeEditor();
    });

    els.saveEditBtn.addEventListener('click', () => {
      if (!editingTemplateId) return;
      const patch = {
        name: (els.editName.value || '').trim(),
        content: els.editBody.value || '',
        folderId: els.editFolder.value || null
      };
      if (!patch.name) {
        alert('Template name cannot be empty.');
        els.editName.focus();
        return;
      }
      ETCore.updateTemplate(editingTemplateId, patch);
      closeEditor();
      renderFolders();
      renderTemplates();
    });

    els.deleteEditBtn.addEventListener('click', () => {
      if (!editingTemplateId) return;
      const t = ETCore.getTemplate(editingTemplateId);
      const sure = confirm(`Delete template "${t?.name || 'this template'}"?`);
      if (!sure) return;
      ETCore.deleteTemplate(editingTemplateId);
      closeEditor();
      renderFolders();
      renderTemplates();
    });
  }

  // ========================================================
  // Template move / delete helpers
  // ========================================================
  function moveTemplatePrompt(templateId) {
    const folders = ETCore.listFolders();
    const choices = ['0) No folder'].concat(
      folders.map((f, i) => `${i + 1}) ${f.name}`)
    ).join('\n');

    const answer = prompt(
      `Move template to which folder?\n\n${choices}\n\nEnter the number:`,
      '0'
    );
    if (answer === null) return;

    const idx = parseInt(answer, 10);
    if (Number.isNaN(idx) || idx < 0 || idx > folders.length) {
      alert('Invalid choice.');
      return;
    }

    const targetFolderId = idx === 0 ? null : folders[idx - 1].id;
    ETCore.moveTemplatesToFolder([templateId], targetFolderId);

    // After moving, if we were filtering to a specific folder that no longer contains the item, refresh view
    renderFolders();
    renderTemplates();
  }

  function deleteTemplate(templateId) {
    const t = ETCore.getTemplate(templateId);
    const sure = confirm(`Delete template "${t?.name || 'this template'}"?`);
    if (!sure) return;

    ETCore.deleteTemplate(templateId);
    // If the inline editor was open for this template, close it
    if (editingTemplateId === templateId) closeEditor();

    renderFolders();
    renderTemplates();
  }
});
