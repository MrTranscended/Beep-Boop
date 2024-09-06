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
  } else {
    pauseStatusElement.classList.remove('paused');
  }
}

// Listen for dice roll events and prevent rolling if paused or locked for specific players
Hooks.on('diceSoNiceRollStart', (message) => {
  const userId = message.userId;

  // Block the roll if globally paused or if the specific player is locked
  if (diceRollingPaused || lockedPlayers[userId]) {
    console.log(`Player ${userId} cannot roll dice - dice rolling is paused or locked.`);
    return false; // Prevent the dice roll
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
Hooks.on('renderSidebarTab', (app, html) => {
  if (!game.user.isGM) return;

  // Add a pause/unpause button to the sidebar
  const pauseButton = $(`<button class="pause-dice-button">${diceRollingPaused ? 'Unpause Dice' : 'Pause Dice'}</button>`);
  pauseButton.on('click', toggleDicePause);
  html.find('.directory-footer').append(pauseButton);

  // Add lock/unlock buttons for each player to the sidebar
  game.users.forEach((user) => {
    if (!user.isGM) {
      const lockButton = $(`<button class="lock-dice-button">${lockedPlayers[user.id] ? `Unlock Rolls for ${user.name}` : `Lock Rolls for ${user.name}`}</button>`);
      lockButton.on('click', () => togglePlayerRollLock(user.id));
      html.find('.directory-footer').append(lockButton);
    }
  });
});
