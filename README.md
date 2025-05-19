Pause Dice Module Implementation

This implementation creates a new “Pause Dice” control group in the Foundry UI and adds toggle buttons for each player. It uses the getSceneControlButtons hook to define a custom scene controls group (as recommended by the Foundry API) and libWrapper to reliably intercept dice rolls. Players’ rolls are blocked when the game is paused or when they have been locked, and GM-only commands /pausedice lock <name> and /pausedice unlock <name> are handled via the chatMessage hook. All state (which users are locked) is stored in a World setting so it persists across sessions.

- Custom Scene Control Group: We hook getSceneControlButtons to add a new control set named "pauseDice", with title “Pause Dice” and an appropriate icon. Inside it we create one toggle button per player (non-GM user). Each button is a toggle tool (toggle: true) whose active state reflects whether that player’s dice are locked. We give each tool a unique name (the user’s ID) and set its icon and title. An onChange callback is provided for each toggle so that when the GM clicks it, we update our locked-users state. For example, one can follow the pattern from the official docs and other modules, which shows how to add a tool with an onChange in the getSceneControlButtons hook.
- Blocking Dice Rolls: We use libWrapper (per best practice) to wrap ChatMessage.create. Whenever a chat message is created that contains dice rolls, our wrapper checks game.paused or whether the rolling user is locked. Foundry’s ChatMessageData includes a rolls array when a dice formula is used, so we block the creation of the message if (game.paused && !game.user.isGM) or if game.user.id is in our locked list. In those cases we show a warning notification (so the player sees why their roll was blocked). GMs are exempted from blocking so they can still un-pause or roll as needed.
- Chat Commands: We hook Hooks.on("chatMessage", …) to catch commands starting with /pausedice. The GM can issue /pausedice lock <name> or /pausedice unlock <name>. We split the message text, verify the sender is a GM, find the target user by name, and then set or clear that user’s lock status in our settings. We then refresh the scene controls UI so the toggle buttons update immediately. Any errors (unknown player name or non-GM usage) produce an inline notification. This follows the pattern that Foundry’s chatMessage hook provides for custom chat commands.
- State Persistence: We register a world-scoped setting (e.g. game.settings) to store the locked-player flags. This ensures lock states survive world reloads. Whenever we update locks via UI or command, we game.settings.set the new state object. On module init, we read that state back and use it when building the controls (setting each toggle’s active state from the saved lock flag).
- Updating the UI: After changing lock states (via GM toggles or /pausedice commands), we call ui.controls.render() to redraw the Scene Controls. This causes our getSceneControlButtons hook to run again and synchronize the toggle buttons’ visuals with the current lock state.

This modern v13+ approach avoids deprecated hooks (e.g. we do not use preCreateChatMessage) and uses standard APIs and libWrapper as recommended. The code handles errors gracefully with ui.notifications.

Key points and sources:
- We use the standard getSceneControlButtons hook to inject a new SceneControls group. Each toggle button is defined as a SceneControlTool with toggle: true and an onChange callback.
- Dice rolls are intercepted by wrapping ChatMessage.create via libWrapper (as recommended by libWrapper’s documentation).
- We check the ChatMessageData.rolls array (which holds any die-roll data) and cancel creation when appropriate.
- Finally, custom chat commands are parsed in the chatMessage hook so that /pausedice lock <name> can update our state and immediately refresh the controls. This approach uses only modern v13 APIs and avoids deprecated hooks.

_____________________________________

Pause Dice Rolling (Foundry VTT v13+)

The updated module uses the Foundry v13 APIs for pausing the game and persisting data. It registers a world-level setting to store the paused state and an array of locked player IDs, ensuring the state survives reloads. When the GM toggles pause or issues a chat command, the setting is updated. On game load, the GM’s client re-applies the paused state if needed. Dice-roll messages are intercepted via the preCreateDocument hook, allowing the module to cancel chat messages that contain rolls when the game is paused or the rolling user is locked. The GM’s commands (e.g. /pausedice pause / unpause / lock <name> / unlock <name>) are handled in the chatMessage hook, updating settings and broadcasting as appropriate. 

We use the libWrapper library to safely wrap core functionality (here, ChatMessage.create) rather than monkey-patching directly. This ensures compatibility with other modules and systems. The module code also uses game.settings.register (scope "world") for persistence. 
In summary, the module cleanly integrates with Foundry v13 hooks and data APIs:
- Pausing: Use game.togglePause(true/false) to pause/unpause; hook into Hooks.on("pauseGame") to update settings.
- Blocking Rolls: In Hooks.on("preCreateDocument") for ChatMessage, check game.paused and lockedPlayers before allowing creation.
- Locking Players: GM can /pausedice lock username or /unlock username in chat (intercepted by Hooks.on("chatMessage")) to add/remove user 
- IDs in settings.
- Persistence: The paused flag and lockedPlayers list are saved via game.settings so they persist across sessions.
