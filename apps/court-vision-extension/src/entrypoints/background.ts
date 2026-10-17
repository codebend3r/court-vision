import { defineBackground } from "#imports";

// WXT refuses to build without an entrypoint. The message and toolbar
// listeners arrive with the bridge's message handling.
const background = defineBackground(() => {});

export default background;
