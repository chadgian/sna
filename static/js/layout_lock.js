(() => {
  let layoutLocked = false;
  let activeNetwork = null;
  let lockTimer = null;
  let manualMoving = false;
  let settleTimer = null;
  let preservedView = null;

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

    target.setOptions({
      physics: {
        enabled: true,
        stabilization: false,
        barnesHut: {
          gravitationalConstant: -3200,
          springLength: 120,
          springConstant: .035,
          damping: .18
        }
      }
    });
    target.startSimulation();
  }

  function endManualMove() {
    const target = network;
    if (!target || !manualMoving) return;

    // Keep physics alive for a short natural settle after release, then freeze.
    // The camera itself is never moved by this process.
    settleTimer = setTimeout(() => lockCurrentNetwork(target), 520);
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
      target.once('stabilized', () => lockCurrentNetwork(target));
      lockTimer = setTimeout(() => lockCurrentNetwork(target), 1800);
    }
    return result;
  };

  const watchForNetwork = setInterval(() => {
    if (!network || network === activeNetwork) return;
    activeNetwork = network;
    layoutLocked = false;
    manualMoving = false;
    preservedView = null;
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
