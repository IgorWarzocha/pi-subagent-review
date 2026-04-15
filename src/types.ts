import type { Message } from "@mariozechner/pi-ai";

export type ThinkingLevel = "off" | "minimal" | "low" | "medium" | "high" | "xhigh";

export interface ReviewConfig {
	model: string;
	thinking?: ThinkingLevel;
}

export interface UsageStats {
	input: number;
	output: number;
	cacheRead: number;
	cacheWrite: number;
	cost: number;
	contextTokens: number;
	turns: number;
}

export interface ChildRunDetails {
	mode: "review";
	toolName: string;
	task: string;
	cwd: string;
	model: string;
	thinking?: ThinkingLevel;
	messages: Message[];
	stderr: string;
	exitCode: number;
	stopReason?: string;
	errorMessage?: string;
	usage: UsageStats;
}

export interface ReviewContext {
	repoRoot: string;
	currentRef: string;
	baseBranch: "main" | "master" | "dev";
	mergeBase: string;
	baseTip: string;
	status: string;
	recentBaseCommits: string;
	hasTrackedChanges: boolean;
	hasAnyChanges: boolean;
}
