import CopyInlineCodePlugin from "./main";
import { App, PluginSettingTab, Setting, getIconIds, getIcon } from "obsidian";
import type { IconPosition } from "./icon-position";

export class CopyInlineCodePluginTab extends PluginSettingTab {
	plugin: CopyInlineCodePlugin;

	constructor(app: App, plugin: CopyInlineCodePlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName("Show on hover")
			.setDesc("Copy icon only visible on hover")
			.addToggle((component) => {
				component
					.setValue(this.plugin.settings.showOnHover)
					.onChange(async (value) => {
						this.plugin.settings.showOnHover = value;
						await this.plugin.saveSettings();
					});
			});

		containerEl.createEl("h3", { text: "Exclusion Patterns" });
		containerEl.createEl("p", {
			text: "Add regex patterns to exclude code blocks from showing the copy icon. If no patterns are added, all code blocks will show the icon.",
		});

		const regexListContainer = containerEl.createDiv();
		this.renderRegexList(regexListContainer);

		new Setting(containerEl).addButton((button) => {
			button.setButtonText("Add Exclusion Pattern").onClick(() => {
				this.plugin.settings.regexFilters.push(["", ""]);
				this.renderRegexList(regexListContainer);
			});
		});

		// Icon selection setting
		containerEl.createEl("h3", { text: "Icon Settings" });

		new Setting(containerEl)
			.setName("Icon position")
			.setDesc("Show the copy icon on the left or right of inline code")
			.addDropdown((component) => {
				component
					.addOption("right", "Right")
					.addOption("left", "Left")
					.setValue(this.plugin.settings.iconPosition)
					.onChange(async (value) => {
						this.plugin.settings.iconPosition = value as IconPosition;
						await this.plugin.saveSettings();
					});
			});

		// Only show Lucide icon settings if legacy mode is disabled
		if (!this.plugin.settings.useLegacyIcon) {
			const iconDesc = containerEl.createDiv();
			iconDesc.createEl("p", {
				text: "Choose a Lucide icon for the copy button. You can browse available icons at: ",
			});
			const iconLink = iconDesc.createEl("a", {
				text: "https://lucide.dev/icons/",
				href: "https://lucide.dev/icons/",
			});
			iconLink.setAttribute("target", "_blank");

			iconDesc.createEl("p", {
				text: "Copy the icon name (e.g., 'copy', 'clipboard', ...) and paste it below.",
			});

			const iconSetting = new Setting(containerEl)
				.setName("Icon name")
				.setDesc(
					"Lucide icon name"
				);

			// Create a container for the input and preview
			const inputContainer = iconSetting.controlEl.createDiv({
				cls: "icon-input-container",
			});

			// Create preview element
			const iconPreview = inputContainer.createSpan();

			// Function to update the icon preview
			const updateIconPreview = (iconName: string) => {
				iconPreview.empty();

				let lucideIcon: SVGSVGElement | null = null;
				let isInvalid = false;

				if (!iconName) {
					isInvalid = true;
					lucideIcon = getIcon("lucide-x");
				} else {
					lucideIcon = getIcon(iconName);
					if (!lucideIcon) {
						isInvalid = true;
						lucideIcon = getIcon("lucide-x");
					}
				}

				if (lucideIcon) {
					lucideIcon.classList.add("preview-icon");
					if (isInvalid) {
						lucideIcon.classList.add("invalid-preview-icon");
					}
					iconPreview.appendChild(lucideIcon);
				}
			};

			// Create text input
			const textInput = inputContainer.createEl("input", {
				type: "text",
				cls: "text-input",
			});
			textInput.style.flex = "1";
			textInput.placeholder = "copy";

			// Get the base icon name (without lucide- prefix) for display
			const baseIconName = this.plugin.settings.iconName.startsWith(
				"lucide-"
			)
				? this.plugin.settings.iconName.substring(7)
				: this.plugin.settings.iconName;

			textInput.value = baseIconName;

			// Initialize preview with current icon
			updateIconPreview(this.plugin.settings.iconName);

			textInput.addEventListener("input", async (event) => {
				const target = event.target as HTMLInputElement;
				const value = target.value;
				const trimmedValue = `lucide-${value.trim()}`;
				const availableIcons = getIconIds();

				// Update preview in real-time
				updateIconPreview(trimmedValue);

				// Validate icon exists
				if (trimmedValue && !availableIcons.includes(trimmedValue)) {
					textInput.classList.add("regex-input-error");
					return;
				}

				textInput.classList.remove("regex-input-error");
				this.plugin.settings.iconName = trimmedValue;
				await this.plugin.saveSettings();
			});
		}

		new Setting(containerEl)
			.setName("Use legacy icon")
			.setDesc(
				"Use the original clipboard emoji (📋) instead of Lucide icons"
			)
			.addToggle((component) => {
				component
					.setValue(this.plugin.settings.useLegacyIcon)
					.onChange(async (value) => {
						this.plugin.settings.useLegacyIcon = value;
						await this.plugin.saveSettings();
						this.display();
					});
			});
	}

	private renderRegexList(container: HTMLElement) {
		container.empty();

		this.plugin.settings.regexFilters.forEach((regex, index) => {
			const setting = new Setting(container);
			setting
				.setName(`Pattern #${index + 1}`)
				.addText((text) => {
					text.setValue(regex[0])
						.setPlaceholder("regex pattern")
						.onChange(async (value) => {
							try {
								new RegExp(value, "");
							} catch {
								text.inputEl.classList.add("regex-input-error");
								return;
							}
							text.inputEl.classList.remove("regex-input-error");
							this.plugin.settings.regexFilters[index] = [
								value,
								regex[1],
							];
							await this.plugin.saveSettings();
						});

					const textEl = text.inputEl;
					textEl.style.width = "80%";
				})
				.addText((text) => {
					text.setValue(regex[1])
						.setPlaceholder("modifiers")
						.onChange(async (value) => {
							try {
								new RegExp("", value);
							} catch {
								text.inputEl.classList.add("regex-input-error");
								return;
							}
							text.inputEl.classList.remove("regex-input-error");
							this.plugin.settings.regexFilters[index] = [
								regex[0],
								value,
							];
							await this.plugin.saveSettings();
						});
					const textEl = text.inputEl;
					textEl.style.width = "20%";
				})
				.addButton((button) => {
					button
						.setIcon("trash")
						.setClass("mod-warning")
						.onClick(async () => {
							this.plugin.settings.regexFilters.splice(index, 1);
							await this.plugin.saveSettings();
							this.renderRegexList(container);
						});
				});
		});
	}
}
