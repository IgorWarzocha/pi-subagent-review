import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { REVIEW_COMMAND } from "./constants.js";
import type { ReviewContext } from "./types.js";

async function runGit(pi: ExtensionAPI, cwd: string, args: string[], timeout = 10_000) {
	return pi.exec("git", args, { cwd, timeout });
}

async function gitString(pi: ExtensionAPI, cwd: string, args: string[], timeout = 10_000): Promise<string> {
	const result = await runGit(pi, cwd, args, timeout);
	if (result.code !== 0) {
		const command = `git ${args.join(" ")}`;
		const message = result.stderr.trim() || result.stdout.trim() || `${command} failed with exit code ${result.code}`;
		throw new Error(message);
	}
	return result.stdout.trim();
}

async function hasLocalBranch(pi: ExtensionAPI, cwd: string, branch: "main" | "master"): Promise<boolean> {
	const result = await runGit(pi, cwd, ["show-ref", "--verify", "--quiet", `refs/heads/${branch}`]);
	return result.code === 0;
}

async function hasLocalDevBranch(pi: ExtensionAPI, cwd: string): Promise<boolean> {
	const result = await runGit(pi, cwd, ["show-ref", "--verify", "--quiet", "refs/heads/dev"]);
	return result.code === 0;
}

async function hasTrackedChangesAgainst(pi: ExtensionAPI, cwd: string, revision: string): Promise<boolean> {
	const result = await runGit(pi, cwd, ["diff", "--quiet", revision]);
	if (result.code === 0) return false;
	if (result.code === 1) return true;
	throw new Error(result.stderr.trim() || `git diff --quiet ${revision} failed with exit code ${result.code}`);
}

export async function detectReviewContext(pi: ExtensionAPI, cwd: string): Promise<ReviewContext> {
	const repoRoot = await gitString(pi, cwd, ["rev-parse", "--show-toplevel"]);
	const currentBranch = await gitString(pi, repoRoot, ["branch", "--show-current"]);
	const [hasDev, hasMain, hasMaster] = await Promise.all([
		hasLocalDevBranch(pi, repoRoot),
		hasLocalBranch(pi, repoRoot, "main"),
		hasLocalBranch(pi, repoRoot, "master"),
	]);

	let baseBranch: "main" | "master" | "dev" | undefined;
	if (currentBranch === "dev") {
		if (hasMain) baseBranch = "main";
		else if (hasMaster) baseBranch = "master";
	} else if (currentBranch !== "main" && currentBranch !== "master") {
		if (hasDev) baseBranch = "dev";
		else if (hasMain) baseBranch = "main";
		else if (hasMaster) baseBranch = "master";
	} else {
		if (hasDev) baseBranch = "dev";
		else if (currentBranch === "main" && hasMaster) baseBranch = "master";
		else if (currentBranch === "master" && hasMain) baseBranch = "main";
		else baseBranch = currentBranch as "main" | "master";
	}

	if (!baseBranch) {
		const branches = await gitString(pi, repoRoot, ["for-each-ref", "--format=%(refname:short)", "refs/heads"]);
		throw new Error(`Could not determine an automatic review base branch. Local branches: ${branches || "(none)"}`);
	}

	const currentRef = currentBranch || (await gitString(pi, repoRoot, ["rev-parse", "--short", "HEAD"]));
	const mergeBase = await gitString(pi, repoRoot, ["merge-base", baseBranch, "HEAD"]);
	const baseTip = await gitString(pi, repoRoot, ["rev-parse", "--short", baseBranch]);
	const recentBaseCommits = await gitString(pi, repoRoot, ["log", "--oneline", "--decorate", "-n", "8", baseBranch]);
	const status = await gitString(pi, repoRoot, ["status", "--short", "--untracked-files=all"]);
	const hasTrackedChanges = await hasTrackedChangesAgainst(pi, repoRoot, mergeBase);
	const hasAnyChanges = hasTrackedChanges || status.length > 0;

	return {
		repoRoot,
		currentRef,
		baseBranch,
		mergeBase,
		baseTip,
		status,
		recentBaseCommits,
		hasTrackedChanges,
		hasAnyChanges,
	};
}

export function buildReviewTask(review: ReviewContext, extraFocus: string): string {
	const sections = [
		`Repository root: ${review.repoRoot}`,
		`Current ref: ${review.currentRef}`,
		`Chosen local base branch: ${review.baseBranch}`,
		`Base branch tip (short SHA): ${review.baseTip}`,
		`Merge base (${review.baseBranch}, HEAD): ${review.mergeBase}`,
		"",
		`Recent commits on ${review.baseBranch}:`,
		review.recentBaseCommits || "(none)",
		"",
		"Current status (`git status --short --untracked-files=all`):",
		review.status || "(clean)",
		"",
		"Review the current checkout against the merge base so uncommitted changes are included while base-only commits are excluded.",
		"Required inspection steps:",
		`1. Run \`git diff --stat ${review.mergeBase}\``,
		`2. Run \`git diff ${review.mergeBase}\``,
		`3. Run \`git diff --stat ${review.baseBranch}...HEAD\``,
		`4. Run \`git diff ${review.baseBranch}...HEAD\``,
		"5. Use targeted file diffs or reads where needed.",
	];

	if (review.status) {
		sections.push(
			"",
			"Because the worktree is not clean, also inspect:",
			"- `git diff --cached`",
			"- `git diff`",
			"- any relevant untracked files reported by status",
		);
	}

	sections.push(
		"",
		"Return prioritized, actionable findings only.",
		"Be slightly lenient: include lower-severity but still concrete, actionable issues when supported by evidence.",
		"Do not stop after finding only one or two issues; keep looking for additional credible findings.",
		"Aim for roughly 5-15 issues if the diff supports that many, but do not pad or invent findings.",
		"Focus on correctness, regressions, security, data loss, performance, concurrency, and missing tests.",
		"Reference specific files and line ranges when possible.",
		"If there are no actionable issues worth flagging, say that clearly.",
	);

	if (extraFocus.trim()) {
		sections.push("", `Additional user focus: ${extraFocus.trim()}`);
	}

	return sections.join("\n");
}

export function buildReviewUserMessage(review: ReviewContext, findings: string): string {
	return [
		`Review findings from /${REVIEW_COMMAND} against local base branch \`${review.baseBranch}\` in \`${review.repoRoot}\` (merge base \`${review.mergeBase.slice(0, 12)}\`):`,
		"",
		findings.trim() || "No actionable issues found.",
		"",
		"Please address the findings above. If there are no actionable issues, briefly confirm that.",
	].join("\n");
}
