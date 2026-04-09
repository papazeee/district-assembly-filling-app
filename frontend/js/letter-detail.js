/* ═══════════════════════════════════════════════════════════
   letter-detail.js  |  Standalone letter detail page logic
   ═══════════════════════════════════════════════════════════ */

Auth.guard();
document.addEventListener('DOMContentLoaded', () => initSidebar(''));

const params   = new URLSearchParams(window.location.search);
const letterId = params.get('id');

async function loadLetter() {
  const skeleton = document.getElementById('letterSkeleton');
  const detail   = document.getElementById('letterDetail');
  const errorEl  = document.getElementById('letterError');

  if (!letterId) {
    skeleton.hidden = true;
    errorEl.querySelector('#letterErrorMsg').textContent = 'No letter ID provided.';
    errorEl.classList.remove('hidden');
    return;
  }

  try {
    const res = await apiFetch(`/letters/${letterId}`);
    if (!res || !res.ok) {
      throw new Error('Not found');
    }
    const letter = await res.json();

    document.getElementById('headerTitle').textContent = letter.serial_number;
    document.getElementById('detailSerial').textContent  = letter.serial_number;
    document.getElementById('detailSubject').textContent = letter.subject;
    document.getElementById('detailStatusBadge').innerHTML = statusBadge(letter.status);
    document.getElementById('detailRef').textContent    = letter.reference_number || '—';
    document.getElementById('detailDate').textContent   = fmtDate(letter.date_received || letter.date_sent || letter.created_at);
    document.getElementById('detailSender').textContent = letter.sender_name || '—';
    document.getElementById('detailOrg').textContent    = letter.sender_org || '—';
    document.getElementById('detailDept').textContent   = letter.assigned_department?.name || '—';
    document.getElementById('detailType').innerHTML     = typeBadge(letter.letter_type);

    if (letter.notes) {
      document.getElementById('detailNotesWrap').style.display = '';
      document.getElementById('detailNotes').textContent = letter.notes;
    }

    const attachUrl = buildUploadUrl(letter.file_path);
    if (letter.file_name && attachUrl) {
      document.getElementById('detailAttachWrap').style.display = '';
      const a = document.getElementById('detailAttach');
      a.textContent = `📎 ${letter.file_name}`;
      a.href = attachUrl;
    }

    const trail = letter.audit_trail || [];
    document.getElementById('detailTimeline').innerHTML = trail.length === 0
      ? '<p style="color:var(--muted);font-size:.85rem;">No trail entries yet.</p>'
      : trail.map((t, i) => `
          <div class="timeline-item">
            ${i < trail.length - 1 ? '<div class="timeline-line"></div>' : ''}
            <div class="timeline-dot ${i === 0 ? 'gold' : ''}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <div class="timeline-content">
              <div class="timeline-action">${t.action}</div>
              <div class="timeline-meta">By ${t.actor?.full_name || '—'} &middot; ${fmtDateTime(t.created_at)}</div>
              ${t.remarks ? `<div class="timeline-remark">"${t.remarks}"</div>` : ''}
            </div>
          </div>`).join('');

    skeleton.hidden = true;
    detail.hidden   = false;

  } catch (err) {
    skeleton.hidden = true;
    document.getElementById('letterErrorMsg').textContent = 'Letter not found or you do not have access.';
    errorEl.classList.remove('hidden');
  }
}

loadLetter();
