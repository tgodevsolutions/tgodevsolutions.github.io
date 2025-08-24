/* =========================================================
   builder.js — Create/Save templates with {{placeholders}}
   - Folder picker + "New Folder" (localStorage via ETCore)
   - Stamp buttons insert at cursor (Subject OR Body)
   - Save template (name + subject + content + optional folder)
   - Quick Test area renders with ETCore.render
   - Small UX niceties (Ctrl+S to save, button feedback)
   ========================================================= */

document.addEventListener('DOMContentLoaded', () => {
  // ---------- Elements ----------
  const els = {
    name: document.getElementById('templateName'),
    subject: document.getElementById('templateSubject'),
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

  // Track the last focused editable so stamps insert there
  let lastTarget = els.body; // default

  // ---------- Init ----------
  populateFolderOptions();
  wireFolderActions();
  wireFocusTracking();
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
  // Focus tracking (so stamps know where to go)
  // ========================================================
  function wireFocusTracking() {
    const remember = (e) => { lastTarget = e.currentTarget; };
    // Remember focus/click/typing in either Subject or Body
    ['focus', 'click', 'keyup', 'mouseup'].forEach(evt => {
      els.subject.addEventListener(evt, remember);
      els.body.addEventListener(evt, remember);
    });
  }

  // ========================================================
  // Stamps / insertion
  // ========================================================
  function wireStampBar() {
    // Prevent buttons from stealing focus on mousedown
    els.stampBar.addEventListener('mousedown', (e) => {
      const btn = e.target.closest('button[data-stamp]');
      if (btn) e.preventDefault();
    });

    // On click, insert into the last focused editable (subject or body)
    els.stampBar.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-stamp]');
      if (!btn) return;
      const key = btn.getAttribute('data-stamp'); // e.g., first_name, date_1

      const target = (lastTarget === els.subject || lastTarget === els.body) ? lastTarget : els.body;
      insertAtCursor(target, `{{${key}}}`);
      target.focus();
    });
  }

  function insertAtCursor(el, text) {
    // Works for <input type="text"> and <textarea>
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? el.value.length;
    const before = el.value.slice(0, start);
    const after = el.value.slice(end);
    el.value = before + text + after;
    const caret = start + text.length;
    // Set caret for both input and textarea
    if (typeof el.setSelectionRange === 'function') {
      el.setSelectionRange(caret, caret);
    }
  }

  // ========================================================
  // Editor actions (Reset / Save)
  // ========================================================
  function wireEditorActions() {
    els.resetBtn.addEventListener('click', () => {
      if (!els.body.value && !els.name.value && !els.subject.value) return;
      const sure = confirm('Clear template name, subject, and content?');
      if (!sure) return;

      els.name.value = '';
      els.subject.value = '';
      els.body.value = '';
      els.folder.value = '';

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
    const subject = (els.subject.value || '').trim();
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

    ETCore.createTemplate({ name, subject, content, folderId });
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
