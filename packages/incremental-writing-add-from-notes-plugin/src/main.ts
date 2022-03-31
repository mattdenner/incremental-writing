import {
  Plugin,
  MarkdownView,
  Platform,
} from "obsidian";
import { LogTo } from "./logger";
import { LinkEx } from "./helpers/link-utils";
import { FileUtils } from "./helpers/file-utils";

export default class IW extends Plugin {
  //
  // Utils

  public readonly links: LinkEx = new LinkEx(this.app);
  public readonly files: FileUtils = new FileUtils(this.app);

  async onload() {
    LogTo.Console("Loading...");
    this.registerCommands();
  }

  registerCommands() {
    //
    // Queue Creation
    
    // Only show certain commands on a mobile device!
    const withMobileCheckCallback = (isSupportedOnMobile: boolean, callback: (checking: boolean) => any) => {
      if (Platform.isMobile && !isSupportedOnMobile) {
        return (_checking: boolean) => false;
      }
      return callback;
    }
    
    const pushLinksIntoQueue = (links: string[]) => {
      const incrementalWritingPlugin = (<any>this.app).plugins.plugins['obsidian-incremental-writing'];
      incrementalWritingPlugin.pushLinksIntoQueue(links);
    };

    //
    // Element Adding.

    this.addCommand({
      id: "add-links-in-selected-text",
      name: "Add links in selected text.",
      checkCallback: withMobileCheckCallback(true, (checking: boolean) => {
        const view = this.app.workspace.getActiveViewOfType(MarkdownView);
        const editor = view?.editor;
        const file = view?.file;

        if (file && editor) {
          if (!checking) {
            const links = this.app.metadataCache.getFileCache(file).links ?? [];
            if (!links || links.length === 0) {
              LogTo.Debug("Active note does not contain any links.", true);
              return;
            }

            const selection = editor.getSelection();
            if (!selection || selection.length === 0) {
              LogTo.Debug("No selected text.", true);
              return;
            }

            const selectedLinks = Array.from(
              links
                .filter((link) => selection.contains(link.original))
                .map((link) => this.links.createAbsoluteLink(link.link, file.path))
                .filter((link) => link !== null && link.length > 0)
                .reduce((set, link) => set.add(link), new Set<string>())
            );

            if (!selectedLinks || selectedLinks.length === 0) {
              LogTo.Debug("No selected links.", true);
              return;
            }

            LogTo.Debug("Selected links: " + selectedLinks.toString());
            pushLinksIntoQueue(selectedLinks);
          }
          return true;
        }
        return false;
      }),
    });

    this.addCommand({
      id: "bulk-add-blocks",
      name: "Bulk add blocks with references to queue.",
      checkCallback: withMobileCheckCallback(false, (checking: boolean) => {
        const file = this.files.getActiveNoteFile();
        if (file != null) {
          if (!checking) {
            const refs = this.app.metadataCache.getFileCache(file).blocks;
            if (!refs) {
              LogTo.Debug("File does not contain any blocks with references.");
            } else {
              const fileLink = this.app.metadataCache.fileToLinktext(
                file,
                "",
                true
              );
              const linkPaths = Object.keys(refs).map((l) => fileLink + "#^" + l);

              pushLinksIntoQueue(linkPaths);
            }
          }
          return true;
        }
        return false;
      }),
    });

    /* TODO: work out how to do this
    this.addCommand({
      id: "block-add-iw-queue",
      name: "Add block to queue.",
      checkCallback: withMobileCheckCallback(false, (checking: boolean) => {
        if (this.files.getActiveNoteFile() != null) {
          if (!checking) {
            new ReviewBlockModal(this).open();
          }
          return true;
        }
        return false;
      }),
      hotkeys: [],
    });
    */

    this.addCommand({
      id: "add-links-within-note",
      name: "Add links within note to queue.",
      checkCallback: withMobileCheckCallback(true, (checking: boolean) => {
        const file = this.files.getActiveNoteFile();
        if (file !== null) {
          if (!checking) {
            const links = this.links.getLinksIn(file);
            if (links && links.length > 0) {
              pushLinksIntoQueue(links);
            } else {
              LogTo.Console("No links in the current file.", true);
            }
          }
          return true;
        }
        return false;
      }),
      hotkeys: [],
    });
  }

  async onunload() {
    LogTo.Console("Disabled and unloaded.");
  }
}
