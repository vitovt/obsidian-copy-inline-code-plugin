import CopyInlineCodePlugin from "./main";
import {
	App,
	Notice,
	PluginSettingTab,
	Setting,
	getIcon,
	getIconIds,
	type SettingDefinitionItem,
} from "obsidian";
import { isIconPosition } from "./icon-position";

const EXCLUSION_DESCRIPTION =
	"Add regular expressions for inline code that should not show a copy icon.";

export class CopyInlineCodePluginTab extends PluginSettingTab {
	plugin: CopyInlineCodePlugin;

	constructor(app: App, plugin: CopyInlineCodePlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	getSettingDefinitions(): SettingDefinitionItem[] {
		return [
			{
				name: "Show on hover",
				desc: "Only show the copy icon while hovering over inline code.",
				render: (setting) => this.addShowOnHoverControl(setting),
			},
			{
				type: "list",
				heading: "Exclusion patterns",
				emptyState: "No exclusion patterns.",
				addItem: {
					name: "Add exclusion pattern",
					action: () => {
						this.plugin.settings.regexFilters.push(["", ""]);
						this.refreshSettings();
					},
				},
				onDelete: (index) => {
					this.plugin.settings.regexFilters.splice(index, 1);
					this.persistAndRefresh();
				},
				items: this.plugin.settings.regexFilters.map((regex, index) => ({
					name: `Pattern ${index + 1}`,
					render: (setting) => this.addRegexControls(setting, regex),
				})),
			},
			{
				type: "group",
				heading: "Icons",
				items: [
					{
						name: "Icon position",
						desc: "Show the copy icon on the left or right of inline code.",
						render: (setting) => this.addIconPositionControl(setting),
					},
					{
						name: "Icon name",
						desc: this.createIconDescription(),
						visible: () => !this.plugin.settings.useLegacyIcon,
						render: (setting) => this.addIconNameControl(setting),
					},
					{
						name: "Use legacy icon",
						desc: "Use the original clipboard emoji (📋) instead of Lucide icons.",
						render: (setting) => this.addLegacyIconControl(setting),
					},
				],
			},
		];
	}

	display(): void {
		this.containerEl.empty();
		this.renderImperativeSettings();
	}

	private renderImperativeSettings(): void {
		this.addShowOnHoverControl(
			new Setting(this.containerEl)
				.setName("Show on hover")
				.setDesc("Only show the copy icon while hovering over inline code.")
		);

		new Setting(this.containerEl)
			.setName("Exclusion patterns")
			.setDesc(EXCLUSION_DESCRIPTION)
			.setHeading();

		this.plugin.settings.regexFilters.forEach((regex, index) => {
			this.addRegexControls(
				new Setting(this.containerEl).setName(`Pattern ${index + 1}`),
				regex,
				() => {
					this.plugin.settings.regexFilters.splice(index, 1);
					this.persistAndRefresh();
				}
			);
		});

		new Setting(this.containerEl)
			.setName("Add exclusion pattern")
			.addButton((button) => {
				button.setButtonText("Add").onClick(() => {
					this.plugin.settings.regexFilters.push(["", ""]);
					this.refreshSettings();
				});
			});

		new Setting(this.containerEl).setName("Icons").setHeading();

		this.addIconPositionControl(
			new Setting(this.containerEl)
				.setName("Icon position")
				.setDesc("Show the copy icon on the left or right of inline code.")
		);

		if (!this.plugin.settings.useLegacyIcon) {
			this.addIconNameControl(
				new Setting(this.containerEl)
					.setName("Icon name")
					.setDesc(this.createIconDescription())
			);
		}

		this.addLegacyIconControl(
			new Setting(this.containerEl)
				.setName("Use legacy icon")
				.setDesc(
					"Use the original clipboard emoji (📋) instead of Lucide icons."
				)
		);
	}

	private addShowOnHoverControl(setting: Setting): void {
		setting.addToggle((component) => {
			component
				.setValue(this.plugin.settings.showOnHover)
				.onChange(async (value) => {
					this.plugin.settings.showOnHover = value;
					await this.plugin.saveSettings();
				});
		});
	}

	private addIconPositionControl(setting: Setting): void {
		setting.addDropdown((component) => {
			component
				.addOption("right", "Right")
				.addOption("left", "Left")
				.setValue(this.plugin.settings.iconPosition)
				.onChange(async (value) => {
					if (!isIconPosition(value)) {
						return;
					}
					this.plugin.settings.iconPosition = value;
					await this.plugin.saveSettings();
				});
		});
	}

	private addIconNameControl(setting: Setting): void {
		setting.controlEl.addClass("icon-input-container");
		const iconPreview = setting.controlEl.createSpan();
		const baseIconName = this.plugin.settings.iconName.startsWith("lucide-")
			? this.plugin.settings.iconName.substring(7)
			: this.plugin.settings.iconName;

		this.updateIconPreview(iconPreview, this.plugin.settings.iconName);

		setting.addText((text) => {
			text.setValue(baseIconName)
				.setPlaceholder("Copy")
				.onChange(async (value) => {
					const iconName = `lucide-${value.trim()}`;
					this.updateIconPreview(iconPreview, iconName);

					if (!getIconIds().includes(iconName)) {
						text.inputEl.addClass("regex-input-error");
						return;
					}

					text.inputEl.removeClass("regex-input-error");
					this.plugin.settings.iconName = iconName;
					await this.plugin.saveSettings();
				});
			text.inputEl.addClass("icon-name-input");
		});
	}

	private addLegacyIconControl(setting: Setting): void {
		setting.addToggle((component) => {
			component
				.setValue(this.plugin.settings.useLegacyIcon)
				.onChange(async (value) => {
					this.plugin.settings.useLegacyIcon = value;
					await this.plugin.saveSettings();
					this.refreshSettings();
				});
		});
	}

	private addRegexControls(
		setting: Setting,
		regex: [string, string],
		onDelete?: () => void
	): void {
		setting
			.addText((text) => {
				text.setValue(regex[0])
					.setPlaceholder("Regex pattern")
					.onChange(async (value) => {
						if (!this.isValidRegex(value, regex[1])) {
							text.inputEl.addClass("regex-input-error");
							return;
						}
						text.inputEl.removeClass("regex-input-error");
						regex[0] = value;
						await this.plugin.saveSettings();
					});
				text.inputEl.addClass("regex-pattern-input");
			})
			.addText((text) => {
				text.setValue(regex[1])
					.setPlaceholder("Modifiers")
					.onChange(async (value) => {
						if (!this.isValidRegex(regex[0], value)) {
							text.inputEl.addClass("regex-input-error");
							return;
						}
						text.inputEl.removeClass("regex-input-error");
						regex[1] = value;
						await this.plugin.saveSettings();
					});
				text.inputEl.addClass("regex-modifier-input");
			});

		if (onDelete) {
			setting.addButton((button) => {
				button.setButtonText("Remove").onClick(onDelete);
			});
		}
	}

	private updateIconPreview(container: HTMLElement, iconName: string): void {
		container.empty();
		const selectedIcon = getIcon(iconName);
		const icon = selectedIcon ?? getIcon("lucide-x");
		if (!icon) {
			return;
		}

		icon.addClass("preview-icon");
		if (!selectedIcon) {
			icon.addClass("invalid-preview-icon");
		}
		container.appendChild(icon);
	}

	private createIconDescription(): DocumentFragment {
		const description = createFragment();
		description.appendText("Choose an icon from the ");
		description.createEl("a", {
			text: "Lucide icon gallery",
			href: "https://lucide.dev/icons/",
		});
		description.appendText(" and enter its name.");
		return description;
	}

	private isValidRegex(pattern: string, flags: string): boolean {
		try {
			new RegExp(pattern, flags);
			return true;
		} catch {
			return false;
		}
	}

	private persistAndRefresh(): void {
		void this.plugin.saveSettings().then(
			() => this.refreshSettings(),
			() => new Notice("Could not save the plugin settings.")
		);
	}

	private refreshSettings(): void {
		const update = (this as { update?: () => void }).update;
		if (typeof update === "function") {
			update.call(this);
			return;
		}

		this.containerEl.empty();
		this.renderImperativeSettings();
	}
}
