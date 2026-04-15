import fs from "node:fs";
import type { ExtensionAPI, ExtensionCommandContext } from "@mariozechner/pi-coding-agent";
import { ALLOWED_THINKING, DEFAULT_CONFIG, REVIEW_COMMAND, getAgentDir, getConfigPath } from "./constants.js";
import type { ChildRunDetails, ReviewConfig, ThinkingLevel, UsageStats } from "./types.js";

function normalizeThinking(value: ThinkingLevel | undefined): ThinkingLevel {
	return value && ALLOWED_THINKING.has(value) ? value : DEFAULT_CONFIG.thinking;
}

export function ensureConfigFile(): string {
	const agentDir = getAgentDir();
	const configPath = getConfigPath();
	fs.mkdirSync(agentDir, { recursive: true });
	if (!fs.existsSync(configPath)) {
		fs.writeFileSync(configPath, `${JSON.stringify(DEFAULT_CONFIG, null, 2)}\n`, "utf8");
	}
	return configPath;
}

export function readConfig(): Required<ReviewConfig> {
	let parsed: ReviewConfig | undefined;
	const configPath = ensureConfigFile();
	try {
		parsed = JSON.parse(fs.readFileSync(configPath, "utf8")) as ReviewConfig;
	} catch (error) {
		throw new Error(`Could not parse ${configPath}: ${error instanceof Error ? error.message : String(error)}`);
	}

	return {
		model: typeof parsed?.model === "string" && parsed.model.trim() ? parsed.model.trim() : DEFAULT_CONFIG.model,
		thinking: normalizeThinking(parsed?.thinking),
	};
}

function emptyUsage(): UsageStats {
	return { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 0, contextTokens: 0, turns: 0 };
}

export function createChildRunDetails(task: string, cwd: string, config = readConfig()): ChildRunDetails {
	return {
		mode: "review",
		toolName: REVIEW_COMMAND,
		task,
		cwd,
		model: config.model,
		thinking: config.thinking,
		messages: [],
		stderr: "",
		exitCode: 0,
		usage: emptyUsage(),
	};
}

export function isSubagentFailure(details: Pick<ChildRunDetails, "exitCode" | "stopReason">): boolean {
	return details.exitCode !== 0 || details.stopReason === "error" || details.stopReason === "aborted";
}

function splitModelRef(modelRef: string): { provider: string; modelId: string } | undefined {
	const slash = modelRef.indexOf("/");
	if (slash <= 0 || slash === modelRef.length - 1) return undefined;
	return {
		provider: modelRef.slice(0, slash),
		modelId: modelRef.slice(slash + 1),
	};
}

async function canUseModel(ctx: ExtensionCommandContext, modelRef: string): Promise<boolean> {
	const parsed = splitModelRef(modelRef);
	if (!parsed) return false;
	const model = ctx.modelRegistry.find(parsed.provider, parsed.modelId);
	if (!model) return false;
	const auth = await ctx.modelRegistry.getApiKeyAndHeaders(model);
	return auth.ok;
}

export async function resolveReviewConfig(pi: ExtensionAPI, ctx: ExtensionCommandContext): Promise<Required<ReviewConfig> & { source: "configured" | "current" }> {
	const configured = readConfig();
	if (await canUseModel(ctx, configured.model)) {
		return { ...configured, source: "configured" };
	}

	if (ctx.model) {
		const auth = await ctx.modelRegistry.getApiKeyAndHeaders(ctx.model);
		if (auth.ok) {
			return {
				model: `${ctx.model.provider}/${ctx.model.id}`,
				thinking: pi.getThinkingLevel() as ThinkingLevel,
				source: "current",
			};
		}
	}

	return { ...configured, source: "configured" };
}
