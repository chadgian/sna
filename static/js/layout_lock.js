(() => {
  let layoutLocked = false;
  let activeNetwork = null;
  let lockTimer = null;
  let reflowing = false;

  function captureLayout() {
    if (!network || !layoutLocked || reflowing) return null;
    return {
      positions: network.getPositions(),
      viewPosition: network.getViewPosition(),
      scale: network.getScale()
    };
  }

  function restoreLayout(snapshot) {
    if (!snapshot || !network || !layoutLocked || reflowing) return;
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
    target.setOptions({ physics: false });
    if (typeof target.storePositions === 'function') target.storePositions();
    layoutLocked = true;
    reflowing = false;
    activeNetwork = target;
  }

  function reflowAfterManualMove() {
    const target = network;
    if (!target || reflowing) return;
    reflowing = true;
    layoutLocked = false;

    const viewPosition = target.getViewPosition();
    const scale = target.getScale();
    let finished = false;

    const finish = () => {
      if (finished || network !== target) return;
      finished = true;
      lockCurrentNetwork(target);
      target.moveTo({ position: viewPosition, scale, animation: false });
    };

    target.setOptions({
      physics: {
        enabled: true,
        stabilization: {
          enabled: true,
          iterations: 90,
          updateInterval: 20,
          fit: false
        }
      }
    });
    target.once('stabilized', finish);
    target.stabilize(90);
    setTimeout(finish, 1400);
  }

  const originalRenderVisualState = renderVisualState;
  renderVisualState = function(...args) {
    const snapshot = captureLayout();
    if (layoutLocked && network && !reflowing) network.setOptions({ physics: false });
    const result = originalRenderVisualState.apply(this, args);
    restoreLayout(snapshot);
    return result;
  };

  const originalLoadGraphData = loadGraphData;
  loadGraphData = async function(...args) {
    layoutLocked = false;
    reflowing = false;
    if (lockTimer) clearTimeout(lockTimer);

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
    reflowing = false;
    network.once('stabilized', () => lockCurrentNetwork(network));
  }, 250);

  window.graphLayoutController = {
    reflowAfterManualMove,
    lock: () => lockCurrentNetwork(network),
    isLocked: () => layoutLocked,
    isReflowing: () => reflowing
  };

  window.addEventListener('beforeunload', () => {
    clearInterval(watchForNetwork);
    if (lockTimer) clearTimeout(lockTimer);
  }, { once: true });
})();
