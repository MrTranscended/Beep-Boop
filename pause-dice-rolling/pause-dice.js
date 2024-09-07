Hooks.on("preCreateChatMessage", (message, options, userId) => {
  if (game.paused) {
    ui.notifications.warn("The game is currently paused. You cannot roll dice.");
    return false; // Prevent the message from being created
  }
  return true;
});
