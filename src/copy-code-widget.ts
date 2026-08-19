import { EditorView, WidgetType } from "@codemirror/view";
import { Notice, getIcon } from "obsidian";

export class CopyWidget extends WidgetType {
  showOnHover: boolean;
  iconName: string;
  useLegacyIcon: boolean;
  constructor(showOnHover: boolean, iconName: string, useLegacyIcon: boolean) { 
    super();
    this.showOnHover = showOnHover;
    this.iconName = iconName;
    this.useLegacyIcon = useLegacyIcon;
  }

  toDOM(view: EditorView): HTMLElement {
    const icon = createSpan({cls:  "copy-to-clipboard-icon"});
    
    if (this.useLegacyIcon) {
      icon.setText("\xa0📋");
    } else {
      const lucideIcon = getIcon(this.iconName);
      if (lucideIcon) {
        icon.appendChild(lucideIcon);
      } else {
        icon.setText("\xa0📋");
      }
    }
    
    icon.toggleClass("show-on-hover", this.showOnHover)
    icon.onclick = (event) => {
        const element = (event.currentTarget as HTMLElement)
        let previousElement = element.previousElementSibling
        while(previousElement && !previousElement.matches('.cm-inline-code:not(.cm-formatting)')) {
          previousElement = previousElement.previousElementSibling
        }

        const textToCopy = previousElement?.textContent
        if(textToCopy) {
            navigator.clipboard.writeText(textToCopy)
            new Notice(`Copied '${textToCopy}' to clipboard!`);
        }
    }

    return icon;
  }
}
