import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { REVIEW_COMMAND } from "./constants.js";
import { createChildRunDetails, isSubagentFailure, resolveReviewConfig } from "./config.js";
import { buildReviewTask, buildReviewUserMessage, detectReviewContext } from "./review.js";
import { getFinalOutput, runReviewSubagent } from "./subagent.js";

export function registerReviewCommand(pi: ExtensionAPI) {
	pi.registerCommand(REVIEW_COMMAND, {
		description: "Run an isolated code-review subagent against the current repo and send the findings back as a user message",
		handler: async (args, ctx) => {
			if (!ctx.isIdle()) {
				ctx.ui.notify(`Waiting for the current turn to finish before running /${REVIEW_COMMAND}...`, "info");
				await ctx.waitForIdle();
			}

			ctx.ui.notify(`Running /${REVIEW_COMMAND} against the current repo...`, "info");

			let review;
			try {
				review = await detectReviewContext(pi, ctx.cwd);
			} catch (error) {
				ctx.ui.notify(error instanceof Error ? error.message : String(error), "error");
				return;
			}

			if (!review.hasAnyChanges) {
				pi.sendUserMessage(buildReviewUserMessage(review, "No changes found relative to the selected base branch."));
				ctx.ui.notify(`No changes found relative to ${review.baseBranch}; sent summary to the agent.`, "info");
				return;
			}

			const task = buildReviewTask(review, args);
			const reviewConfig = await resolveReviewConfig(pi, ctx);
			let details = createChildRunDetails(task, review.repoRoot, reviewConfig);
			if (reviewConfig.source === "current") {
				ctx.ui.notify(`Configured review model unavailable; falling back to current session model ${reviewConfig.model}.`, "warning");
			}

			try {
				details = await runReviewSubagent(task, review.repoRoot, reviewConfig, ctx.signal);
				if (ctx.signal?.aborted) return;
				const finalOutput = getFinalOutput(details.messages).trim() || "No actionable issues found.";
				if (isSubagentFailure(details)) throw new Error(details.errorMessage || details.stderr || finalOutput);

				const message = buildReviewUserMessage(review, finalOutput);
				if (ctx.isIdle()) pi.sendUserMessage(message);
				else pi.sendUserMessage(message, { deliverAs: "followUp" });
				ctx.ui.notify(`Review findings sent back to the main agent from /${REVIEW_COMMAND}.`, "info");
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				details.exitCode = details.exitCode || 1;
				details.errorMessage = message;
				ctx.ui.notify(`/${REVIEW_COMMAND} failed: ${message}`, "error");
			}
		},
	});
}
