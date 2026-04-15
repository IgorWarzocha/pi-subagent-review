import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { ensureConfigFile } from "./src/config.js";
import { CHILD_ENV } from "./src/constants.js";
import { registerReviewCommand } from "./src/review-command.js";

export default function (pi: ExtensionAPI) {
	if (process.env[CHILD_ENV] === "1") return;

	ensureConfigFile();
	registerReviewCommand(pi);
}
