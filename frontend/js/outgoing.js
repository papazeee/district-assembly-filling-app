/* ═══════════════════════════════════════════════════════════
   outgoing.js  |  Outgoing letters page logic
   ═══════════════════════════════════════════════════════════ */

Auth.guard();
document.addEventListener('DOMContentLoaded', () => initSidebar('nav-outgoing'));

const DISPATCH_LABELS = {
  HAND_DELIVERY: 'Hand Delivery',
  POSTAL:        'Postal / Mail',
  EMAIL:         'Email',
  WHATSAPP:      'WhatsApp',
  COURIER:       'Courier',
  FAX:           'Fax',
};

const dispatchModeEl = document.getElementById('f_dispatch_mode');
const digitalContactGroupEl = document.getElementById('digitalContactGroup');
const digitalContactLabelEl = document.getElementById('digitalContactLabel');
const emailTabEl = document.getElementById('emailContactTab');
const whatsappTabEl = document.getElementById('whatsappContactTab');
const emailInputEl = document.getElementById('f_recipient_email');
const whatsappInputEl = document.getElementById('f_recipient_whatsapp');

function updateDispatchContactTab() {
  const mode = dispatchModeEl?.value;
  const showEmail = mode === 'EMAIL';
  const showWhatsApp = mode === 'WHATSAPP';
  const showDigitalGroup = showEmail || showWhatsApp;

  digitalContactGroupEl?.classList.toggle('is-hidden', !showDigitalGroup);
  emailTabEl?.classList.toggle('is-hidden', !showEmail);
  whatsappTabEl?.classList.toggle('is-hidden', !showWhatsApp);

  if (mode === 'EMAIL') {
    digitalContactLabelEl.textContent = 'Recipient Email Address *';
    emailInputEl.required = true;
    whatsappInputEl.required = false;
    whatsappInputEl.value = '';
  } else if (mode === 'WHATSAPP') {
    digitalContactLabelEl.textContent = 'Recipient WhatsApp Number *';
    whatsappInputEl.required = true;
    emailInputEl.required = false;
    emailInputEl.value = '';
  } else {
    digitalContactLabelEl.textContent = 'Dispatch Contact';
    emailInputEl.required = false;
    whatsappInputEl.required = false;
    emailInputEl.value = '';
    whatsappInputEl.value = '';
  }
}

// ── Load letters ──────────────────────────────────────────────
async function loadLetters() {
  const status = document.getElementById('statusFilter').value;
  const search = document.getElementById('searchInput').value;

  let url = '/letters/?letter_type=OUTGOING&limit=200';
  if (status) url += `&status=${status}`;
  if (search) url += `&search=${encodeURIComponent(search)}`;

  const res     = await apiFetch(url);
  if (!res) return;
  const letters = await res.json();
  renderTable(letters);
}

function renderTable(letters) {
  const tbody = document.getElementById('lettersBody');
  if (!Array.isArray(letters) || letters.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state">
      <div class="empty-state-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg></div>
      <h3>No outgoing letters yet</h3><p>Log your first outgoing letter to get started</p>
    </div></td></tr>`;
    return;
  }

  tbody.innerHTML = letters.map(l => `
    <tr>
      <td><span class="td-serial">${l.serial_number}</span></td>
      <td>${l.reference_number || '—'}</td>
      <td><span class="td-subject" title="${l.subject}">${l.subject}</span></td>
      <td>${l.recipient_name || '—'}${l.recipient_org ? `<br/><small style="color:var(--muted);">${l.recipient_org}</small>` : ''}</td>
      <td>${DISPATCH_LABELS[l.dispatch_mode] || l.dispatch_mode || '—'}</td>
      <td>${fmtDate(l.date_sent)}</td>
      <td>${statusBadge(l.status)}</td>
      <td>
        <div class="td-actions">
          <button class="btn btn-outline btn-sm" onclick="viewLetter(${l.id})">View</button>
          ${l.status === 'OUTGOING_DRAFT' && canLog()
            ? `<button class="btn btn-primary btn-sm" onclick="markSent(${l.id})">Mark Sent</button>`
            : ''}
        </div>
      </td>
    </tr>
  `).join('');
}

// ── View detail ───────────────────────────────────────────────
async function viewLetter(id) {
  openModal('detailModal');
  document.getElementById('detailBody').innerHTML = '<div style="padding:2rem;text-align:center;color:var(--muted);">Loading…</div>';

  const res    = await apiFetch(`/letters/${id}`);
  if (!res) return;
  const letter = await res.json();
  const attachmentUrl = buildUploadUrl(letter.file_path);

  document.getElementById('detailTitle').textContent = letter.serial_number;
  document.getElementById('detailBody').innerHTML = `
    <div class="detail-grid" style="margin-bottom:1.5rem;">
      <div class="detail-item"><div class="detail-label">Serial Number</div><div class="detail-value" style="font-family:monospace;">${letter.serial_number}</div></div>
      <div class="detail-item"><div class="detail-label">Status</div><div class="detail-value">${statusBadge(letter.status)}</div></div>
      <div class="detail-item"><div class="detail-label">Subject</div><div class="detail-value">${letter.subject}</div></div>
      <div class="detail-item"><div class="detail-label">Reference No.</div><div class="detail-value">${letter.reference_number || '—'}</div></div>
      <div class="detail-item"><div class="detail-label">Recipient</div><div class="detail-value">${letter.recipient_name || '—'}</div></div>
      <div class="detail-item"><div class="detail-label">Organisation</div><div class="detail-value">${letter.recipient_org || '—'}</div></div>
      <div class="detail-item"><div class="detail-label">Date Sent</div><div class="detail-value">${fmtDate(letter.date_sent)}</div></div>
      <div class="detail-item"><div class="detail-label">Dispatch Mode</div><div class="detail-value">${DISPATCH_LABELS[letter.dispatch_mode] || '—'}</div></div>
      ${(letter.file_name && attachmentUrl) ? `<div class="detail-item" style="grid-column:span 2;"><div class="detail-label">Attachment</div><div class="detail-value"><a href="${attachmentUrl}" target="_blank" rel="noopener noreferrer" style="color:var(--green);text-decoration:underline;">📎 ${letter.file_name}</a></div></div>` : ''}
      ${letter.notes ? `<div class="detail-item" style="grid-column:span 2;"><div class="detail-label">Notes</div><div class="detail-value">${letter.notes}</div></div>` : ''}
    </div>
    <div style="border-top:1px solid var(--border);padding-top:1.2rem;">
      <div style="font-size:.82rem;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);margin-bottom:1rem;">Audit Trail</div>
      <div class="timeline">
        ${(letter.audit_trail || []).map((t, i) => `
          <div class="timeline-item">
            ${i < (letter.audit_trail.length - 1) ? '<div class="timeline-line"></div>' : ''}
            <div class="timeline-dot"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></div>
            <div class="timeline-content">
              <div class="timeline-action">${t.action}</div>
              <div class="timeline-meta">By ${t.actor?.full_name || '—'} · ${fmtDateTime(t.created_at)}</div>
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

// ── Mark sent ─────────────────────────────────────────────────
async function markSent(id) {
  if (!confirm('Mark this letter as sent?')) return;
  const res = await apiFetch(`/letters/${id}/mark-outgoing-sent`, {
    method: 'POST',
    body: JSON.stringify({ remarks: '' }),
  });
  if (res.ok) { showToast('Letter marked as sent', 'success'); loadLetters(); }
  else { const e = await res.json(); showToast(e.detail || 'Failed', 'error'); }
}

// ── Log new outgoing ──────────────────────────────────────────
if (!canLog()) document.getElementById('logBtnWrap').style.display = 'none';

document.getElementById('openLogBtn')?.addEventListener('click', () => {
  document.getElementById('logForm').reset();
  document.getElementById('fileUploadName').classList.remove('show');
  document.getElementById('logAlert').classList.add('hidden');
  document.getElementById('f_date_sent').value = new Date().toISOString().slice(0, 10);
  updateDispatchContactTab();
  openModal('logModal');
});

dispatchModeEl?.addEventListener('change', updateDispatchContactTab);

document.getElementById('f_file').addEventListener('change', (e) => {
  const name = e.target.files[0]?.name;
  const el   = document.getElementById('fileUploadName');
  el.textContent = name || '';
  el.classList.toggle('show', !!name);
});

document.getElementById('logSubmitBtn').addEventListener('click', async () => {
  const btn   = document.getElementById('logSubmitBtn');
  const alert = document.getElementById('logAlert');

  const subject        = document.getElementById('f_subject').value.trim();
  const recipient_name = document.getElementById('f_recipient_name').value.trim();
  const dispatch_mode  = document.getElementById('f_dispatch_mode').value;
  const recipient_email = emailInputEl.value.trim();
  const recipient_whatsapp = whatsappInputEl.value.trim();

  if (!subject || !recipient_name || !dispatch_mode) {
    showAlert(alert, 'Please fill in all required fields.');
    return;
  }
  if (dispatch_mode === 'EMAIL' && !recipient_email) {
    showAlert(alert, 'Please enter the recipient email address.');
    return;
  }
  if (dispatch_mode === 'WHATSAPP' && !recipient_whatsapp) {
    showAlert(alert, 'Please enter the recipient WhatsApp number.');
    return;
  }

  btn.classList.add('loading');
  hideAlert(alert);

  try {
    const fd = new FormData();
    fd.append('subject',          subject);
    fd.append('recipient_name',   recipient_name);
    fd.append('dispatch_mode',    dispatch_mode);
    fd.append('reference_number', document.getElementById('f_reference').value.trim());
    fd.append('recipient_org',    document.getElementById('f_recipient_org').value.trim());
    const baseNotes = document.getElementById('f_notes').value.trim();
    const channelContact = dispatch_mode === 'EMAIL'
      ? `Dispatch email: ${recipient_email}`
      : dispatch_mode === 'WHATSAPP'
        ? `Dispatch WhatsApp: ${recipient_whatsapp}`
        : '';
    fd.append('notes', [baseNotes, channelContact].filter(Boolean).join('\n'));
    const ds = document.getElementById('f_date_sent').value;
    if (ds) fd.append('date_sent', ds);

    const fileInput = document.getElementById('f_file');
    if (fileInput.files[0]) fd.append('file', fileInput.files[0]);

    const res = await fetch(`${API}/letters/outgoing`, {
      method:  'POST',
      headers: Auth.formHeaders(),
      body:    fd,
    });

    if (!res.ok) {
      const err = await res.json();
      showAlert(alert, err.detail || 'Failed to save letter.');
      return;
    }

    showToast('Outgoing letter logged!', 'success');
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

loadLetters();
