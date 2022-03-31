import { Plugin, ButtonComponent, TFile, normalizePath } from "obsidian";
import { LogTo } from "./logger";
import { LinkEx } from "./helpers/link-utils";

export default class IW extends Plugin {
  //
  // Utils

  public readonly links: LinkEx = new LinkEx(this.app);

  async onload() {
    LogTo.Console("Loading...");
    this.subscribeToEvents();
  }

  subscribeToEvents() {
    this.app.workspace.onLayoutReady(async () => {
      this.addSearchButton();
    });
  }

  async addSearchButton() {
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
  }

  async getSearchLeafView() {
    return this.app.workspace.getLeavesOfType("search")[0]?.view;
  }

  async getFound() {
    const view = await this.getSearchLeafView();
    if (!view) {
      LogTo.Console("Failed to get search leaf view.");
      return [];
    }
    // @ts-ignore: the `dom` attribute of the view is "secret"
    return Array.from(view.dom.resultDomLookup.keys());
  }

  async getSearchResults(): Promise<TFile[]> {
    return (await this.getFound()) as TFile[];
  }

  async onunload() {
    LogTo.Console("Disabled and unloaded.");
    await this.removeSearchButton();
  }

  async removeSearchButton() {
    const searchView = await this.getSearchLeafView();
    let btn = (<any>searchView)?.addToQueueButton;
    if (btn) {
      btn.buttonEl?.remove();
      btn = null;
    }
  }

  async addSearchResultsToQueue() {
    const files = await this.getSearchResults();
    const links = files.map((file) => this.links.createAbsoluteLink(normalizePath(file.path), ""));
    if (links && links.length > 0) {
      const incrementalWritingPlugin = (<any>this.app).plugins.plugins['obsidian-incremental-writing'];
      incrementalWritingPlugin.pushLinksIntoQueue(links);
    } else {
      LogTo.Console("No files to add.", true);
    }
  }
}
