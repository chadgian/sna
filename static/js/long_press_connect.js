(() => {
  let attachedNetwork = null;
  let suppressNextClick = false;
  let changingFriendship = false;

  function areFriends(a, b) {
    const key = edgeKey(a, b);
    return graphData.edges.some(edge => edgeKey(edge.from, edge.to) === key);
  }

  async function toggleFriendshipByLongPress(targetId) {
    const sourceId = selectedNodeId === null ? null : Number(selectedNodeId);
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
      const method = alreadyFriends ? 'DELETE' : 'POST';
      await api('/api/friendships', {
        method,
        body: JSON.stringify({ user1_id: sourceId, user2_id: target })
      });

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

  function installNetworkGestures(target) {
    if (!target || target === attachedNetwork) return;
    attachedNetwork = target;
    suppressNextClick = false;

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
      toggleFriendshipByLongPress(Number(params.nodes[0]));
      setTimeout(() => { suppressNextClick = false; }, 700);
    });
  }

  const originalLoadGraphData = loadGraphData;
  loadGraphData = async function(...args) {
    const result = await originalLoadGraphData.apply(this, args);
    installNetworkGestures(network);
    return result;
  };

  const watcher = setInterval(() => installNetworkGestures(network), 250);
  window.addEventListener('beforeunload', () => clearInterval(watcher), { once: true });
})();
