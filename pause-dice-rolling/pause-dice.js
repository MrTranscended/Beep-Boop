const MODULE_ID = "pause-dice-rolling";

Hooks.once('init', () => {
  // Persistent world settings
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

  // Wrap ChatMessage.create to block messages when paused or locked
  libWrapper.register(MODULE_ID, "ChatMessage.create", async function (wrapped, data, options) {
    const userId = game.userId;
    const isGM = game.user?.isGM;

    const locked = game.settings.get(MODULE_ID, "lockedPlayers") || [];

    if (!isGM && game.paused) {
      ui.notifications.warn("Dice rolling is currently paused.");
      return;
    }

    if (!isGM && locked.includes(userId)) {
      ui.notifications.warn("You are locked from rolling dice.");
      return;
    }

    return wrapped(data, options);
  }, "WRAPPER");
});

Hooks.once('ready', () => {
  const shouldBePaused = game.settings.get(MODULE_ID, "paused");
  if (shouldBePaused && game.user.isGM && !game.paused) {
    game.togglePause(true);
  }
});

Hooks.on("pauseGame", (paused) => {
  if (game.user.isGM) {
    game.settings.set(MODULE_ID, "paused", paused);
  }
});

Hooks.on("chatMessage", (chatLog, message) => {
  if (!game.user.isGM) return;

  const parts = message.trim().split(/\s+/);
  if (parts[0] !== "/pausedice") return;

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
      ui.notifications.warn("Usage: /pausedice [pause|unpause|lock <name>|unlock <name>]");
      break;
  }

  return false; // Prevent message from appearing in chat
});