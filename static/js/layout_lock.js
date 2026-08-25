(() => {
  let layoutLocked = false;
  let activeNetwork = null;
  let lockTimer = null;

  function captureLayout() {
    if (!network || !layoutLocked) return null;
    return {
      positions: network.getPositions(),
      viewPosition: network.getViewPosition(),
      scale: network.getScale()
    };
  }

  function restoreLayout(snapshot) {
    if (!snapshot || !network || !layoutLocked) return;

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
    activeNetwork = target;
  }

  const originalRenderVisualState = renderVisualState;
  renderVisualState = function(...args) {
    const snapshot = captureLayout();
    if (layoutLocked && network) network.setOptions({ physics: false });
    const result = originalRenderVisualState.apply(this, args);
    restoreLayout(snapshot);
    return result;
  };

  const originalLoadGraphData = loadGraphData;
  loadGraphData = async function(...args) {
    layoutLocked = false;
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

  // Clicking a person is a visual inspection action only. Once the initial
  // layout has stabilized, prevent physics from waking up before the regular
  // click handler updates colors, edges, and suggestion links.
  const watchForNetwork = setInterval(() => {
    if (!network || network === activeNetwork) return;
    activeNetwork = network;
    layoutLocked = false;
    network.once('stabilized', () => lockCurrentNetwork(network));
  }, 250);

  window.addEventListener('beforeunload', () => {
    clearInterval(watchForNetwork);
    if (lockTimer) clearTimeout(lockTimer);
  }, { once: true });
})();
