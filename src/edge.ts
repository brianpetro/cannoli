import { ChatCompletionRequestMessage } from "openai";
import { CannoliGroup } from "./group";
import { CannoliNode } from "./node";

// Edge Types
export type EdgeType =
	| "blank"
	| "variable"
	| "utility"
	| "function"
	| "choice"
	| "list";

export type BlankSubtype = "continueChat" | "systemMessage" | "write";

export type VariableSubtype = "";

export type UtilitySubtype = "logging" | "config";

export type ListSubtype = "list" | "listGroup";

export type FunctionSubtype = "write" | "builtIn" | "custom";

export type ChoiceSubtype = "normal" | "outOfGroup" | "outOfListGroup";

export type EdgeTag = "continueChat";

export type Variable = {
	name: string;
	type: VariableType;
	value?: string;
};

export type VariableType =
	| "existingLink"
	| "existingPath"
	| "newLink"
	| "newPath"
	| "regular"
	| "config";

export class CannoliEdge {
	id: string;
	label: string;
	sourceId: string;
	targetId: string;
	source: CannoliNode;
	target: CannoliNode;
	crossingGroups: {
		group: CannoliGroup;
		isEntering: boolean;
	}[];
	tags: EdgeTag[];
	type: EdgeType;
	subtype:
		| UtilitySubtype
		| FunctionSubtype
		| ChoiceSubtype
		| ListSubtype
		| BlankSubtype
		| VariableSubtype;
	chatHistory: ChatCompletionRequestMessage[];
	variables: Variable[];
	choiceOption: string | null;
	payloadContent: string;
	copies: CannoliEdge[];

	constructor({
		id,
		label,
		sourceId,
		targetId,
		type,
		variables,
		tags,
		choiceOption,
	}: {
		id: string;
		label: string;
		sourceId: string;
		targetId: string;
		type: EdgeType;
		variables: Variable[];
		tags: EdgeTag[];
		choiceOption: string | null;
	}) {
		this.id = id;
		this.label = label;
		this.sourceId = sourceId;
		this.targetId = targetId;
		this.type = type;
		this.tags = tags;
		this.variables = variables;
		this.choiceOption = choiceOption;
	}

	loadBlank({
		content,
		chatHistory,
	}: {
		content?: string;
		chatHistory?: ChatCompletionRequestMessage[];
	}) {
		switch (this.subtype) {
			case "continueChat": {
				if (chatHistory) {
					this.chatHistory = chatHistory;
				} else {
					throw new Error(
						`Edge ${this.id} is a continueChat edge but has no chat history`
					);
				}
				break;
			}
			case "systemMessage": {
				this.chatHistory = [
					{
						role: "system",
						content: content,
					},
				];
				break;
			}
			case "write": {
				if (content) {
					this.payloadContent = content;
				} else {
					throw new Error(
						`Edge ${this.id} is a write edge but has no content`
					);
				}
				break;
			}
			default: {
				throw new Error(
					`Edge ${this.id} has an invalid subtype: ${this.subtype}`
				);
			}
		}
	}

	logEdgeDetails() {
		const sourceFormat = this.source
			? `"${this.source.content.substring(0, 20)}..."`
			: "None";
		const targetFormat = this.target
			? `"${this.target.content.substring(0, 20)}..."`
			: "None";
		const crossingGroupsFormat =
			this.crossingGroups.length > 0
				? this.crossingGroups
						.map(
							(group) =>
								`\n\tCrossing Group: "${
									group.group.label
										? group.group.label.substring(0, 20)
										: "No Label"
								}..."`
						)
						.join("")
				: "\n\tCrossing Groups: None";
		const variablesFormat =
			this.variables.length > 0
				? this.variables
						.map(
							(variable) =>
								`\n\tVariable: "${variable.name}", Type: ${variable.type}`
						)
						.join("")
				: "\n\tVariables: None";
		const tagsFormat =
			this.tags.length > 0
				? this.tags.map((tag) => `\n\tTag: ${tag}`).join("")
				: "\n\tTags: None";

		const logString = `--> Edge: ${sourceFormat}---${this.label}--->${targetFormat} (Type: ${this.type}, Subtype: ${this.subtype}), ${variablesFormat}, ${crossingGroupsFormat} , ${tagsFormat},\n Choice Option: ${this.choiceOption}`;

		console.log(logString);
	}

	setSourceAndTarget(nodes: Record<string, CannoliNode>) {
		this.source = nodes[this.sourceId];
		this.target = nodes[this.targetId];
	}

	validate() {
		// If there's an edge tag, the source node must be a call node and the target node must be a call node
		if (this.tags.length > 0) {
			if (this.source.type !== "call") {
				throw new Error(
					`Edge ${this.id} has an edge tag but the source node is not a call node`
				);
			}
			if (this.target.type !== "call") {
				throw new Error(
					`Edge ${this.id} has an edge tag but the target node is not a call node`
				);
			}
		}

		// Do type-specific validation by calling the validate function for the type
		switch (this.type) {
			case "blank":
				this.validateBlank();
				break;
			case "variable":
				this.validateVariable();
				break;
			case "utility":
				this.validateUtility();
				break;
			case "function":
				this.validateFunction();
				break;
			case "choice":
				this.validateChoice();
				break;
			case "list":
				this.validateList();
				break;

			default:
				throw new Error(
					`Edge ${this.id} has an invalid type: ${this.type}`
				);
		}
	}

	validateBlank() {
		switch (this.subtype) {
			case "continueChat":
				// The source node must be a call node
				if (this.source.type !== "call") {
					throw new Error(
						`Edge ${this.id} is a continueChat edge but the source node is not a call node`
					);
				}

				// The target node must be a call node
				if (this.target.type !== "call") {
					throw new Error(
						`Edge ${this.id} is a continueChat edge but the target node is not a call node`
					);
				}
				break;
			case "systemMessage":
				// The source node must be a content node
				if (this.source.type !== "content") {
					throw new Error(
						`Edge ${this.id} is a systemMessage edge but the source node is not a content node`
					);
				}
				// The target node must be a call node
				if (this.target.type !== "call") {
					throw new Error(
						`Edge ${this.id} is a systemMessage edge but the target node is not a call node`
					);
				}
				break;
			case "write":
				// The target node must be a content node
				if (this.target.type !== "content") {
					throw new Error(
						`Edge ${this.id} is a write edge but the target node is not a content node`
					);
				}
				break;
			default:
				throw new Error(
					`Edge ${this.id} has an invalid subtype: ${this.subtype}`
				);
		}
	}

	validateVariable() {
		switch (this.subtype) {
			case "":
				// There must be only one variable
				if (this.variables.length !== 1) {
					throw new Error(
						`Edge ${this.id} is a variable edge but has ${this.variables.length} variables`
					);
				}
				// The variable must not be a choice option or config variable
				if (this.variables[0].type === "config") {
					throw new Error(
						`Edge ${this.id} is a variable edge but has a choice option or config variable`
					);
				}

				break;
			default:
				throw new Error(
					`Edge ${this.id} has an invalid subtype: ${this.subtype}`
				);
		}
	}

	validateUtility() {
		switch (this.subtype) {
			case "logging":
				// There must be no variables
				if (this.variables.length !== 0) {
					throw new Error(
						`Edge ${this.id} is a logging edge but has ${this.variables.length} variables`
					);
				}
				break;
			case "config":
				// All variables must be config variables
				if (
					this.variables.some(
						(variable) => variable.type !== "config"
					)
				) {
					throw new Error(
						`Edge ${this.id} is a config edge but has a non-config variable`
					);
				}
				break;
			default:
				throw new Error(
					`Edge ${this.id} has an invalid subtype: ${this.subtype}`
				);
		}
	}

	validateFunction() {
		switch (this.subtype) {
			case "builtIn":
				// There must be some variables
				if (this.variables.length === 0) {
					throw new Error(
						`Edge ${this.id} is a function edge but has no variables`
					);
				}
				break;
			default:
				throw new Error(
					`Edge ${this.id} has an invalid subtype: ${this.subtype}`
				);
		}
	}

	validateChoice() {
		// The choice option must be set
		if (!this.choiceOption) {
			throw new Error(
				`Edge ${this.id} is a choice edge but has no choice option`
			);
		}

		switch (this.subtype) {
			case "normal":
				// It must not be leaving a group
				if (
					this.crossingGroups.some(
						(crossingGroup) => !crossingGroup.isEntering
					)
				) {
					throw new Error(
						`Edge ${this.id} is a normal choice edge but is leaving a group`
					);
				}
				break;
			case "outOfGroup":
				// It must be leaving a group
				if (
					this.crossingGroups.every(
						(crossingGroup) => crossingGroup.isEntering
					)
				) {
					throw new Error(
						`Edge ${this.id} is an outOfGroup choice edge but is not leaving a group`
					);
				}
				break;
			case "outOfListGroup": {
				// Of its crossing groups, there must be one and only one list group
				if (
					this.crossingGroups.filter(
						(crossingGroup) => crossingGroup.group.type === "list"
					).length !== 1
				) {
					throw new Error(
						`Edge ${this.id} is an outOfListGroup choice edge but does not cross exactly one list group`
					);
				}

				// It must be leaving a list group
				if (
					this.crossingGroups.every(
						(crossingGroup) => crossingGroup.group.type !== "list"
					)
				) {
					throw new Error(
						`Edge ${this.id} is an outOfListGroup choice edge but is not leaving a list group`
					);
				}
				break;
			}
			default:
				throw new Error(
					`Edge ${this.id} has an invalid subtype: ${this.subtype}`
				);
		}
	}

	validateList() {
		// It must only have one variable
		if (this.variables.length !== 1) {
			throw new Error(
				`Edge ${this.id} is a list edge but has ${this.variables.length} variables`
			);
		}

		// It's source must be a call node
		if (this.source.type !== "call") {
			throw new Error(
				`Edge ${this.id} is a list edge but the source node is not a call node`
			);
		}

		switch (this.subtype) {
			case "list":
				break;
			case "listGroup": {
				// All of its source node's outgoing list edges must be listGroup edges
				if (
					this.source.outgoingEdges
						.filter((edge) => edge.subtype === "list")
						.some((edge) => edge.subtype !== "listGroup")
				) {
					throw new Error(
						`Edge ${this.id} is a listGroup edge but its source node has a list edge that is not a listGroup edge`
					);
				}

				// At least one of its source node's outgoing edges must be a listGroup edge that enters a listGroup and no other groups
				if (
					!this.source.outgoingEdges
						.filter((edge) => edge.subtype === "listGroup")
						.some(
							(edge) =>
								edge.crossingGroups.length === 1 &&
								edge.crossingGroups[0].group.type === "list" &&
								edge.crossingGroups[0].isEntering
						)
				) {
					throw new Error(
						`Edge ${this.id} is a listGroup edge but its source node has no listGroup edges that enters a listGroup`
					);
				}

				// Its first variable must be the only variable coming out of its source node
				if (
					// Of the source node's outgoing edges, the ones that are listGroup edges must have the same first variable as this edge
					this.source.outgoingEdges
						.filter((edge) => edge.subtype === "listGroup")
						.some(
							(edge) =>
								edge.variables[0].name !==
								this.variables[0].name
						)
				) {
					throw new Error(
						`Edge ${this.id} is a listGroup edge but its first variable is not the only variable coming out of its source node`
					);
				}
				break;
			}
			default:
				throw new Error(
					`Edge ${this.id} has an invalid subtype: ${this.subtype}`
				);
		}
	}
}
