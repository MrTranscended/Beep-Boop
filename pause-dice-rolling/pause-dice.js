Hooks.on("preCreateChatMessage", (message, options, userId) => {
  // Check if the game is paused and if the message contains dice rolls
  if (game.paused && message.rolls && message.rolls.length > 0) {
    ui.notifications.warn("The game is currently paused. You cannot roll dice.");
    return false; // Prevent the message from being created
  }
  return true;
});
