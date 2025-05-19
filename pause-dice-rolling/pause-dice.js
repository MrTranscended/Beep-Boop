const MODULE_ID = "pause-dice-rolling";

Hooks.once('init', () => {
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

Hooks.on("chatMessage", async (chatLog, message) => {
  if (!game.user.isGM) return;

  const parts = message.trim().split(/\s+/);
  if (parts[0] !== "/pausedice") return;

  const notify = ui.notifications.info;
  const warn = ui.notifications.warn;
  const command = parts[1];
  const argument = parts.slice(2).join(" ").trim();
  let locked = game.settings.get(MODULE_ID, "lockedPlayers") || [];

  switch (command) {
    case "pause":
      game.togglePause(true);
      notify("Game paused. Dice are now frozen.");
      break;

    case "unpause":
      game.togglePause(false);
      notify("Game unpaused. Dice are enabled again.");
      break;

    case "lock": {
      const user = game.users.find(u => u.name === argument);
      if (!user) {
        warn(`User "${argument}" not found.`);
        return false;
      }
      if (locked.includes(user.id)) {
        warn(`User "${user.name}" is already locked.`);
      } else {
        locked.push(user.id);
        await game.settings.set(MODULE_ID, "lockedPlayers", locked);
        notify(`Locked dice rolls for ${user.name}.`);
      }
      break;
    }

    case "unlock": {
      const user = game.users.find(u => u.name === argument);
      if (!user) {
        warn(`User "${argument}" not found.`);
        return false;
      }
      const idx = locked.indexOf(user.id);
      if (idx === -1) {
        warn(`User "${user.name}" is already unlocked.`);
      } else {
        locked.splice(idx, 1);
        await game.settings.set(MODULE_ID, "lockedPlayers", locked);
        notify(`Unlocked dice rolls for ${user.name}.`);
      }
      break;
    }

    default:
      warn("Usage: /pausedice [pause|unpause|lock <name>|unlock <name>]");
      break;
  }

  return false;
});

Hooks.on("getSceneControlButtons", (controls) => {
  if (!game.user.isGM) return;

  const tokenControls = controls.find(c => c.name === "token");
  if (!tokenControls || !tokenControls.tools) return;

  const locked = game.settings.get(MODULE_ID, "lockedPlayers") || [];

  // Pause toggle
  tokenControls.tools.push({
    name: "pauseDiceRolling",
    title: "Pause Dice Rolling (Toggle Game Pause)",
    icon: "fas fa-pause",
    toggle: true,
    active: game.paused,
    onClick: () => {
      const paused = !game.paused;
      game.togglePause(paused);
      ui.notifications.info(`Game ${paused ? "paused" : "unpaused"}.`);
      ui.controls.initialize(); // Refresh buttons
    }
  });

  // Lock/unlock toggles for each player
  for (const user of game.users.contents) {
    if (user.isGM) continue;

    const isLocked = locked.includes(user.id);

    tokenControls.tools.push({
      name: `lockPlayer-${user.id}`,
      title: `${isLocked ? "Unlock" : "Lock"} Dice Rolls for ${user.name}`,
      icon: isLocked ? "fas fa-lock" : "fas fa-lock-open",
      toggle: true,
      active: isLocked,
      onClick: async (toggled) => {
        let updated = [...locked];
        const idx = updated.indexOf(user.id);

        if (toggled && idx === -1) {
          updated.push(user.id);
          ui.notifications.info(`Locked rolls for ${user.name}.`);
        } else if (!toggled && idx !== -1) {
          updated.splice(idx, 1);
          ui.notifications.info(`Unlocked rolls for ${user.name}.`);
        }

        await game.settings.set(MODULE_ID, "lockedPlayers", updated);
        ui.controls.initialize(); // Refresh UI buttons
      }
    });
  }
});