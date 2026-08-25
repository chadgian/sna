(() => {
  const TYPE_META = {
    profile_added: { icon: 'fa-user-plus', label: 'Profile' },
    profile_updated: { icon: 'fa-user-pen', label: 'Profile' },
    profile_removed: { icon: 'fa-user-minus', label: 'Profile' },
    friendship_added: { icon: 'fa-link', label: 'Friendship' },
    friendship_removed: { icon: 'fa-link-slash', label: 'Friendship' }
  };

  function installActivityUi() {
    if (document.getElementById('activityLogBtn')) return;

    const navbar = document.querySelector('.app-navbar .container-fluid');
    const live = navbar?.querySelector('.live-pill');
    if (navbar) {
      const actions = document.createElement('div');
      actions.className = 'nav-status-actions';
      if (live) actions.appendChild(live);
      actions.insertAdjacentHTML('beforeend', `
        <button class="activity-log-btn" id="activityLogBtn" type="button" data-bs-toggle="offcanvas" data-bs-target="#activityLogPanel" aria-controls="activityLogPanel">
          <i class="fa-solid fa-clock-rotate-left"></i><span>Activity</span>
        </button>`);
      navbar.appendChild(actions);
    }

    document.body.insertAdjacentHTML('beforeend', `
      <div class="offcanvas offcanvas-end activity-panel" tabindex="-1" id="activityLogPanel" aria-labelledby="activityLogTitle">
        <div class="offcanvas-header activity-panel-header">
          <div>
            <div class="eyebrow">Network history</div>
            <h5 class="offcanvas-title" id="activityLogTitle">Recent activity</h5>
          </div>
          <div class="d-flex align-items-center gap-2">
            <button class="btn btn-light btn-sm border" id="refreshActivityBtn" type="button" title="Refresh activity"><i class="fa-solid fa-rotate"></i></button>
            <button type="button" class="btn-close" data-bs-dismiss="offcanvas" aria-label="Close"></button>
          </div>
        </div>
        <div class="offcanvas-body activity-panel-body">
          <div id="activityLogList" class="activity-list">
            <div class="activity-loading"><span class="spinner-border spinner-border-sm"></span> Loading activity…</div>
          </div>
        </div>
      </div>`);

    document.getElementById('activityLogPanel')?.addEventListener('show.bs.offcanvas', loadActivities);
    document.getElementById('refreshActivityBtn')?.addEventListener('click', loadActivities);
  }

  function formatActivityTime(raw) {
    if (!raw) return '';
    const normalized = /Z$|[+-]\d\d:\d\d$/.test(raw) ? raw : `${raw}Z`;
    const date = new Date(normalized);
    if (Number.isNaN(date.getTime())) return raw;
    return date.toLocaleString([], {
      month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
    });
  }

  async function loadActivities() {
    const list = document.getElementById('activityLogList');
    if (!list) return;
    list.innerHTML = '<div class="activity-loading"><span class="spinner-border spinner-border-sm"></span> Loading activity…</div>';
    try {
      const rows = await api('/api/activities?limit=60');
      if (!rows.length) {
        list.innerHTML = '<div class="activity-empty"><i class="fa-regular fa-clock"></i><strong>No activity yet</strong><span>New profile, interest, and friendship changes will appear here.</span></div>';
        return;
      }
      list.innerHTML = rows.map(row => {
        const meta = TYPE_META[row.type] || { icon: 'fa-pen-to-square', label: 'Change' };
        return `
          <article class="activity-item">
            <div class="activity-icon ${escapeHtml(row.type)}"><i class="fa-solid ${meta.icon}"></i></div>
            <div class="activity-copy">
              <div class="activity-message">${escapeHtml(row.message)}</div>
              <div class="activity-meta"><span>${meta.label}</span><span>•</span><time>${escapeHtml(formatActivityTime(row.created_at))}</time></div>
            </div>
          </article>`;
      }).join('');
    } catch (error) {
      list.innerHTML = `<div class="activity-empty"><i class="fa-solid fa-triangle-exclamation"></i><strong>Could not load activity</strong><span>${escapeHtml(error.message)}</span></div>`;
    }
  }

  window.refreshActivityLog = loadActivities;
  installActivityUi();
})();
