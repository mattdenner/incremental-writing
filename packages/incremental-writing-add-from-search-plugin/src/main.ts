import { Plugin, ButtonComponent, TFile, normalizePath } from "obsidian";
import { LogTo } from "./logger";
import { LinkEx } from "./helpers/link-utils";

export default class IW extends Plugin {
  async onload() {
    LogTo.Console("Loading...");

    this.app.workspace.onLayoutReady(async () => {
      const view = await this.getSearchLeafView();
      if (!view) {
        LogTo.Console("Failed to add button to the search pane.");
        return;
      }
      (<any>view).addToQueueButton = 
        new ButtonComponent( view.containerEl.children[0].firstChild as HTMLElement)
          .setClass("nav-action-button")
          .setIcon("sheets-in-box")
          .setTooltip("Add to IW Queue")
          .onClick(async () => await this.addSearchResultsToQueue());
    });
  }

  private async getSearchLeafView() {
    return this.app.workspace.getLeavesOfType("search")[0]?.view;
  }

  async onunload() {
    LogTo.Console("Disabled and unloaded.");
    const searchView = await this.getSearchLeafView();
    let btn = (<any>searchView)?.addToQueueButton;
    if (btn) {
      btn.buttonEl?.remove();
      btn = null;
    }
  }

  private async addSearchResultsToQueue() {
    const view = await this.getSearchLeafView();
    if (!view) {
      LogTo.Console("Failed to get search leaf view.");
      return
    }

    // @ts-ignore: the `dom` attribute of the view is "secret"
    const files = Array.from(view.dom.resultDomLookup.keys()) as TFile[];
    const links = files.map((file) => new LinkEx(this.app).createAbsoluteLink(normalizePath(file.path), ""));
    if (!links || links.length === 0) {
      LogTo.Console("No files to add.", true);
      return;
    }

    const incrementalWritingPlugin = (<any>this.app).plugins.plugins['obsidian-incremental-writing'];
    incrementalWritingPlugin.pushLinksIntoQueue(links);
  }
}
