(() => {
  let attachedNetwork = null;
  let suppressNextClick = false;
  let changingFriendship = false;
  let pressSourceId = null;
  let clearSuppressTimer = null;
  let boundContainer = null;

  function areFriends(a, b) {
    const key = edgeKey(a, b);
    return graphData.edges.some(edge => edgeKey(edge.from, edge.to) === key);
  }

  async function toggleFriendshipByLongPress(sourceAtPress, targetId) {
    const sourceId = sourceAtPress === null || sourceAtPress === undefined
      ? null
      : Number(sourceAtPress);
    const target = Number(targetId);

    if (sourceId === null) {
      notify('Select a person first, then long-press another person.', 'warning');
      return;
    }
    if (sourceId === target) {
      notify('Long-press a different person.', 'warning');
      return;
    }
    if (changingFriendship) return;

    changingFriendship = true;
    const source = getUser(sourceId);
    const other = getUser(target);
    const friendshipKey = edgeKey(sourceId, target);
    const alreadyFriends = areFriends(sourceId, target);

    try {
      await api('/api/friendships', {
        method: alreadyFriends ? 'DELETE' : 'POST',
        body: JSON.stringify({ user1_id: sourceId, user2_id: target })
      });

      // Refresh the data only. Keep the current vis Network instance and layout.
      graphData = await api('/api/graph');
      selectedNodeId = sourceId;

      if (alreadyFriends && edgeSet) {
        edgeSet.remove(`friend:${friendshipKey}`);
      }
      if (!alreadyFriends) {
        activeSuggestions = activeSuggestions.filter(item => Number(item.id) !== target);
      }

      highlightedNodes.clear();
      highlightedEdges.clear();
      if (!alreadyFriends) highlightedEdges.add(friendshipKey);

      renderVisualState();
      if (network) network.selectNodes([sourceId], false);

      if ($('profileUser')) {
        $('profileUser').value = String(sourceId);
        updateProfilePreview();
      }
      if ($('analysisA')) $('analysisA').value = String(sourceId);

      await loadSummary();
      await loadSuggestionEdges(sourceId);

      notify(
        alreadyFriends
          ? `${source?.name || 'Selected person'} and ${other?.name || 'person'} are no longer friends.`
          : `${source?.name || 'Selected person'} and ${other?.name || 'person'} are now friends.`,
        alreadyFriends ? 'warning' : 'success'
      );

      if (!alreadyFriends) {
        setTimeout(() => {
          highlightedEdges.delete(friendshipKey);
          renderVisualState();
        }, 1300);
      }
    } catch (error) {
      notify(error.message, 'danger');
    } finally {
      changingFriendship = false;
    }
  }

  function bindPressSourceCapture() {
    const container = $('network');
    if (!container || container === boundContainer) return;
    boundContainer = container;

    container.addEventListener('pointerdown', () => {
      // Snapshot the active person before vis-network can change its own
      // internal selection as the second person is being held.
      pressSourceId = selectedNodeId === null ? null : Number(selectedNodeId);
      if (clearSuppressTimer) clearTimeout(clearSuppressTimer);
    }, true);

    const release = () => {
      if (clearSuppressTimer) clearTimeout(clearSuppressTimer);
      clearSuppressTimer = setTimeout(() => {
        suppressNextClick = false;
        pressSourceId = null;
      }, 450);
    };
    container.addEventListener('pointerup', release, true);
    container.addEventListener('pointercancel', release, true);
  }

  function installNetworkGestures(target) {
    if (!target || target === attachedNetwork) return;
    attachedNetwork = target;
    suppressNextClick = false;
    bindPressSourceCapture();

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

    target.off('hold');
    target.on('hold', params => {
      if (!params.nodes.length) return;
      suppressNextClick = true;
      const targetId = Number(params.nodes[0]);
      const sourceId = pressSourceId;
      toggleFriendshipByLongPress(sourceId, targetId);
    });
  }

  const originalLoadGraphData = loadGraphData;
  loadGraphData = async function(...args) {
    const result = await originalLoadGraphData.apply(this, args);
    installNetworkGestures(network);
    return result;
  };

  bindPressSourceCapture();
  const watcher = setInterval(() => {
    bindPressSourceCapture();
    installNetworkGestures(network);
  }, 250);

  window.addEventListener('beforeunload', () => {
    clearInterval(watcher);
    if (clearSuppressTimer) clearTimeout(clearSuppressTimer);
  }, { once: true });
})();
