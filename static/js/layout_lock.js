(() => {
  let layoutLocked = false;
  let activeNetwork = null;
  let lockTimer = null;
  let manualMoving = false;
  let settleTimer = null;
  let preservedView = null;

  // These settings intentionally use a very weak spring force. springLength is
  // only a preferred resting distance in vis-network, not a maximum edge
  // length. Strong repulsion + low central gravity lets friendship lines stretch
  // when extra space produces a clearer, less tangled layout.
  const OPEN_LAYOUT_PHYSICS = {
    enabled: true,
    stabilization: {
      enabled: true,
      iterations: 220,
      updateInterval: 25,
      fit: true
    },
    barnesHut: {
      gravitationalConstant: -6200,
      centralGravity: 0.055,
      springLength: 220,
      springConstant: 0.007,
      damping: 0.20,
      avoidOverlap: 1
    },
    maxVelocity: 38,
    minVelocity: 0.35
  };

  const LIVE_DRAG_PHYSICS = {
    enabled: true,
    stabilization: false,
    barnesHut: {
      gravitationalConstant: -6200,
      centralGravity: 0.055,
      springLength: 220,
      springConstant: 0.007,
      damping: 0.18,
      avoidOverlap: 1
    },
    maxVelocity: 42,
    minVelocity: 0.25
  };

  function captureLayout() {
    if (!network || !layoutLocked || manualMoving) return null;
    return {
      positions: network.getPositions(),
      viewPosition: network.getViewPosition(),
      scale: network.getScale()
    };
  }

  function restoreLayout(snapshot) {
    if (!snapshot || !network || !layoutLocked || manualMoving) return;
    network.setOptions({ physics: false });
    Object.entries(snapshot.positions || {}).forEach(([id, position]) => {
      network.moveNode(Number(id), position.x, position.y);
    });
    network.moveTo({
      position: snapshot.viewPosition,
      scale: snapshot.scale,
      animation: false
    });
  }

  function lockCurrentNetwork(target) {
    if (!target || network !== target) return;
    if (settleTimer) {
      clearTimeout(settleTimer);
      settleTimer = null;
    }
    target.stopSimulation();
    target.setOptions({ physics: false });
    if (typeof target.storePositions === 'function') target.storePositions();
    if (preservedView) {
      target.moveTo({
        position: preservedView.position,
        scale: preservedView.scale,
        animation: false
      });
    }
    layoutLocked = true;
    manualMoving = false;
    preservedView = null;
    activeNetwork = target;
  }

  function beginManualMove() {
    const target = network;
    if (!target || manualMoving) return;

    manualMoving = true;
    layoutLocked = false;
    preservedView = {
      position: target.getViewPosition(),
      scale: target.getScale()
    };

    target.setOptions({ physics: LIVE_DRAG_PHYSICS });
    target.startSimulation();
  }

  function endManualMove() {
    const target = network;
    if (!target || !manualMoving) return;

    // Let the freely-spaced network react for a little while after release.
    // It is then frozen so normal selection never rearranges the graph.
    settleTimer = setTimeout(() => lockCurrentNetwork(target), 700);
  }

  const originalRenderVisualState = renderVisualState;
  renderVisualState = function(...args) {
    const snapshot = captureLayout();
    if (layoutLocked && network && !manualMoving) network.setOptions({ physics: false });
    const result = originalRenderVisualState.apply(this, args);
    restoreLayout(snapshot);
    return result;
  };

  const originalLoadGraphData = loadGraphData;
  loadGraphData = async function(...args) {
    layoutLocked = false;
    manualMoving = false;
    preservedView = null;
    if (lockTimer) clearTimeout(lockTimer);
    if (settleTimer) clearTimeout(settleTimer);

    const result = await originalLoadGraphData.apply(this, args);
    const target = network;
    activeNetwork = target;

    if (target) {
      // Override the compact core defaults immediately. This gives the first
      // layout more freedom and avoids treating edge length as a tight target.
      target.setOptions({ physics: OPEN_LAYOUT_PHYSICS });
      target.startSimulation();
      target.once('stabilized', () => lockCurrentNetwork(target));
      target.stabilize(220);
      lockTimer = setTimeout(() => lockCurrentNetwork(target), 2600);
    }
    return result;
  };

  const watchForNetwork = setInterval(() => {
    if (!network || network === activeNetwork) return;
    activeNetwork = network;
    layoutLocked = false;
    manualMoving = false;
    preservedView = null;
    network.setOptions({ physics: OPEN_LAYOUT_PHYSICS });
    network.startSimulation();
    network.once('stabilized', () => lockCurrentNetwork(network));
  }, 250);

  window.graphLayoutController = {
    beginManualMove,
    endManualMove,
    lock: () => lockCurrentNetwork(network),
    isLocked: () => layoutLocked,
    isManualMoving: () => manualMoving
  };

  window.addEventListener('beforeunload', () => {
    clearInterval(watchForNetwork);
    if (lockTimer) clearTimeout(lockTimer);
    if (settleTimer) clearTimeout(settleTimer);
  }, { once: true });
})();
