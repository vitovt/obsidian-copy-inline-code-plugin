import { WidgetType } from "@codemirror/view";
import { Notice, getIcon } from "obsidian";
import type { IconPosition } from "./icon-position";

export class CopyWidget extends WidgetType {
	showOnHover: boolean;
	iconName: string;
	useLegacyIcon: boolean;
	iconPosition: IconPosition;
	textToCopy: string;

	constructor(
		showOnHover: boolean,
		iconName: string,
		useLegacyIcon: boolean,
		iconPosition: IconPosition,
		textToCopy: string
	) {
		super();
		this.showOnHover = showOnHover;
		this.iconName = iconName;
		this.useLegacyIcon = useLegacyIcon;
		this.iconPosition = iconPosition;
		this.textToCopy = textToCopy;
	}

	toDOM(): HTMLElement {
		const icon = createSpan({
			cls: `copy-to-clipboard-icon icon-position-${this.iconPosition}`,
		});

		if (this.useLegacyIcon) {
			icon.createSpan({
				cls: "copy-to-clipboard-legacy-icon",
				text: "📋",
			});
		} else {
			const lucideIcon = getIcon(this.iconName);
			if (lucideIcon) {
				icon.appendChild(lucideIcon);
			} else {
				icon.createSpan({
					cls: "copy-to-clipboard-legacy-icon",
					text: "📋",
				});
			}
		}

		icon.toggleClass("show-on-hover", this.showOnHover);
		icon.onclick = () => {
			navigator.clipboard.writeText(this.textToCopy);
			new Notice(`Copied '${this.textToCopy}' to clipboard!`);
		};

		return icon;
	}
}
