// Create and append the pause status indicator to the document body
const pauseStatusElement = document.createElement('div');
pauseStatusElement.id = 'pause-dice-status';
pauseStatusElement.innerText = 'Dice Rolling Paused';
document.body.appendChild(pauseStatusElement);

// Object to track paused status and player-specific locks
let diceRollingPaused = false;
let lockedPlayers = {};

// GM can pause/unpause dice rolling for all players
function toggleDicePause() {
  diceRollingPaused = !diceRollingPaused;
  updatePauseStatusIndicator(diceRollingPaused);

  // Notify players about dice pause status
  game.socket.emit('module.pause-dice-rolling', { paused: diceRollingPaused });
}

// GM can lock/unlock dice rolling for specific players
function togglePlayerRollLock(playerId) {
  lockedPlayers[playerId] = !lockedPlayers[playerId];

  // Notify the player about their locked/unlocked status
  game.socket.emit('module.pause-dice-rolling', { lockedPlayer: playerId, isLocked: lockedPlayers[playerId] });
}

// Update the visual pause status indicator for all players
function updatePauseStatusIndicator(paused) {
  if (paused) {
    pauseStatusElement.classList.add('paused');
    ui.notifications.info("Dice rolling is paused.");
  } else {
    pauseStatusElement.classList.remove('paused');
    ui.notifications.info("Dice rolling is resumed.");
  }
}

// Wait for Foundry to be fully initialized before adding hooks and socket events
Hooks.once('ready', () => {

  // Use the preCreateChatMessage hook to block the dice roll
  Hooks.on('preCreateChatMessage', (message, options, userId) => {
    const user = game.users.get(userId);

    // Block the roll if globally paused or if the specific player is locked
    if (diceRollingPaused || lockedPlayers[userId]) {
      console.log(`Player ${user.name} cannot roll dice - dice rolling is paused or locked.`);
      ui.notifications.error(`Dice rolling is paused for ${user.name}.`);
      return false; // Prevent the dice roll from being created
    }

    return true; // Allow the roll
  });

  // Handle socket events to synchronize dice pause status across all players
  game.socket.on('module.pause-dice-rolling', (data) => {
    if (data.paused !== undefined) {
      diceRollingPaused = data.paused;
      updatePauseStatusIndicator(diceRollingPaused);
    }

    if (data.lockedPlayer !== undefined) {
      lockedPlayers[data.lockedPlayer] = data.isLocked;
    }
  });

  // Add controls for the GM to pause/unpause dice rolling and lock/unlock player rolls
  Hooks.on('getSceneControlButtons', (controls) => {
    if (!game.user.isGM) return;

    controls.push({
      name: 'pauseDiceRolling',
      title: 'Pause Dice Rolling',
      icon: 'fas fa-pause',
      onClick: toggleDicePause,
      toggle: true,
      active: diceRollingPaused
    });

    game.users.forEach((user) => {
      if (!user.isGM) {
        controls.push({
          name: `lockRolls-${user.id}`,
          title: `Lock Rolls for ${user.name}`,
          icon: 'fas fa-lock',
          onClick: () => togglePlayerRollLock(user.id),
          toggle: true,
          active: !!lockedPlayers[user.id]
        });
      }
    });
  });
});
