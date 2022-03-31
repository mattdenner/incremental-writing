import {
  EventRef,
  TFolder,
  Plugin,
  TFile,
  ButtonComponent,
  getAllTags,
  debounce,
  TAbstractFile,
  normalizePath,
  Platform,
} from "obsidian";
import { Queue } from "./queue";
import { LogTo } from "./logger";
import {
  ReviewFileModal,
  ReviewNoteModal,
} from "./views/modals";
import { IWSettings, DefaultSettings } from "./settings";
import { IWSettingsTab } from "./views/settings-tab";
import { StatusBar } from "./views/status-bar";
import { QueueLoadModal } from "./views/queue-modal";
import { LinkEx } from "./helpers/link-utils";
import { FileUtils } from "./helpers/file-utils";
import { BulkAdderModal } from "./views/bulk-adding";
import { BlockUtils } from "./helpers/block-utils";
import { FuzzyNoteAdder } from "./views/fuzzy-note-adder";
import { MarkdownTableRow } from "./markdown";
import { NextRepScheduler } from "./views/next-rep-schedule";
import { EditDataModal } from "./views/edit-data";
import { DateParser } from "./helpers/parse-date";
import { CreateQueueModal } from "./views/create-queue";

export default class IW extends Plugin {
  public settings: IWSettings;
  public statusBar: StatusBar;
  public queue: Queue;

  //
  // Utils

  public readonly links: LinkEx = new LinkEx(this.app);
  public readonly files: FileUtils = new FileUtils(this.app);
  public readonly blocks: BlockUtils = new BlockUtils(this.app);
  public readonly dates: DateParser = new DateParser(this.app);

  private autoAddNewNotesOnCreateEvent: EventRef;
  private checkTagsOnModifiedEvent: EventRef;
  private tagMap: Map<TFile, Set<string>> = new Map();

  async loadConfig() {
    this.settings = this.settings = Object.assign(
      {},
      DefaultSettings,
      await this.loadData()
    );
  }

  getQueueFiles() {
    const abstractFiles = this.app.vault.getAllLoadedFiles();
    const queueFiles = abstractFiles.filter((file: TAbstractFile) => {
      return (
        file instanceof TFile &&
        file.parent.path === this.settings.queueFolderPath &&
        file.extension === "md"
      );
    });
    return <TFile[]>queueFiles;
  }

  getDefaultQueuePath() {
    return normalizePath(
      [this.settings.queueFolderPath, this.settings.queueFileName].join("/")
    );
  }

  createTagMap() {
    const notes: TFile[] = this.app.vault.getMarkdownFiles();
    for (const note of notes) {
      const fileCachedData = this.app.metadataCache.getFileCache(note) || {};
      const tags = new Set(getAllTags(fileCachedData) || []);
      this.tagMap.set(note, tags);
    }
  }

  async onload() {
    LogTo.Console("Loading...");
    await this.loadConfig();
    this.addSettingTab(new IWSettingsTab(this.app, this));
    this.registerCommands();
    this.subscribeToEvents();
  }

  randomWithinInterval(min: number, max: number) {
    return Math.floor(Math.random() * (max - min + 1) + min);
  }

  checkTagsOnModified() {
    this.checkTagsOnModifiedEvent = this.app.vault.on(
      "modify",
      debounce(
        async (file) => {
          if (!(file instanceof TFile) || file.extension !== "md") {
            return;
          }

          const fileCachedData =
            this.app.metadataCache.getFileCache(file) || {};

          const currentTags = new Set(getAllTags(fileCachedData) || []);
          const lastTags = this.tagMap.get(file) || new Set<string>();

          const setsEqual = (a: Set<string>, b: Set<string>) =>
            a.size === b.size && [...a].every((value) => b.has(value));
          if (setsEqual(new Set(currentTags), new Set(lastTags))) {
            LogTo.Debug("No tag changes.");
            return;
          }

          LogTo.Debug("Updating tags.");
          this.tagMap.set(file, currentTags);
          const newTags = [...currentTags].filter((x) => !lastTags.has(x)); // set difference
          LogTo.Debug("Added new tags: " + newTags.toString());

          const queueFiles = this.getQueueFiles();
          LogTo.Debug("Queue Files: " + queueFiles.toString());

          const queueTagMap = this.settings.queueTagMap;
          const newQueueTags = newTags
            .map((tag) => tag.substr(1))
            .filter((tag) =>
              Object.values(queueTagMap).some((arr) => arr.contains(tag))
            );

          LogTo.Debug("New Queue Tags: " + newQueueTags.toString());
          for (const queueTag of newQueueTags) {
            const addToQueueFiles = queueFiles
              .filter((f) => queueTagMap[f.name.substr(0, f.name.length - 3)])
              .filter((f) =>
                queueTagMap[f.name.substr(0, f.name.length - 3)].contains(
                  queueTag
                )
              );

            for (const queueFile of addToQueueFiles) {
              const queue = new Queue(this, queueFile.path);
              LogTo.Debug(`Adding ${file.name} to ${queueFile.name}`);
              const link = this.files.toLinkText(file);
              const min = this.settings.defaultPriorityMin;
              const max = this.settings.defaultPriorityMax;
              const priority = this.randomWithinInterval(min, max);
              const date = this.dates.parseDate(
                this.settings.defaultFirstRepDate
              );
              const row = new MarkdownTableRow(link, priority, "", 1, date);
              await queue.add(row);
            }
          }
          // already debounced 2 secs but not throttled, true on resetTimer throttles the callback
        },
        3000,
        true
      )
    );
  }

  autoAddNewNotesOnCreate() {
    if (this.settings.autoAddNewNotes) {
      this.autoAddNewNotesOnCreateEvent = this.app.vault.on(
        "create",
        async (file) => {
          if (!(file instanceof TFile) || file.extension !== "md") {
            return;
          }
          const link = this.files.toLinkText(file);
          const min = this.settings.defaultPriorityMin;
          const max = this.settings.defaultPriorityMax;
          const priority = this.randomWithinInterval(min, max);
          const row = new MarkdownTableRow(link, priority, "");
          LogTo.Console("Auto adding new note to default queue: " + link);
          await this.queue.add(row);
        }
      );
    } else {
      if (this.autoAddNewNotesOnCreateEvent) {
        this.app.vault.offref(this.autoAddNewNotesOnCreateEvent);
        this.autoAddNewNotesOnCreateEvent = undefined;
      }
    }
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

  async addSearchButton() {
    const view = await this.getSearchLeafView();
    if (!view) {
      LogTo.Console("Failed to add button to the search pane.");
      return;
    }
    (<any>view).addToQueueButton = new ButtonComponent(
      view.containerEl.children[0].firstChild as HTMLElement
    )
      .setClass("nav-action-button")
      .setIcon("sheets-in-box")
      .setTooltip("Add to IW Queue")
      .onClick(async () => await this.addSearchResultsToQueue());
  }

  async getSearchResults(): Promise<TFile[]> {
    return (await this.getFound()) as TFile[];
  }

  async addSearchResultsToQueue() {
    const files = await this.getSearchResults();
    const pairs = files.map((file) =>
      this.links.createAbsoluteLink(normalizePath(file.path), "")
    );
    if (pairs && pairs.length > 0) {
      this.pushLinksIntoQueue(pairs);
    } else {
      LogTo.Console("No files to add.", true);
    }
  }
  
  public pushLinksIntoQueue(links: string[]) {
    new BulkAdderModal(
      this,
      this.queue.queuePath,
      "Add to queue",
      links,
    ).open();
  }

  async updateStatusBar() {
    const table = await this.queue.loadTable();
    this.statusBar.updateCurrentRep(table?.currentRep());
    this.statusBar.updateCurrentQueue(this.queue.queuePath);
  }

  async loadQueue(file: string) {
    if (file && file.length > 0) {
      this.queue = new Queue(this, file);
      await this.updateStatusBar();
      LogTo.Console("Loaded Queue: " + file, true);
    } else {
      LogTo.Console("Failed to load queue.", true);
    }
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
    
    const callbackToCheckcallback = (callback: () => any) => (checking: boolean) => {
      if (checking) return true;
      callback();
      return true;
    };
    
    const withMobileAvailability = 
      (isSupportedOnMobile: boolean, callback: () => any) =>
        withMobileCheckCallback(isSupportedOnMobile, callbackToCheckcallback(callback));

    this.addCommand({
      id: "create-new-iw-queue",
      name: "Create and load a new queue.",
      checkCallback: withMobileAvailability(true, () => new CreateQueueModal(this).open()),
      hotkeys: [],
    });

    //
    // Queue Browsing

    this.addCommand({
      id: "open-queue-current-pane",
      name: "Open queue in current pane.",
      checkCallback: withMobileAvailability(true, () => this.queue.goToQueue(false)),
      hotkeys: [],
    });

    this.addCommand({
      id: "open-queue-new-pane",
      name: "Open queue in new pane.",
      checkCallback: withMobileAvailability(false, () => this.queue.goToQueue(true)),
      hotkeys: [],
    });

    //
    // Repetitions

    this.addCommand({
      id: "current-iw-repetition",
      name: "Current repetition.",
      checkCallback: withMobileAvailability(true, async () => await this.queue.goToCurrentRep()),
      hotkeys: [],
    });

    this.addCommand({
      id: "dismiss-current-repetition",
      name: "Dismiss current repetition.",
      checkCallback: withMobileAvailability(true, async () => await this.queue.dismissCurrent()),
      hotkeys: [],
    });

    this.addCommand({
      id: "next-iw-repetition-schedule",
      name: "Next repetition and manually schedule.",
      checkCallback: withMobileAvailability(true, async () => {
        const table = await this.queue.loadTable();
        if (!table || !table.hasReps()) {
          LogTo.Console("No repetitions!", true);
          return;
        }
        const currentRep = table.currentRep();
        if (await this.queue.nextRepetition()) {
          new NextRepScheduler(this, currentRep, table).open();
        }
      }),
    });

    this.addCommand({
      id: "next-iw-repetition",
      name: "Next repetition.",
      checkCallback: withMobileAvailability(true, async () => await this.queue.nextRepetition()),
      hotkeys: [],
    });

    this.addCommand({
      id: "edit-current-rep-data",
      name: "Edit current rep data. ",
      checkCallback: withMobileAvailability(true, async () => {
        const table = await this.queue.loadTable();
        if (!table || !table.hasReps()) {
          LogTo.Debug("No repetitions!", true);
          return;
        }

        const curRep = table.currentRep();
        if (!curRep) {
          LogTo.Debug("No current repetition!", true);
          return;
        }

        new EditDataModal(this, curRep, table).open();
        await this.updateStatusBar();
      }),
      hotkeys: [],
    });

    //
    // Element Adding.

    this.addCommand({
      id: "note-add-iw-queue",
      name: "Add note to queue.",
      checkCallback: withMobileCheckCallback(true, (checking: boolean) => {
        if (this.files.getActiveNoteFile() !== null) {
          if (!checking) {
            new ReviewNoteModal(this).open();
          }
          return true;
        }
        return false;
      }),
    });

    this.addCommand({
      id: "fuzzy-note-add-iw-queue",
      name: "Add note to queue through a fuzzy finder",
      checkCallback: withMobileAvailability(true, () => new FuzzyNoteAdder(this).open()),
      hotkeys: [],
    });

    //
    // Queue Loading

    this.addCommand({
      id: "load-iw-queue",
      name: "Load a queue.",
      checkCallback: withMobileAvailability(true, () => new QueueLoadModal(this).open()),
      hotkeys: [],
    });
  }

  createStatusBar() {
    this.statusBar = new StatusBar(this.addStatusBarItem(), this);
    this.statusBar.initStatusBar();
  }

  subscribeToEvents() {
    this.app.workspace.onLayoutReady(async () => {
      this.createStatusBar();
      const queuePath = this.getDefaultQueuePath();
      await this.loadQueue(queuePath);
      this.createTagMap();
      this.checkTagsOnModified();
      this.addSearchButton();
      this.autoAddNewNotesOnCreate();
    });

    this.registerEvent(
      this.app.workspace.on("file-menu", (menu, file, _: string) => {
        if (file == null) {
          return;
        }

        if (file instanceof TFile && file.extension === "md") {
          menu.addItem((item) => {
            item
              .setTitle(`Add File to IW Queue`)
              .setIcon("sheets-in-box")
              .onClick((_) => {
                new ReviewFileModal(this, file.path).open();
              });
          });
        } else if (file instanceof TFolder) {
          menu.addItem((item) => {
            item
              .setTitle(`Add Folder to IW Queue`)
              .setIcon("sheets-in-box")
              .onClick((_) => {
                const pairs = this.app.vault
                  .getMarkdownFiles()
                  .filter((f) => this.files.isDescendantOf(f, file))
                  .map((f) =>
                    this.links.createAbsoluteLink(normalizePath(f.path), "")
                  );

                if (pairs && pairs.length > 0) {
                  new BulkAdderModal(
                    this,
                    this.queue.queuePath,
                    "Bulk Add Folder Notes",
                    pairs
                  ).open();
                } else {
                  LogTo.Console("Folder contains no files!", true);
                }
              });
          });
        }
      })
    );
  }

  async removeSearchButton() {
    const searchView = await this.getSearchLeafView();
    let btn = (<any>searchView)?.addToQueueButton;
    if (btn) {
      btn.buttonEl?.remove();
      btn = null;
    }
  }

  unsubscribeFromEvents() {
    for (let e of [
      this.autoAddNewNotesOnCreateEvent,
      this.checkTagsOnModifiedEvent,
    ]) {
      this.app.vault.offref(e);
      e = undefined;
    }
  }

  async onunload() {
    LogTo.Console("Disabled and unloaded.");
    await this.removeSearchButton();
    this.unsubscribeFromEvents();
  }
}
