import { WidgetType } from "@codemirror/view";
import { copyTextToClipboard } from "./clipboard";
import { createCopyIcon } from "./copy-icon";
import type { IconPosition } from "./icon-position";

export class CopyWidget extends WidgetType {
	constructor(
		private readonly showOnHover: boolean,
		private readonly iconName: string,
		private readonly useLegacyIcon: boolean,
		private readonly iconPosition: IconPosition,
		private readonly textToCopy: string
	) {
		super();
	}

	toDOM(): HTMLElement {
		const icon = createCopyIcon({
			showOnHover: this.showOnHover,
			iconName: this.iconName,
			useLegacyIcon: this.useLegacyIcon,
			iconPosition: this.iconPosition,
		});

		icon.onclick = () => {
			copyTextToClipboard(this.textToCopy);
		};

		return icon;
	}
}
