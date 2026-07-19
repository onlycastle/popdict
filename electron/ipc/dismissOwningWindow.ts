type DismissibleWindow = { hide: () => void; close: () => void }

/** Keep the persistent search window warm; close secondary windows so their
 * next open starts from a fresh route state. */
export function dismissOwningWindow<Sender>(
  sender: Sender,
  fromSender: (sender: Sender) => DismissibleWindow | null,
  persistentWindow: DismissibleWindow | null,
): void {
  const owner = fromSender(sender)
  if (!owner) return
  if (owner === persistentWindow) owner.hide()
  else owner.close()
}
