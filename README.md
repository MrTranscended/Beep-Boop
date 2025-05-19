Pause Dice Rolling (Foundry VTT v13+)

The updated module uses the Foundry v13 APIs for pausing the game and persisting data. It registers a world-level setting to store the paused state and an array of locked player IDs, ensuring the state survives reloads. When the GM toggles pause or issues a chat command, the setting is updated. On game load, the GM’s client re-applies the paused state if needed. Dice-roll messages are intercepted via the preCreateDocument hook, allowing the module to cancel chat messages that contain rolls when the game is paused or the rolling user is locked. The GM’s commands (e.g. /pausedice pause / unpause / lock <name> / unlock <name>) are handled in the chatMessage hook, updating settings and broadcasting as appropriate. 

We use the libWrapper library to safely wrap core functionality (here, ChatMessage.create) rather than monkey-patching directly. This ensures compatibility with other modules and systems. The module code also uses game.settings.register (scope "world") for persistence. 
In summary, the module cleanly integrates with Foundry v13 hooks and data APIs:
- Pausing: Use game.togglePause(true/false) to pause/unpause; hook into Hooks.on("pauseGame") to update settings.
- Blocking Rolls: In Hooks.on("preCreateDocument") for ChatMessage, check game.paused and lockedPlayers before allowing creation.
- Locking Players: GM can /pausedice lock username or /unlock username in chat (intercepted by Hooks.on("chatMessage")) to add/remove user 
- IDs in settings.
- Persistence: The paused flag and lockedPlayers list are saved via game.settings so they persist across sessions.
