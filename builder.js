/* =========================================================
   builder.js — Create/Save templates with {{placeholders}}
   - Folder picker + "New Folder" (localStorage via ETCore)
   - Stamp buttons insert at cursor (supports |longdate/|shortdate)
   - Save template (name + content + optional folder)
   - Quick Test area renders with ETCore.render
   - Small UX niceties (Ctrl+S to save, button feedback)
   ========================================================= */

document.addEventListener('DOMContentLoaded', () => {
  // ---------- Elements ----------
  const els = {
  name: document.getElementById('templateName'),
  folder: document.getElementById('folderSelect'),
  newFolderBtn: document.getElementById('newFolderBtn'),
  resetBtn: document.getElementById('resetBtn'),
  saveBtn: document.getElementById('saveBtn'),
  body: document.getElementById('templateBody'),
  stampBar: document.getElementById('stampBar'),

  // Quick Test inputs
  test_first_name: document.getElementById('test_first_name'),
  test_spoke_to: document.getElementById('test_spoke_to'),
  test_company_name: document.getElementById('test_company_name'),
  test_competitor: document.getElementById('test_competitor'),
  test_date_1: document.getElementById('test_date_1'),
  test_date_2: document.getElementById('test_date_2'),
  renderTestBtn: document.getElementById('renderTestBtn'),
  testPreview: document.getElementById('testPreview')
};


  // ---------- Init ----------
  populateFolderOptions();
  wireFolderActions();
  wireStampBar();
  wireEditorActions();
  wireQuickTest();
  wireShortcuts();

  // ========================================================
  // Folder handling
  // ========================================================
  function populateFolderOptions(selectId = null) {
    // keep first placeholder option
    els.folder.querySelectorAll('option:not([value=""])').forEach(o => o.remove());
    const folders = ETCore.listFolders();
    for (const f of folders) {
      const opt = document.createElement('option');
      opt.value = f.id;
      opt.textContent = f.name;
      els.folder.appendChild(opt);
    }
    if (selectId) els.folder.value = selectId;
  }

  function wireFolderActions() {
    els.newFolderBtn.addEventListener('click', () => {
      const name = prompt('New folder name:', 'My Folder');
      if (!name) return;
      const f = ETCore.createFolder(name);
      populateFolderOptions(f.id);
      feedback(els.newFolderBtn, 'Created!');
    });
  }

  // ========================================================
  // Stamps / insertion
  // ========================================================
  function wireStampBar() {
  els.stampBar.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-stamp]');
    if (!btn) return;
    const key = btn.getAttribute('data-stamp'); // e.g., first_name, date_1
    // No dropdown anymore; always insert plain placeholder
    insertAtCursor(els.body, `{{${key}}}`);
    els.body.focus();
  });
}


  function insertAtCursor(textarea, text) {
    const start = textarea.selectionStart ?? textarea.value.length;
    const end = textarea.selectionEnd ?? textarea.value.length;
    const before = textarea.value.slice(0, start);
    const after = textarea.value.slice(end);
    textarea.value = before + text + after;
    const caret = start + text.length;
    textarea.setSelectionRange(caret, caret);
  }

  // ========================================================
  // Editor actions (Reset / Save)
  // ========================================================
  function wireEditorActions() {
    els.resetBtn.addEventListener('click', () => {
      if (!els.body.value && !els.name.value) return;
      const sure = confirm('Clear template name and content?');
      if (!sure) return;

      els.name.value = '';
      els.body.value = '';
      els.folder.value = '';
      els.dateFilter.value = '';

      // Clear Quick Test too
      ['test_first_name','test_spoke_to','test_company_name','test_competitor','test_date_1','test_date_2']
        .forEach(id => els[id].value = '');
      setTestPreview('');
    });

    els.saveBtn.addEventListener('click', () => {
      saveTemplate();
    });
  }

  function saveTemplate() {
    const name = (els.name.value || '').trim();
    const content = (els.body.value || '').trim();
    const folderId = els.folder.value || null;

    if (!content) {
      alert('Please write some template content.');
      els.body.focus();
      return;
    }
    if (!name) {
      alert('Please give your template a name.');
      els.name.focus();
      return;
    }

    ETCore.createTemplate({ name, content, folderId });
    feedback(els.saveBtn, 'Saved!');
  }

  // Small button feedback helper
  function feedback(button, msg) {
    const original = button.textContent;
    button.textContent = msg;
    button.disabled = true;
    setTimeout(() => {
      button.textContent = original;
      button.disabled = false;
    }, 1200);
  }

  // ========================================================
  // Quick Test
  // ========================================================
  function wireQuickTest() {
    els.renderTestBtn.addEventListener('click', () => {
      const data = {
        first_name: els.test_first_name.value || '',
        spoke_to: els.test_spoke_to.value || '',
        company_name: els.test_company_name.value || '',
        competitor: els.test_competitor.value || '',
        date_1: els.test_date_1.value || '',
        date_2: els.test_date_2.value || ''
      };
      const templateStr = els.body.value || '';
      const output = ETCore.render(templateStr, data);
      setTestPreview(output);
    });
  }

  function setTestPreview(text) {
    if (!text || !text.trim()) {
      els.testPreview.textContent = '';
      els.testPreview.innerHTML = '<div class="empty">Your rendered template will appear here.</div>';
      return;
    }
    els.testPreview.textContent = text; // keep as plain text
  }

  // ========================================================
  // Shortcuts
  // ========================================================
  function wireShortcuts() {
    document.addEventListener('keydown', (e) => {
      // Ctrl/Cmd + S -> Save
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        saveTemplate();
      }
    });
  }
});
