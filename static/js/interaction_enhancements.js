(() => {
  let attachedNetwork = null;
  let tooltipSuppressedUntil = 0;

  const previousRenderVisualState = renderVisualState;
  renderVisualState = function(...args) {
    const result = previousRenderVisualState.apply(this, args);
    if (!nodeSet || !edgeSet || selectedNodeId === null) return result;

    const source = Number(selectedNodeId);
    const suggestions = activeSuggestions.slice(0, 3);
    const suggestedIds = new Set(suggestions.map(item => Number(item.id)));
    const realEdges = new Set(graphData.edges.map(edge => edgeKey(edge.from, edge.to)));

    suggestions.forEach(item => {
      const id = Number(item.id);
      if (id === source || highlightedNodes.has(id)) return;
      nodeSet.update({
        id,
        hidden: false,
        borderWidth: 2,
        color: {
          background: '#eef8f1',
          border: '#b9d8c2',
          highlight: { background: '#e5f4e9', border: '#93c2a1' }
        },
        font: { color: '#587061' }
      });
    });

    const dashed = suggestions
      .filter(item => !realEdges.has(edgeKey(source, item.id)))
      .map(item => ({
        id: `suggest:${edgeKey(source, item.id)}`,
        from: source,
        to: Number(item.id),
        width: 1.15,
        dashes: [5, 7],
        hidden: false,
        color: { color: 'rgba(91,137,108,.48)', highlight: 'rgba(62,118,84,.68)' },
        smooth: { enabled: true, type: 'curvedCW', roundness: .08 },
        chosen: false,
        shadow: false
      }));
    if (dashed.length) edgeSet.update(dashed);

    if (focusConnectedOnly) {
      suggestedIds.forEach(id => nodeSet.update({ id, hidden: false }));
    }
    return result;
  };

  function installInteractionHandlers(target) {
    if (!target || target === attachedNetwork) return;
    attachedNetwork = target;

    target.off('hoverNode');
    target.off('blurNode');
    target.off('dragStart');
    target.off('dragEnd');

    target.on('hoverNode', params => {
      if (graphDragging || Date.now() < tooltipSuppressedUntil) return;
      showTooltip(params.node);
    });

    target.on('blurNode', () => {
      if (!graphDragging) hideTooltip();
    });

    target.on('dragStart', params => {
      graphDragging = true;
      hideTooltip();
      const movingNode = Boolean(params.nodes?.length);
      if (movingNode) {
        tooltipSuppressedUntil = Date.now() + 1200;
        window.graphLayoutController?.beginManualMove();
      }
    });

    target.on('dragEnd', params => {
      const movedNode = Boolean(params.nodes?.length);
      graphDragging = false;
      hideTooltip();
      tooltipSuppressedUntil = Date.now() + (movedNode ? 800 : 220);
      if (movedNode) window.graphLayoutController?.endManualMove();
    });
  }

  const originalLoadGraphData = loadGraphData;
  loadGraphData = async function(...args) {
    const result = await originalLoadGraphData.apply(this, args);
    installInteractionHandlers(network);
    return result;
  };

  const watcher = setInterval(() => installInteractionHandlers(network), 250);
  window.addEventListener('beforeunload', () => clearInterval(watcher), { once: true });
})();
