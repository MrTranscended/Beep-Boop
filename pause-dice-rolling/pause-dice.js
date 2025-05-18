// Object to track paused status and player-specific locks
let diceRollingPaused = false;
let lockedPlayers = {};

// Create the pause status element when the game is ready
Hooks.on("ready", () => {
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
});

// GM can pause/unpause dice rolling for all players
function toggleDicePause() {
  diceRollingPaused = !diceRollingPaused;
  updatePauseStatusIndicator(diceRollingPaused);

  // Notify players about dice pause status
  game.socket.emit('module.pause-dice-rolling', { paused: diceRollingPaused });
}

// GM can lock/unlock dice rolling for specific players
function togglePlayerRollLock(playerId) {
  const isLocked = !lockedPlayers[playerId];
  lockedPlayers[playerId] = isLocked;

  // Notify the player about their locked/unlocked status
  game.socket.emit('module.pause-dice-rolling', {
    lockedPlayer: playerId,
    isLocked
  });
}

// Update the visual pause status indicator for all players
function updatePauseStatusIndicator(paused) {
  const el = document.getElementById('pause-dice-status');
  if (!el) return;

  el.style.display = paused ? 'block' : 'none';
}

// Intercept chat messages to prevent dice rolls if paused or locked
Hooks.on("preCreateChatMessage", (message, options, userId) => {
  if (!game.users.get(userId)?.isGM && (diceRollingPaused || lockedPlayers[userId])) {
    console.log(`Player ${userId} attempted to roll while dice rolling is paused or locked.`);
    ui.notifications.warn("Dice rolling is currently paused or locked for you.");
    return false;
  }
  return true;
});

// Receive socket messages to update local state
Hooks.once("socketlib.ready", () => {
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

// Add controls for the GM to pause/unpause dice rolling and lock/unlock player rolls
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
