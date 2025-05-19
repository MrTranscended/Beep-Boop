// pause-dice.js
// Module to pause dice rolling and lock specific players, compatible with Foundry V13+.

const MODULE_ID = "pause-dice-rolling";

Hooks.once('init', () => {
  // Register persistent settings (world scope)
  game.settings.register(MODULE_ID, "paused", {
    name: "Paused Dice Rolling",
    scope: "world",
    config: false,
    type: Boolean,
    default: false
  });
  game.settings.register(MODULE_ID, "lockedPlayers", {
    name: "Locked Players",
    scope: "world",
    config: false,
    type: Array,
    default: []
  });

  // Wrap ChatMessage.create to block rolls when paused or locked
  libWrapper.register(MODULE_ID, "ChatMessage.create", async function (original, data, options) {
    // Block if the game is paused and user is not GM
    if (game.paused && !game.user.isGM) {
      if (game.user) ui.notifications.warn("Dice rolling is currently paused.");
      return;
    }
    // Block if user is locked
    const locked = game.settings.get(MODULE_ID, "lockedPlayers") || [];
    if (locked.includes(game.userId)) {
      ui.notifications.warn("You are locked from rolling dice.");
      return;
    }
    // Allow creation
    return original(data, options);
  }, "WRAPPER");
});

Hooks.once('ready', () => {
  // Re-apply paused state on load if saved and if current user is GM
  const shouldBePaused = game.settings.get(MODULE_ID, "paused");
  if (shouldBePaused && game.user.isGM && !game.paused) {
    game.togglePause(true); // Broadcasts to all clients
  }
});

Hooks.on("pauseGame", (paused, options) => {
  // Update stored paused state when toggled (GM only)
  if (game.user.isGM) {
    game.settings.set(MODULE_ID, "paused", paused);
  }
});

Hooks.on("chatMessage", (chatLog, message, chatData) => {
  // Only process GM commands
  if (!game.user.isGM) return;

  const parts = message.trim().split(/\s+/);
  if (parts[0] === "/pausedice") {
    // Prevent the message from appearing in chat
    let notify = ui.notifications.info;
    switch (parts[1]) {
      case "pause":
        game.togglePause(true);
        notify("Game paused. Dice are now frozen.");
        break;
      case "unpause":
        game.togglePause(false);
        notify("Game unpaused. Dice are enabled again.");
        break;
      case "lock":
      case "unlock": {
        // Expect a player name argument
        const name = parts.slice(2).join(" ");
        const user = game.users.find(u => u.name === name);
        if (!user) {
          ui.notifications.warn(`User "${name}" not found.`);
          return false;
        }
        const locked = game.settings.get(MODULE_ID, "lockedPlayers") || [];
        const isLock = parts[1] === "lock";
        const idx = locked.indexOf(user.id);
        if (isLock && idx === -1) {
          locked.push(user.id);
          game.settings.set(MODULE_ID, "lockedPlayers", locked);
          notify(`Locked dice rolls for ${user.name}.`);
        } else if (!isLock && idx !== -1) {
          locked.splice(idx, 1);
          game.settings.set(MODULE_ID, "lockedPlayers", locked);
          notify(`Unlocked dice rolls for ${user.name}.`);
        } else {
          ui.notifications.warn(`User "${user.name}" is already ${isLock ? "" : "un"}locked.`);
        }
        break;
      }
      default:
        // Not a recognized command
        break;
    }
    // Do not display the command message
    return false;
  }
});

Hooks.on("preCreateDocument", (doc, data, options, userId) => {
  // Intercept ChatMessage creation before saving
  if (doc.documentName !== "ChatMessage") return;

  // Only block if this message contains a dice roll
  if (!(data.rolls && data.rolls.length)) return;

  // If paused and not GM, cancel the message
  const user = game.users.get(userId);
  if (game.paused && (!user || !user.isGM)) {
    if (userId === game.userId) ui.notifications.warn("Dice rolling is currently paused.");
    return false;
  }
  // If user is locked, cancel the message
  const locked = game.settings.get(MODULE_ID, "lockedPlayers") || [];
  if (locked.includes(userId)) {
    if (userId === game.userId) ui.notifications.warn("You are locked from rolling dice.");
    return false;
  }
});