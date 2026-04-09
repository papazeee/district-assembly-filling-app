/* ═══════════════════════════════════════════════════════════
   incoming.js  |  Incoming letters page logic
   ═══════════════════════════════════════════════════════════ */

Auth.guard();
document.addEventListener('DOMContentLoaded', () => initSidebar('nav-incoming'));

// Pre-filter the status dropdown to the letters most relevant to this role
(function applyRoleDefaultFilter() {
  const role = Auth.user()?.role;
  const sel  = document.getElementById('statusFilter');
  if (!sel) return;
  if (role === 'DIRECTOR') sel.value = 'DIRECTOR_QUEUE';
  if (role === 'DCE')      sel.value = 'WITH_DCE';
  if (role === 'DEPARTMENT_HEAD') sel.value = 'DISPATCHED_TO_DEPT'; 
})();

let allLetters   = [];
let departments  = [];
let currentLetter = null;
let pendingAction = null;   // { endpoint, needsDept, requireRemarks }

// ── Load data ─────────────────────────────────────────────────
async function loadLetters() {
  const status = document.getElementById('statusFilter').value;
  const search = document.getElementById('searchInput').value;
  const role = Auth.user()?.role;

  let url = '/letters/?letter_type=INCOMING&limit=200';
  if (status && status !== 'DIRECTOR_QUEUE') url += `&status=${status}`;
  if (search) url += `&search=${encodeURIComponent(search)}`;

  const res  = await apiFetch(url);
  allLetters = await res.json();

  if (status === 'DIRECTOR_QUEUE' || (role === 'DIRECTOR' && !status)) {
    allLetters = allLetters.filter((l) =>
      l.status === 'WITH_DIRECTOR' || l.status === 'RETURNED_TO_DIRECTOR'
    );
  }

  renderTable(allLetters);
}

async function loadDepartments() {
  const res = await apiFetch('/departments/');
  departments = await res.json();
  const sel = document.getElementById('deptSelect');
  departments.forEach(d => {
    const opt = document.createElement('option');
    opt.value = d.id;
    opt.textContent = `${d.name} (${d.code})`;
    sel.appendChild(opt);
  });
}

// ── Render table ──────────────────────────────────────────────
function renderTable(letters) {
  const tbody = document.getElementById('lettersBody');

  if (!Array.isArray(letters) || letters.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state">
      <div class="empty-state-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></div>
      <h3>No letters found</h3><p>Try adjusting your filters or log a new letter</p>
    </div></td></tr>`;
    return;
  }

  tbody.innerHTML = letters.map(l => `
    <tr>
      <td><span class="td-serial">${l.serial_number}</span></td>
      <td>${l.reference_number || '—'}</td>
      <td><span class="td-subject" title="${l.subject}">${l.subject}</span></td>
      <td>${l.sender_name || '—'}${l.sender_org ? `<br/><small style="color:var(--muted);">${l.sender_org}</small>` : ''}</td>
      <td>${fmtDate(l.date_received)}</td>
      <td>${statusBadge(l.status)}</td>
      <td>
        <div class="td-actions">
          <button class="btn btn-outline btn-sm" onclick="viewLetter(${l.id})">View</button>
          ${workflowBtn(l)}
        </div>
      </td>
    </tr>
  `).join('');
}

function workflowBtn(l) {
  const role = Auth.user()?.role;
  if (l.status === 'CLOSED') return '';
  const canActOnDepartmentLetter = role === 'ADMIN' || (
    role === 'DEPARTMENT_HEAD' && Auth.user()?.department_id === l.assigned_department?.id
  );

  if (l.status === 'RECEIVED_BY_RECORDS' && (role === 'RECORDS' || role === 'ADMIN'))
    return `<button class="btn btn-primary btn-sm" onclick="triggerAction(${l.id},'forward-to-director','Forward to Director')">→ Director</button>`;

  if (l.status === 'WITH_DIRECTOR' && (role === 'DIRECTOR' || role === 'ADMIN'))
    return `<button class="btn btn-primary btn-sm" onclick="triggerAction(${l.id},'forward-to-dce','Forward to DCE')">→ DCE</button>
            <button class="btn btn-outline btn-sm" onclick="triggerAction(${l.id},'dispatch-to-department','Dispatch to Department',true)">→ Dept.</button>`;

  if (l.status === 'WITH_DCE' && (role === 'DCE' || role === 'ADMIN'))
    return `<button class="btn btn-outline btn-sm" onclick="triggerAction(${l.id},'return-to-director','Return to Director')">↩ Director</button>`;

  if (l.status === 'RETURNED_TO_DIRECTOR' && (role === 'DIRECTOR' || role === 'ADMIN'))
    return `<button class="btn btn-primary btn-sm" onclick="triggerAction(${l.id},'dispatch-to-department','Dispatch to Department',true)">→ Dept.</button>
            <button class="btn btn-outline btn-sm" onclick="triggerAction(${l.id},'close','Close Letter')">✓ Close</button>`;

  if (l.status === 'DISPATCHED_TO_DEPT' && canActOnDepartmentLetter)
    return `<button class="btn btn-primary btn-sm" onclick="triggerAction(${l.id},'return-from-department','Mark Done & Return to Director',false,true)">✓ Done & Return</button>`;

  return '';
}

// ── View letter detail ────────────────────────────────────────
async function viewLetter(id) {
  openModal('detailModal');
  document.getElementById('detailBody').innerHTML = '<div style="padding:2rem;text-align:center;color:var(--muted);">Loading…</div>';
  document.getElementById('detailFooter').innerHTML = '';

  const res    = await apiFetch(`/letters/${id}`);
  const letter = await res.json();
  currentLetter = letter;
  const attachmentUrl = buildUploadUrl(letter.file_path);

  document.getElementById('detailTitle').textContent = letter.serial_number;

  document.getElementById('detailBody').innerHTML = `
    <div class="detail-grid" style="margin-bottom:1.5rem;">
      <div class="detail-item"><div class="detail-label">Serial Number</div><div class="detail-value" style="font-family:monospace;">${letter.serial_number}</div></div>
      <div class="detail-item"><div class="detail-label">Status</div><div class="detail-value">${statusBadge(letter.status)}</div></div>
      <div class="detail-item"><div class="detail-label">Subject</div><div class="detail-value">${letter.subject}</div></div>
      <div class="detail-item"><div class="detail-label">Reference No.</div><div class="detail-value">${letter.reference_number || '—'}</div></div>
      <div class="detail-item"><div class="detail-label">Sender</div><div class="detail-value">${letter.sender_name || '—'}</div></div>
      <div class="detail-item"><div class="detail-label">Organisation</div><div class="detail-value">${letter.sender_org || '—'}</div></div>
      <div class="detail-item"><div class="detail-label">Date Received</div><div class="detail-value">${fmtDate(letter.date_received)}</div></div>
      <div class="detail-item"><div class="detail-label">Department</div><div class="detail-value">${letter.assigned_department?.name || '—'}</div></div>
      ${(letter.file_name && attachmentUrl) ? `<div class="detail-item" style="grid-column:span 2;"><div class="detail-label">Attachment</div><div class="detail-value"><a href="${attachmentUrl}" target="_blank" rel="noopener noreferrer" style="color:var(--green);text-decoration:underline;">📎 ${letter.file_name}</a></div></div>` : ''}
      ${letter.notes ? `<div class="detail-item" style="grid-column:span 2;"><div class="detail-label">Notes</div><div class="detail-value">${letter.notes}</div></div>` : ''}
    </div>

    <div style="border-top:1px solid var(--border);padding-top:1.2rem;">
      <div style="font-size:.82rem;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);margin-bottom:1rem;">Audit Trail</div>
      <div class="timeline">
        ${(letter.audit_trail || []).map((t, i) => `
          <div class="timeline-item">
            ${i < (letter.audit_trail.length - 1) ? '<div class="timeline-line"></div>' : ''}
            <div class="timeline-dot ${i === 0 ? 'gold' : ''}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <div class="timeline-content">
              <div class="timeline-action">${t.action}</div>
              <div class="timeline-meta">By ${t.actor?.full_name || '—'} &middot; ${fmtDateTime(t.created_at)}</div>
              ${t.remarks ? `<div class="timeline-remark">"${t.remarks}"</div>` : ''}
            </div>
          </div>
        `).join('')}
        ${!letter.audit_trail?.length ? '<p style="color:var(--muted);font-size:.85rem;">No trail entries yet.</p>' : ''}
      </div>
    </div>
  `;

  document.getElementById('detailFooter').innerHTML = `<button class="btn btn-outline" onclick="closeModal('detailModal')">Close</button>`;
}

// ── Workflow action ───────────────────────────────────────────
function triggerAction(letterId, endpoint, title, needsDept = false, requireRemarks = false) {
  pendingAction = { letterId, endpoint, needsDept, requireRemarks };
  document.getElementById('actionTitle').textContent = title;
  const deptGroup = document.getElementById('deptSelectGroup');
  deptGroup.classList.toggle('is-hidden', !needsDept);
  if (needsDept) {
    document.getElementById('deptSelect').value = '';
  }
  document.getElementById('actionRemarksLabel').textContent = requireRemarks
    ? 'Department Report (required)'
    : 'Remarks (optional)';
  document.getElementById('actionRemarks').placeholder = requireRemarks
    ? 'Describe what was done and any outcomes from the department...'
    : 'Add any notes for the next person...';
  document.getElementById('actionRemarks').value = '';
  openModal('actionModal');
}

document.getElementById('actionConfirmBtn').addEventListener('click', async () => {
  if (!pendingAction) return;
  const { letterId, endpoint, needsDept, requireRemarks } = pendingAction;

  const btn     = document.getElementById('actionConfirmBtn');
  const remarks = document.getElementById('actionRemarks').value.trim();

  if (needsDept) {
    const deptId = document.getElementById('deptSelect').value;
    if (!deptId) { showToast('Please select a department', 'error'); return; }
  }
  if (requireRemarks && !remarks) {
    showToast('Department report is required before marking done and returning to Director.', 'error');
    return;
  }

  btn.classList.add('loading');

  try {
    let body;
    if (needsDept) {
      body = JSON.stringify({
        department_id: parseInt(document.getElementById('deptSelect').value),
        remarks,
      });
    } else {
      body = JSON.stringify({ remarks });
    }

    const res = await apiFetch(`/letters/${letterId}/${endpoint}`, {
      method: 'POST',
      body,
    });

    if (!res.ok) {
      const err = await res.json();
      showToast(err.detail || 'Action failed', 'error');
      return;
    }

    showToast('Letter updated successfully', 'success');
    closeModal('actionModal');
    closeModal('detailModal');
    loadLetters();

  } catch {
    showToast('Network error. Please try again.', 'error');
  } finally {
    btn.classList.remove('loading');
  }
});

// ── Log new letter ────────────────────────────────────────────
// Show log button only for allowed roles
if (!canLog()) {
  document.getElementById('logBtnWrap').style.display = 'none';
}

document.getElementById('openLogBtn')?.addEventListener('click', () => {
  document.getElementById('logForm').reset();
  document.getElementById('fileUploadName').classList.remove('show');
  document.getElementById('logAlert').classList.add('hidden');
  // Default date to today
  document.getElementById('f_date_received').value = new Date().toISOString().slice(0, 10);
  openModal('logModal');
});

// File upload display
document.getElementById('f_file').addEventListener('change', (e) => {
  const name = e.target.files[0]?.name;
  const el   = document.getElementById('fileUploadName');
  el.textContent = name || '';
  el.classList.toggle('show', !!name);
});

document.getElementById('logSubmitBtn').addEventListener('click', async () => {
  const btn   = document.getElementById('logSubmitBtn');
  const alert = document.getElementById('logAlert');

  const subject      = document.getElementById('f_subject').value.trim();
  const sender_name  = document.getElementById('f_sender_name').value.trim();
  const date_received= document.getElementById('f_date_received').value;
  const received_by  = document.getElementById('f_received_by_name').value.trim();

  if (!subject || !sender_name || !date_received || !received_by) {
    showAlert(alert, 'Please fill in all required fields.');
    return;
  }

  btn.classList.add('loading');
  hideAlert(alert);

  try {
    const fd = new FormData();
    fd.append('subject',          subject);
    fd.append('sender_name',      sender_name);
    fd.append('date_received',    date_received);
    fd.append('received_by_name', received_by);
    fd.append('reference_number', document.getElementById('f_reference').value.trim());
    fd.append('sender_org',       document.getElementById('f_sender_org').value.trim());
    fd.append('notes',            document.getElementById('f_notes').value.trim());

    const fileInput = document.getElementById('f_file');
    if (fileInput.files[0]) fd.append('file', fileInput.files[0]);

    const res = await fetch(`${API}/letters/incoming`, {
      method:  'POST',
      headers: Auth.formHeaders(),
      body:    fd,
    });

    if (!res.ok) {
      const err = await res.json();
      showAlert(alert, err.detail || 'Failed to save letter.');
      return;
    }

    showToast('Letter logged successfully!', 'success');
    closeModal('logModal');
    loadLetters();

  } catch {
    showAlert(alert, 'Network error. Please try again.');
  } finally {
    btn.classList.remove('loading');
  }
});

// ── Filters ───────────────────────────────────────────────────
document.getElementById('searchInput').addEventListener('input', debounce(loadLetters, 400));
document.getElementById('statusFilter').addEventListener('change', loadLetters);
document.getElementById('refreshBtn').addEventListener('click', loadLetters);

// ── Init ──────────────────────────────────────────────────────
loadLetters();
loadDepartments();
