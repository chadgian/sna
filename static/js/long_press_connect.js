(() => {
  let attachedNetwork = null;
  let suppressNextClick = false;
  let connecting = false;

  function areFriends(a, b) {
    const key = edgeKey(a, b);
    return graphData.edges.some(edge => edgeKey(edge.from, edge.to) === key);
  }

  async function connectByLongPress(targetId) {
    const sourceId = selectedNodeId === null ? null : Number(selectedNodeId);
    const target = Number(targetId);

    if (sourceId === null) {
      notify('Select a person first, then long-press another person to connect them.', 'warning');
      return;
    }
    if (sourceId === target) {
      notify('Long-press a different person to create a friendship.', 'warning');
      return;
    }
    if (areFriends(sourceId, target)) {
      const source = getUser(sourceId);
      const other = getUser(target);
      notify(`${source?.name || 'These users'} and ${other?.name || 'the selected person'} are already friends.`, 'warning');
      return;
    }
    if (connecting) return;

    connecting = true;
    const source = getUser(sourceId);
    const other = getUser(target);

    try {
      await api('/api/friendships', {
        method: 'POST',
        body: JSON.stringify({ user1_id: sourceId, user2_id: target })
      });

      // Refresh only graph data, not the Network instance. This keeps all
      // coordinates, zoom, and camera position exactly where they are.
      graphData = await api('/api/graph');
      selectedNodeId = sourceId;
      focusConnectedOnly = false;
      activeSuggestions = activeSuggestions.filter(item => Number(item.id) !== target);
      highlightedNodes.clear();
      highlightedEdges.clear();
      highlightedEdges.add(edgeKey(sourceId, target));

      renderVisualState();
      if (network) network.selectNodes([sourceId], false);

      await loadSummary();
      await loadSuggestionEdges(sourceId);

      notify(`${source?.name || 'Selected person'} and ${other?.name || 'person'} are now friends.`);

      // Briefly emphasize the newly-created friendship, then return to the
      // normal selected-neighborhood styling without moving the graph.
      setTimeout(() => {
        highlightedEdges.delete(edgeKey(sourceId, target));
        renderVisualState();
      }, 1300);
    } catch (error) {
      notify(error.message, 'danger');
    } finally {
      connecting = false;
    }
  }

  function installNetworkGestures(target) {
    if (!target || target === attachedNetwork) return;
    attachedNetwork = target;
    suppressNextClick = false;

    // Replace the original click handler with the same selection behavior,
    // plus suppression of a click that may be emitted after a long press.
    target.off('click');
    target.on('click', async params => {
      if (suppressNextClick) {
        suppressNextClick = false;
        return;
      }
      if (!params.nodes.length) return;

      const id = Number(params.nodes[0]);
      selectedNodeId = id;
      highlightedNodes.clear();
      highlightedEdges.clear();

      if (getUser(id)) {
        $('profileUser').value = String(id);
        updateProfilePreview();
        $('analysisA').value = String(id);
      }

      renderVisualState();
      await loadSuggestionEdges(id);
    });

    target.on('hold', params => {
      if (!params.nodes.length) return;
      suppressNextClick = true;
      const targetId = Number(params.nodes[0]);
      connectByLongPress(targetId);

      // Some devices do not emit the post-hold click. Avoid suppressing a
      // later intentional click in that case.
      setTimeout(() => { suppressNextClick = false; }, 700);
    });
  }

  const originalLoadGraphData = loadGraphData;
  loadGraphData = async function(...args) {
    const result = await originalLoadGraphData.apply(this, args);
    installNetworkGestures(network);
    return result;
  };

  // Covers the initial async load if it completes between script execution
  // and the wrapper above, as well as any externally recreated network.
  const watcher = setInterval(() => installNetworkGestures(network), 250);
  window.addEventListener('beforeunload', () => clearInterval(watcher), { once: true });
})();
