import { getIcon } from "obsidian";
import type { IconPosition } from "./icon-position";

interface CopyIconOptions {
	showOnHover: boolean;
	iconName: string;
	useLegacyIcon: boolean;
	iconPosition: IconPosition;
}

export function createCopyIcon(options: CopyIconOptions): HTMLSpanElement {
	const icon = createSpan({
		cls: `copy-to-clipboard-icon icon-position-${options.iconPosition}`,
	});

	if (!options.useLegacyIcon) {
		const lucideIcon = getIcon(options.iconName);
		if (lucideIcon) {
			icon.appendChild(lucideIcon);
		} else {
			appendLegacyIcon(icon);
		}
	} else {
		appendLegacyIcon(icon);
	}

	icon.toggleClass("show-on-hover", options.showOnHover);
	return icon;
}

function appendLegacyIcon(container: HTMLElement): void {
	container.createSpan({
		cls: "copy-to-clipboard-legacy-icon",
		text: "📋",
	});
}
