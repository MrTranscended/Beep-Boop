// pause-dice.js

// Hook into Foundry initialization to register settings and wrappers
Hooks.once('init', () => {
  // Register a world-scoped setting to store locked-user flags
  game.settings.register('pause-dice-rolling', 'lockedUsers', {
    name: 'Locked Players',
    scope: 'world',
    type: Object,
    default: {},
    config: false
  });

  // Ensure libWrapper is available and wrap ChatMessage.create
  if (!globalThis.libWrapper) {
    console.error("pause-dice: libWrapper is not installed!");
    return;
  }
  libWrapper.register('pause-dice-rolling', 'ChatMessage.create', (wrapped, data, options, userId) => {
    // Retrieve the locked-users object from settings
    const locked = game.settings.get('pause-dice-rolling', 'lockedUsers') || {};
    // Check if this message contains a dice roll
    const hasRoll = Array.isArray(data.rolls) && data.rolls.length;
    if (hasRoll) {
      // If game is paused and the user is not GM, block the roll
      if (game.paused && !game.user.isGM) {
        ui.notifications.warn("Dice rolling is currently paused.");
        return; // Cancel message creation
      }
      // If the rolling user is locked (and not a GM), block the roll
      if (!game.user.isGM && locked[game.user.id]) {
        ui.notifications.warn("Your dice are locked. A GM must unlock you to roll.");
        return;
      }
    }
    // Otherwise allow normal behavior
    return wrapped(data, options, userId);
  }, 'MIXED');
});

// Add a custom Scene Control group with a toggle for each player
Hooks.on('getSceneControlButtons', (controls) => {
  // Only the GM should see and use this group
  const isGM = game.user.isGM;
  controls.pauseDice = {
    name: 'pauseDice',
    title: 'Pause Dice',
    icon: 'fas fa-lock',
    visible: isGM,
    tools: {},
    activeTool: null,
    // onChange for the group itself is not needed here
  };

  // Get the stored locked state
  const locked = game.settings.get('pause-dice-rolling', 'lockedUsers') || {};

  // For each non-GM user, create a toggle tool
  game.users.forEach(u => {
    if (u.isGM) return; // skip GM users
    controls.pauseDice.tools[u.id] = {
      name: u.id,
      title: u.name,
      icon: 'fas fa-user-lock',
      toggle: true,
      active: !!locked[u.id], 
      onChange: (event, active) => {
        // Update the locked state for this user
        locked[u.id] = active;
        game.settings.set('pause-dice-rolling', 'lockedUsers', locked);
        // Notify GM of the change
        ui.notifications.info(`${u.name} has been ${active ? "locked" : "unlocked"}.`);
        // Refresh controls to update the icon state
        ui.controls.render();
      }
    };
  });
});

// Handle custom chat commands like "/pausedice lock <name>"
Hooks.on('chatMessage', (chatLog, messageText, chatData) => {
  const msg = messageText.trim();
  const parts = msg.split(/\s+/);
  if (parts[0] !== '/pausedice') return;  // Not our command, ignore

  // Prevent the chat message from posting
  const sender = game.users.get(chatData.user);
  if (!sender?.isGM) {
    ui.notifications.error("Only a GM can use /pausedice commands.");
    return false;
  }

  // Parse subcommand
  const sub = (parts[1] || '').toLowerCase();
  const nameArg = parts.slice(2).join(' ');
  const locked = game.settings.get('pause-dice-rolling', 'lockedUsers') || {};

  if (sub === 'lock' || sub === 'unlock') {
    if (!nameArg) {
      ui.notifications.error(`Usage: /pausedice ${sub} <username>`);
      return false;
    }
    // Find target user by name (case-insensitive)
    const target = game.users.find(u => u.name.toLowerCase() === nameArg.toLowerCase());
    if (!target) {
      ui.notifications.error(`No user found with name "${nameArg}".`);
      return false;
    }
    if (target.isGM) {
      ui.notifications.error("Cannot lock/unlock a GM.");
      return false;
    }
    // Apply the lock or unlock
    locked[target.id] = (sub === 'lock');
    game.settings.set('pause-dice-rolling', 'lockedUsers', locked);
    ui.notifications.info(`${target.name} has been ${sub === 'lock' ? "locked" : "unlocked"} by GM.`);
    // Refresh the UI to update toggle states
    ui.controls.render();
  }
  else {
    ui.notifications.error(`Unknown /pausedice command "${sub}". Use lock or unlock.`);
  }
  return false; // Do not post the command in chat
});

// Optional: Notify GMs when the game is paused/unpaused (for clarity)
Hooks.on('pauseGame', (paused, options) => {
  if (game.user.isGM) {
    ui.notifications.info(`Game is now ${paused ? "PAUSED" : "UNPAUSED"}.`);
  }
});