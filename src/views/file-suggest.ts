import { App, TAbstractFile, TFile, TFolder } from "obsidian";
import { TextInputSuggest } from "./suggest";
import IW from "../main";
import path from "../helpers/fs-utils";
import { LogTo } from "../logger";

export class FileSuggest extends TextInputSuggest<TFile> {
  folder: () => TFolder;
  plugin: IW;

  constructor(
    plugin: IW,
    inputEl: HTMLInputElement,
    folderFunc: () => TFolder
  ) {
    super(plugin.app, inputEl);
    this.plugin = plugin;
    this.folder = folderFunc;
  }

  getSuggestions(inputStr: string): TFile[] {
    const abstractFiles = this.app.vault.getAllLoadedFiles();
    const files: TFile[] = [];

    for (const file of abstractFiles) {
      if (!(file instanceof TFile)) continue;

      if (!this.plugin.files.isDescendantOf(file, this.folder())) continue;

      if (file.extension !== "md") continue;

      const relPath = path.relative(this.folder().path, file.path);
      if (relPath.contains(inputStr)) files.push(file);
    }

    return files;
  }

  renderSuggestion(file: TFile, el: HTMLElement): void {
    el.setText(path.relative(this.plugin.settings.queueFolderPath, file.path));
  }

  selectSuggestion(file: TFile): void {
    this.inputEl.value = path.relative(
      this.plugin.settings.queueFolderPath,
      file.path
    );
    this.inputEl.trigger("input");
    this.close();
  }
}

export class FolderSuggest extends TextInputSuggest<TFolder> {
  getSuggestions(inputStr: string): TFolder[] {
    const abstractFiles = this.app.vault.getAllLoadedFiles();
    const folders: TFolder[] = [];
    const lowerCaseInputStr = inputStr.toLowerCase();

    abstractFiles.forEach((folder: TAbstractFile) => {
      if (
        folder instanceof TFolder &&
        folder.path.toLowerCase().contains(lowerCaseInputStr)
      ) {
        folders.push(folder);
      }
    });

    return folders;
  }

  renderSuggestion(file: TFolder, el: HTMLElement): void {
    el.setText(file.path);
  }

  selectSuggestion(file: TFolder): void {
    this.inputEl.value = file.path;
    this.inputEl.trigger("input");
    this.close();
  }
}
