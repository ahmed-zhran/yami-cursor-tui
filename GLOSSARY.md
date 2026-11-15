# Yami Cursor TUI

Terminal chat UI for driving a Cursor agent session from the project directory.

## Language

**Session**:
One durable Cursor agent conversation for the current working directory.
_Avoid_: Chat thread, conversation, run (a run is one turn inside a session)

**Run**:
One `send` (or steer) turn on a session, from prompt submit until finished, cancelled, or steered.
_Avoid_: Request, turn (prefer Run when talking about SDK lifecycle)

**Steer**:
Cancel the active run and immediately start a new run with the user's follow-up prompt.
_Avoid_: Interrupt-and-queue, redirect

**Bubble**:
One message block in the stacked transcript (user or assistant text).
_Avoid_: Card, chip, message row

**Activity line**:
A one-line status or tool/thinking hint shown while a run is active, not a full tool panel.
_Avoid_: Tool panel, thinking bubble (those are later)

**TUI**:
The Ink terminal app launched as `yami`.
_Avoid_: CLI (the binary is `yami`; the product is the TUI)
