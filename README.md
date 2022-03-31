# Incremental Writing Plugins for Obsidian
## Context
This is a restructure of the [Incremental Writing Plugin](https://github.com/bjsi/incremental-writing) created by James.

Whilst that plugin was useful on a desktop machine, it didn't work on mobile which is a big part of my workflow. And I had some opinionated views on some of the behaviours: I didn't add notes from a search, and I didn't use some of the commands to add blocks & links to the queue.

So I split the behaviour across a few plugins. Most of the functionality remains. It's just that you need several plugins to get the same functionality.

But a win in this is that there is now an API that can be used to add to the queue. This means that you can use `app.plugins.plugins['obsidian-incremental-writing'].pushLinksToQueue(string[])` to add links to notes quickly. And I'll expand this API over time.

NOTE: This is all subject to massive change as I settle into what feels right for me.

## WARNING
The mobile support may be very very brittle and could ruin your notes. Whilst it hasn't broken for me in several weeks of regularly usage, I should point out that I am not you. Your way of using this tool may find bugs that I haven't spotted.

## Support
All of this is based on James' work. I have left his name wherever his work remains.

I encourage you to visit the [support](https://github.com/bjsi/incremental-writing#support) section of his plugin README and donate.

## Plugins

### obsidian-incremental-writing
This plugin allows you to do [incremental writing](https://supermemo.guru/wiki/Incremental_writing) in Obsidian. In incremental writing you add notes and blocks from your Obsidian vault to prioritised queues to be reviewed incrementally over time.

James has a [good set of resources for incremental writing](https://github.com/bjsi/incremental-writing#incremental-writing-plugin-for-obsidian) as part of the original plugin.

You should strongly consider installing the [Natural Language Dates](https://github.com/argenos/nldates-obsidian) plugin alongside this one. It allows you to use natural language when you are asked to provide a date (e.g. "tomorrow" or "in two weeks") rather than having to type out a date like "2020-02-02".

You can right click on folders, files, and links to add them to queues through the context menu.

#### Commands
- **Load a queue**: The plugin supports multiple incremental writing queues that you can switch between using a fuzzy search menu. This command uses a fuzzy search component to search in the queue folder specified in the settings for queue files.
- **Open queue in current pane**: Open the currently loaded queue in the current pane. You can check which queue is currently loaded by looking at the status bar at the bottom of the Obsidian window.
- **Open queue in new pane**: Same as above, but open the currently loaded queue in a new pane.
- **Current repetition**: Goes to the current repetition for the currently loaded queue.
- **Dismiss current repetition**: Dismiss the current repetition from the queue. This note or block will not show up again for review.
- **Next repetition**: Goes to the next repetition for the currently loaded queue.
- **Next repetition and manually schedule**: Executes next repetition and opens a modal for you to edit the next repetition date and interval manually.
- **Edit current repetition data**: Edit the interval, priority, next repetition date or notes for the current repetition.
- **Add note to queue**: Adds the active note in Obsidian to the currently loaded incremental writing queue.
- **Add note to queue through a fuzzy finder**: Opens a fuzzy finder which you can use to add any note in your vault to the current incremental writing queue.

#### Scheduling Options
There are currently two scheduling styles to choose from: A-Factor and Simple.
- **Simple**: When you hit next repetition, the current repetition gets pushed to the end of the queue by setting its priority to 99.
- **A-Factor**: When you hit next repetition, the interval between repetitions gets multiplied by the A-Factor to work out the next repetition date.

#### Automatically Add Notes to Queues
There are some options for automatically adding notes to queues.
- In the settings page you can define a list of queue names and associated tags. When you modify a note, the plugin will check to see if a queue tag was added. If so, the note will automatically get added to the queue. 
- When toggled on in the settings, new will automatically get added to the default queue. It is recommended to use the tag method above as it gives more control.

NOTE: The tag method only applies to newly created notes. The recommended workflow is add the `obisidian-incremental-writing-add-from-search` plug (below) and to begin by searching for all notes with a given tag. You can then save these results to a queue.

#### Important! Priorities
Confusingly, low priority numbers correspond to high priorities! That means your daily queue of repetitions will be sorted from lowest priority number (most important) to highest priority number (least important). 

The explanation for this can be found in [James' original plugin README](https://github.com/bjsi/incremental-writing#important-priorities).

### obsidian-incremental-writing-add-from-note
This plugin adds some additional commands that can add links & blocks, from the current note or selection, to the queue.

#### Commands
- **Add block to queue**: Adds the current block to the currently loaded incremental writing queue.
- **Add links within the current note to a queue**: Add any links to other notes within the current note to a queue.
- **Bulk add blocks with references to queue**: Add all of the blocks with "^references" to an incremental writing queue.

### obsidian-incremental-writing-add-from-search
This adds a button to the search bar in Obsidian to enable you to add the results to the current queue.

NOTE: This uses private Obsidian APIs which could cause the plugin to break when Obsidian updates.

## Building
You should be able to build everything using [Nx](https://nx.dev/):

```sh
> git clone git@github.com:mattdenner/incremental-writing.git
> cd incremental-writing
> npm install
> nx run-many --target=build --all
```

The `data.json`, `manifest.json`, and the `main.cjs.js` files are then under the `dist` directory. If you are copying these into your Obsidian vault, please rename `main.cjs.js` to `main.js` whilst I figure out how to do that from Nx!
