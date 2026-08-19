import { CopyInlineCodePluginTab } from "./settings";
import { MarkdownView, Plugin } from "obsidian";
import { Extension } from "@codemirror/state";
import { copyTextToClipboard } from "./clipboard";
import { createCopyIcon } from "./copy-icon";
import { createCopyPlugin } from "./copy-inline-code-view-plugin";
import { isIconPosition, type IconPosition } from "./icon-position";
import {
	isRegexFilters,
	type RegexFilters,
	shouldExclude,
} from "./regex-exclude";

interface CopyInlineCodePluginSettings {
	showOnHover: boolean;
	regexFilters: RegexFilters;
	iconName: string;
	useLegacyIcon: boolean;
	iconPosition: IconPosition;
}

const DEFAULT_SETTINGS: CopyInlineCodePluginSettings = {
	showOnHover: false,
	regexFilters: [],
	iconName: "lucide-copy",
	useLegacyIcon: false,
	iconPosition: "right",
};

export default class CopyInlineCodePlugin extends Plugin {
	settings!: CopyInlineCodePluginSettings;
	private editorExtensions: Extension[] = [];

	async onload(): Promise<void> {
		await this.loadSettings();
		this.addSettingTab(new CopyInlineCodePluginTab(this.app, this));
		this.copyInlineCodeLogic();
	}

	async loadSettings(): Promise<void> {
		const savedData: unknown = await this.loadData();
		const savedSettings =
			typeof savedData === "object" && savedData !== null
				? (savedData as Record<string, unknown>)
				: {};

		this.settings = {
			showOnHover:
				typeof savedSettings.showOnHover === "boolean"
					? savedSettings.showOnHover
					: DEFAULT_SETTINGS.showOnHover,
			regexFilters: isRegexFilters(savedSettings.regexFilters)
				? savedSettings.regexFilters
				: DEFAULT_SETTINGS.regexFilters,
			iconName:
				typeof savedSettings.iconName === "string"
					? savedSettings.iconName
					: DEFAULT_SETTINGS.iconName,
			useLegacyIcon:
				typeof savedSettings.useLegacyIcon === "boolean"
					? savedSettings.useLegacyIcon
					: DEFAULT_SETTINGS.useLegacyIcon,
			iconPosition: isIconPosition(savedSettings.iconPosition)
				? savedSettings.iconPosition
				: DEFAULT_SETTINGS.iconPosition,
		};
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
		this.applySettings();
	}

	private createEditorExtension(): Extension {
		return createCopyPlugin(
			this.settings.showOnHover,
			this.settings.regexFilters,
			this.settings.iconName,
			this.settings.useLegacyIcon,
			this.settings.iconPosition
		);
	}

	private applySettings(): void {
		if (this.editorExtensions.length === 0) {
			return;
		}

		this.editorExtensions.splice(
			0,
			this.editorExtensions.length,
			this.createEditorExtension()
		);
		this.app.workspace.updateOptions();

		this.app.workspace.getLeavesOfType("markdown").forEach((leaf) => {
			if (leaf.view instanceof MarkdownView && leaf.view.getMode() === "preview") {
				leaf.view.previewMode.rerender(true);
			}
		});
	}

	copyInlineCodeLogic(): void {
		this.editorExtensions.push(this.createEditorExtension());
		this.registerEditorExtension(this.editorExtensions);
		this.registerMarkdownPostProcessor((element, context) => {
			const inlineCodes = element.querySelectorAll("*:not(pre) > code");

			inlineCodes.forEach((code) => {
				if (code.querySelector("span.copy-to-clipboard-icon")) {
					return;
				}

				const textToCopy = code.textContent;
				if (!textToCopy) {
					return;
				}

				if (shouldExclude(textToCopy, this.settings.regexFilters)) {
					return;
				}

				const icon = createCopyIcon({
					showOnHover: this.settings.showOnHover,
					iconName: this.settings.iconName,
					useLegacyIcon: this.settings.useLegacyIcon,
					iconPosition: this.settings.iconPosition,
				});

				icon.onclick = (event) => {
					event.stopPropagation();
					copyTextToClipboard(textToCopy);
				};

				if (this.settings.iconPosition === "left") {
					code.prepend(icon);
				} else {
					code.appendChild(icon);
				}
			});
		});
	}
}
