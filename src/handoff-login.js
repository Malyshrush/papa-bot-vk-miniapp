// UX gate only: the backend independently verifies the signed VK launch and ticket.
// Never request identity linking or token permissions without the explicit action.
export function createLoginAutoStart() {
  const started = new Set();
  return (route, launchParams, complete) => {
    if (route.handoff !== 'login' || !route.handoffTicket || !launchParams.sign || !launchParams.vk_user_id) return;
    if (started.has(route.handoffTicket)) return;
    started.add(route.handoffTicket);
    void complete();
  };
}
