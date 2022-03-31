import { Notice } from "obsidian";

export class LogTo {
  static getTime() {
    return new Date().toTimeString().substr(0, 8);
  }

  static Debug(message: string, notify = false) {
    console.debug(`[${LogTo.getTime()}] (search): ${message}`);
    if (notify) new Notice(message);
  }

  static Console(message: string, notify = false) {
    console.log(`[${LogTo.getTime()}] (search): ${message}`);
    if (notify) new Notice(message);
  }
}
