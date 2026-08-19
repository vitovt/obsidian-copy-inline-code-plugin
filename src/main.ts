import { CopyInlineCodePluginTab } from "./settings";
import { MarkdownView, Notice, Plugin, getIcon } from "obsidian";
import { Extension } from "@codemirror/state";
import { createCopyPlugin } from "./copy-inline-code-view-plugin";
import { RegexFilters, shouldExclude } from "./regex-exclude";

interface CopyInlineCodePluginSettings {
	showOnHover: boolean;
	regexFilters: RegexFilters;
	iconName: string;
	useLegacyIcon: boolean;
}

const DEFAULT_SETTINGS: Partial<CopyInlineCodePluginSettings> = {
	showOnHover: false,
	regexFilters: [],
	iconName: "lucide-copy",
	useLegacyIcon: false,
};

export default class CopyInlineCodePlugin extends Plugin {
	settings: CopyInlineCodePluginSettings;
	private editorExtensions: Extension[] = [];

	async onload() {
		await this.loadSettings();
		this.addSettingTab(new CopyInlineCodePluginTab(this.app, this));
		this.copyInlineCodeLogic();
	}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData()
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
		this.applySettings();
	}

	private createEditorExtension(): Extension {
		return createCopyPlugin(
			this.settings.showOnHover,
			this.settings.regexFilters,
			this.settings.iconName,
			this.settings.useLegacyIcon
		);
	}

	private applySettings() {
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

	copyInlineCodeLogic() {
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

				const icon = createSpan({
					cls: "copy-to-clipboard-icon icon-margin-left",
				});

				if (this.settings.useLegacyIcon) {
					icon.setText("\xa0📋");
				} else {
					const lucideIcon = getIcon(this.settings.iconName);
					if (lucideIcon) {
						icon.appendChild(lucideIcon);
					} else {
						icon.setText("\xa0📋");
					}
				}

				icon.toggleClass("show-on-hover", this.settings.showOnHover);

				icon.onclick = (event) => {
					if (textToCopy) {
						event.stopPropagation();
						navigator.clipboard.writeText(textToCopy);
						new Notice(`Copied '${textToCopy}' to clipboard!`);
					}
				};

				code.appendChild(icon);
			});
		});
	}
}
