// Track global state
let diceRollingPaused = false;
let lockedPlayers = {};

// Add visual indicator
Hooks.on("ready", () => {
  // Add pause status UI
  const pauseStatusElement = document.createElement('div');
  pauseStatusElement.id = 'pause-dice-status';
  pauseStatusElement.innerText = 'Dice Rolling Paused';
  pauseStatusElement.style.cssText = `
    position: fixed;
    top: 10px;
    right: 10px;
    z-index: 10000;
    padding: 5px 10px;
    background: rgba(200, 0, 0, 0.8);
    color: white;
    font-weight: bold;
    display: none;
  `;
  document.body.appendChild(pauseStatusElement);
  updatePauseStatusIndicator(diceRollingPaused);

  // Set up socket listener
  game.socket.on('module.pause-dice-rolling', (data) => {
    if (data.paused !== undefined) {
      diceRollingPaused = data.paused;
      updatePauseStatusIndicator(diceRollingPaused);
    }

    if (data.lockedPlayer !== undefined) {
      lockedPlayers[data.lockedPlayer] = data.isLocked;
    }
  });
});

// Update pause status UI
function updatePauseStatusIndicator(paused) {
  const el = document.getElementById('pause-dice-status');
  if (!el) return;
  el.style.display = paused ? 'block' : 'none';
}

// Toggle global dice rolling pause (GM only)
function toggleDicePause() {
  diceRollingPaused = !diceRollingPaused;
  updatePauseStatusIndicator(diceRollingPaused);
  game.socket.emit('module.pause-dice-rolling', { paused: diceRollingPaused });
  ui.controls.initialize(); // Refresh toolbar toggle state
}

// Toggle per-player roll lock (GM only)
function togglePlayerRollLock(playerId) {
  const isLocked = !lockedPlayers[playerId];
  lockedPlayers[playerId] = isLocked;
  game.socket.emit('module.pause-dice-rolling', {
    lockedPlayer: playerId,
    isLocked
  });
  ui.controls.initialize(); // Refresh toolbar toggle state
}

// Add controls to scene controls for the GM
Hooks.on('getSceneControlButtons', (controls) => {
  if (!game.user.isGM) return;

  const tokenControls = controls.find(c => c.name === "token");
  if (!tokenControls) return;

  tokenControls.tools.push({
    name: 'pauseDiceRolling',
    title: 'Pause Dice Rolling',
    icon: 'fas fa-pause',
    onClick: () => toggleDicePause(),
    toggle: true,
    active: diceRollingPaused
  });

  for (const user of game.users.contents) {
    if (!user.isGM) {
      tokenControls.tools.push({
        name: `lockRolls-${user.id}`,
        title: `Lock Rolls for ${user.name}`,
        icon: 'fas fa-lock',
        onClick: () => togglePlayerRollLock(user.id),
        toggle: true,
        active: !!lockedPlayers[user.id]
      });
    }
  }
});

// Use libWrapper to intercept message creation safely
Hooks.once("init", () => {
  if (game.modules.get("lib-wrapper")?.active) {
    libWrapper.register("pause-dice-rolling", "ChatMessage.create", function (wrapped, ...args) {
      const [data, options, userId] = args;
      if (!game.users.get(userId)?.isGM && (diceRollingPaused || lockedPlayers[userId])) {
        ui.notifications.warn("Dice rolling is currently paused or locked for you.");
        return null;
      }
      return wrapped(...args);
    }, "WRAPPER");
  } else {
    console.warn("Pause Dice Rolling: libWrapper not active, dice blocking won't work!");
  }
});
