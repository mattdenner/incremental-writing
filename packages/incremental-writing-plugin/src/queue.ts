import { MarkdownTable, MarkdownTableRow } from "./markdown";
import { LogTo } from "./logger";
import IW from "./main";
import matter from "./helpers/markdown";
import { GrayMatterFile } from "./helpers/markdown";
import { NextRepScheduler } from "./views/next-rep-schedule";

export class Queue {
  queuePath: string;
  plugin: IW;

  constructor(plugin: IW, filePath: string) {
    this.plugin = plugin;
    this.queuePath = filePath;
  }

  async createTableIfNotExists() {
    let data = new MarkdownTable(this.plugin).toString();
    await this.plugin.files.createIfNotExists(this.queuePath, data);
  }

  async goToQueue(newLeaf: boolean) {
    await this.createTableIfNotExists();
    await this.plugin.files.goTo(this.queuePath, newLeaf);
  }

  async dismissCurrent() {
    let table = await this.loadTable();
    if (!table || !table.hasReps()) {
      LogTo.Debug("No repetitions!", true);
      if (table.removeDeleted) await this.writeQueueTable(table);
      return;
    }

    let curRep = table.currentRep();
    if (!curRep.isDue()) {
      LogTo.Debug("No due repetition to dismiss.", true);
      if (table.removeDeleted) await this.writeQueueTable(table);
      return;
    }

    table.removeCurrentRep();
    LogTo.Console("Dismissed repetition: " + curRep.link, true);
    await this.writeQueueTable(table);
    await this.plugin.updateStatusBar();
  }

  async loadTable(): Promise<MarkdownTable> {
    let text: string = await this.readQueue();
    if (!text) {
      LogTo.Debug("Failed to load queue table.");
      return;
    }

    let fm = this.getFrontmatterString(text);
    let table = new MarkdownTable(this.plugin, fm, text);
    table.removeDeleted();
    table.sortReps();
    return table;
  }

  getFrontmatterString(text: string): GrayMatterFile<string> {
    return matter(text);
  }

  async goToCurrentRep() {
    let table = await this.loadTable();
    if (!table || !table.hasReps()) {
      if (table.removeDeleted) await this.writeQueueTable(table);
      LogTo.Console("No more repetitions!", true);
      return;
    }

    let currentRep = table.currentRep();
    if (currentRep.isDue()) {
      await this.loadRep(currentRep);
    } else {
      LogTo.Console("No more repetitions!", true);
    }

    if (table.removeDeleted) await this.writeQueueTable(table);
  }

  async nextRepetition(): Promise<boolean> {
    const table = await this.loadTable();
    if (!table || !table.hasReps()) {
      LogTo.Console("No more repetitions!", true);
      if (table.removeDeleted) await this.writeQueueTable(table);
      return false;
    }

    const currentRep = table.currentRep();
    const nextRep = table.nextRep();

    // Not due; don't schedule or load
    if (currentRep && !currentRep.isDue()) {
      LogTo.Debug("No more repetitions!", true);
      if (table.removeDeleted) await this.writeQueueTable(table);
      return false;
    }

    table.removeCurrentRep();
    table.schedule(currentRep);

    let repToLoad = null;
    if (currentRep && currentRep.isDue()) {
      repToLoad = currentRep;
    } else if (nextRep && nextRep.isDue()) {
      repToLoad = nextRep;
    }

    if (repToLoad) await this.loadRep(repToLoad);
    else LogTo.Debug("No more repetitions!", true);

    await this.writeQueueTable(table);

    if (this.plugin.settings.askForNextRepDate) {
      new NextRepScheduler(this.plugin, currentRep, table).open();
    }
    await this.plugin.updateStatusBar();
    return true;
  }

  private async loadRep(repToLoad: MarkdownTableRow) {
    if (!repToLoad) {
      LogTo.Console("Failed to load repetition.", true);
      return;
    }

    this.plugin.statusBar.updateCurrentRep(repToLoad);
    LogTo.Console("Loading repetition: " + repToLoad.link, false);
    await this.plugin.app.workspace.openLinkText(repToLoad.link, "", false, {
      active: true,
    });
  }

  async add(...rows: MarkdownTableRow[]) {
    await this.createTableIfNotExists();
    const table = await this.loadTable();
    if (!table) {
      LogTo.Debug("Failed to create table.", true);
      return;
    }

    for (const row of rows) {
      if (table.hasRowWithLink(row.link)) {
        LogTo.Console(
          `Skipping ${row.link} because it is already in your queue!`,
          true
        );
        continue;
      }

      if (row.link.contains("|") || row.notes.contains("|")) {
        LogTo.Console(
          `Skipping ${row.link} because it contains a pipe character.`,
          true
        );
        continue;
      }

      table.addRow(row);
      LogTo.Console("Added note to queue: " + row.link, true);
    }

    await this.writeQueueTable(table);
    await this.plugin.updateStatusBar();
  }

  getQueueAsTFile() {
    return this.plugin.files.getTFile(this.queuePath);
  }

  async writeQueueTable(table: MarkdownTable): Promise<void> {
    let queue = this.getQueueAsTFile();
    if (queue) {
      table.removeDeleted();
      let data = table.toString();
      table.sortReps();
      await this.plugin.app.vault.modify(queue, data);
    } else {
      LogTo.Console("Failed to write queue because queue file was null.", true);
    }
  }

  async readQueue(): Promise<string> {
    let queue = this.getQueueAsTFile();
    try {
      return await this.plugin.app.vault.read(queue);
    } catch (Exception) {
      return;
    }
  }
}
