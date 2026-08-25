(() => {
  const styleSafe = value => String(value ?? '');

  function bridgeAwareCommunities(data) {
    const ids = (data.nodes || []).map(n => Number(n.id));
    const names = new Map((data.nodes || []).map(n => [Number(n.id), n.label]));
    const adjacency = new Map(ids.map(id => [id, []]));

    (data.edges || []).forEach(edge => {
      const a = Number(edge.from), b = Number(edge.to);
      const key = edgeKey(a, b);
      if (!adjacency.has(a)) adjacency.set(a, []);
      if (!adjacency.has(b)) adjacency.set(b, []);
      adjacency.get(a).push({ to: b, key });
      adjacency.get(b).push({ to: a, key });
    });

    let clock = 0;
    const discovered = new Map();
    const low = new Map();
    const bridges = new Set();

    function dfs(node, parentEdge = null) {
      discovered.set(node, ++clock);
      low.set(node, discovered.get(node));
      for (const edge of adjacency.get(node) || []) {
        if (edge.key === parentEdge) continue;
        const next = edge.to;
        if (!discovered.has(next)) {
          dfs(next, edge.key);
          low.set(node, Math.min(low.get(node), low.get(next)));
          if (low.get(next) > discovered.get(node)) bridges.add(edge.key);
        } else {
          low.set(node, Math.min(low.get(node), discovered.get(next)));
        }
      }
    }

    ids.forEach(id => { if (!discovered.has(id)) dfs(id); });

    const visited = new Set();
    const groups = [];
    for (const start of ids) {
      if (visited.has(start)) continue;
      const stack = [start];
      visited.add(start);
      const members = [];
      while (stack.length) {
        const node = stack.pop();
        members.push(node);
        for (const edge of adjacency.get(node) || []) {
          if (bridges.has(edge.key) || visited.has(edge.to)) continue;
          visited.add(edge.to);
          stack.push(edge.to);
        }
      }
      groups.push(members);
    }

    groups.sort((a, b) => {
      if (b.length !== a.length) return b.length - a.length;
      const an = styleSafe(names.get(a[0])).toLowerCase();
      const bn = styleSafe(names.get(b[0])).toLowerCase();
      return an.localeCompare(bn);
    });

    return {
      groups: groups.map((members, index) => ({
        group: index + 1,
        ids: members,
        members: members.map(id => names.get(id)).sort((a, b) => styleSafe(a).localeCompare(styleSafe(b)))
      })),
      bridges
    };
  }

  function installFinder() {
    const actions = document.querySelector('.graph-heading .graph-actions');
    if (!actions || document.getElementById('graphUserSearch')) return;

    const finder = document.createElement('div');
    finder.className = 'graph-user-finder';
    finder.innerHTML = `
      <div class="input-group input-group-sm">
        <span class="input-group-text"><i class="fa-solid fa-magnifying-glass"></i></span>
        <input id="graphUserSearch" class="form-control" list="graphUserOptions" placeholder="Find user…" autocomplete="off" aria-label="Find user in graph">
        <datalist id="graphUserOptions"></datalist>
        <button class="btn btn-outline-primary" id="findGraphUserBtn" type="button" title="Highlight user and connections">
          <i class="fa-solid fa-location-crosshairs"></i>
        </button>
      </div>`;
    actions.parentNode.insertBefore(finder, actions);

    document.getElementById('findGraphUserBtn').addEventListener('click', highlightFoundUser);
    document.getElementById('graphUserSearch').addEventListener('keydown', event => {
      if (event.key === 'Enter') {
        event.preventDefault();
        highlightFoundUser();
      }
    });
    refreshFinderOptions();
  }

  function refreshFinderOptions() {
    const list = document.getElementById('graphUserOptions');
    if (!list || typeof users === 'undefined') return;
    list.innerHTML = users.map(user => `<option value="${escapeHtml(user.name)}"></option>`).join('');
  }

  function findUserByInput(value) {
    const query = String(value || '').trim().toLowerCase();
    if (!query) return null;
    return users.find(u => u.name.toLowerCase() === query)
      || users.find(u => u.name.toLowerCase().startsWith(query))
      || users.find(u => u.name.toLowerCase().includes(query));
  }

  async function highlightFoundUser() {
    const input = document.getElementById('graphUserSearch');
    const user = findUserByInput(input?.value);
    if (!user) {
      notify('No matching user was found. Choose a name from the suggestions.', 'warning');
      return;
    }

    const id = Number(user.id);
    selectedNodeId = id;
    focusConnectedOnly = false;
    activeSuggestions = [];
    highlightedNodes.clear();
    highlightedEdges.clear();

    if (document.getElementById('profileUser')) {
      document.getElementById('profileUser').value = String(id);
      updateProfilePreview();
    }
    if (document.getElementById('analysisA')) document.getElementById('analysisA').value = String(id);
    if (input) input.value = user.name;

    renderVisualState();
    await loadSuggestionEdges(id);

    if (network) {
      const currentScale = network.getScale();
      const targetScale = currentScale < 0.65
        ? Math.min(currentScale * 1.22, 0.65)
        : Math.min(currentScale * 1.04, 1.0);
      network.focus(id, {
        scale: targetScale,
        animation: { duration: 360, easingFunction: 'easeInOutQuad' }
      });
      setTimeout(() => network.selectNodes([id], false), 380);
    }
  }

  async function refreshStrongGroupStat() {
    try {
      const data = await api('/api/graph');
      const result = bridgeAwareCommunities(data);
      const tiles = document.querySelectorAll('#stats .stat-tile');
      const groupTile = tiles[2];
      if (!groupTile) return;
      const label = groupTile.querySelector('.stat-label');
      const value = groupTile.querySelector('.stat-value');
      if (label) label.textContent = 'Strong groups';
      if (value) value.textContent = result.groups.length;
      groupTile.title = 'Single bridge friendships do not merge otherwise separate social communities.';
    } catch (_) {
      // Keep the regular summary value if graph refresh is temporarily unavailable.
    }
  }

  function installBridgeAwareGroupAnalysis() {
    const button = document.getElementById('groupsBtn');
    if (!button) return;
    button.onclick = async () => {
      try {
        const data = await api('/api/graph');
        graphData = data;
        const result = bridgeAwareCommunities(data);
        beginAnalysis();
        renderVisualState();

        const bridgeNote = result.bridges.size
          ? `<div class="strong-group-note"><i class="fa-solid fa-code-branch"></i><span>${result.bridges.size} bridge-only friendship${result.bridges.size === 1 ? '' : 's'} ignored when defining groups.</span></div>`
          : `<div class="strong-group-note"><i class="fa-solid fa-circle-check"></i><span>No bridge-only ties are merging communities.</span></div>`;

        document.getElementById('result').innerHTML = `
          <div class="result-heading"><i class="fa-solid fa-people-group me-1 text-secondary"></i>Strong social groups</div>
          ${bridgeNote}
          ${result.groups.map(group => `
            <div class="group-item">
              <div class="d-flex align-items-center justify-content-between gap-2">
                <span class="badge badge-soft">Group ${group.group}</span>
                <span class="strong-group-size">${group.members.length} member${group.members.length === 1 ? '' : 's'}</span>
              </div>
              <div class="small-note mt-1">${group.members.map(escapeHtml).join(', ')}</div>
            </div>`).join('')}`;
      } catch (error) {
        notify(error.message, 'danger');
      }
    };
  }

  const originalRefreshSelects = refreshSelects;
  refreshSelects = function(...args) {
    const result = originalRefreshSelects.apply(this, args);
    refreshFinderOptions();
    return result;
  };

  const originalLoadSummary = loadSummary;
  loadSummary = async function(...args) {
    const result = await originalLoadSummary.apply(this, args);
    await refreshStrongGroupStat();
    return result;
  };

  installFinder();
  installBridgeAwareGroupAnalysis();
  setTimeout(() => {
    refreshFinderOptions();
    refreshStrongGroupStat();
  }, 250);
})();
