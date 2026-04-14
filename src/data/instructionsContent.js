/** @type {{ step: number, action: string, notes: string }[]} */
export const PHONE_INSTRUCTION_ROWS = [
  {
    step: 1,
    action: 'Open the note you want in Apple Notes on your iPhone.',
    notes: 'This flow exports one note at a time.',
  },
  {
    step: 2,
    action: 'Tap the Share icon.',
    notes: 'Usually the square with an arrow.',
  },
  {
    step: 3,
    action: 'Tap Export as Markdown.',
    notes: 'You need the Markdown export, not plain text or PDF.',
  },
  {
    step: 4,
    action: 'Tap Save to Files.',
    notes: 'Pick a folder you can find later (for example iCloud Drive or On My iPhone).',
  },
  {
    step: 5,
    action: 'Save the .md file somewhere you can access from your computer or browser.',
    notes: 'You will upload this single file to Notes Nursery.',
  },
  {
    step: 6,
    action: 'On the Notes Nursery site, use Import to upload that markdown file.',
    notes: 'This is for one file per export, not a whole folder. There is no bulk “export everything from the phone” path yet; for many notes, use “By Script” on a Mac.',
  },
];

/** @type {{ step: number, action: string, notes: string }[]} */
export const SCRIPT_INSTRUCTION_ROWS = [
  {
    step: 1,
    action: 'On your Mac, open Script Editor (in Applications → Utilities).',
    notes: 'This workflow is the only current bulk-export option. It is aimed at heavier or more technical users.',
  },
  {
    step: 2,
    action: 'Create a new script and paste the AppleScript from the section below.',
    notes: 'Do not change the script unless you know what you are doing.',
  },
  {
    step: 3,
    action: 'Run the script (▶ Run).',
    notes: 'Apple Notes must be allowed to run; the script may take a while if you have many notes.',
  },
  {
    step: 4,
    action: 'On your Desktop, open the folder notes-export.',
    notes: 'Each note becomes a .md file. You also get export-log.csv and export-errors.txt for auditing.',
  },
  {
    step: 5,
    action: 'Review the markdown files and logs as needed.',
    notes: 'Fix or re-run failed notes using export-errors.txt if something went wrong.',
  },
  {
    step: 6,
    action: 'Upload the .md files (or the folder contents) using Notes Nursery Import.',
    notes: 'Match how you normally import: multiple files are supported.',
  },
];

/** @type {{ step: number, action: string, notes: string }[]} */
export const MANUAL_INSTRUCTION_ROWS = [
  {
    step: 1,
    action: 'Create a new text file with a .md extension and start with a # Title line.',
    notes: 'The importer reads the first line as the note title. You can use any editor.',
  },
  {
    step: 2,
    action: 'Choose an Apple Notes–compatible HTML body or a Markdown-first body (see examples below).',
    notes:
      'Imported files are stored as HTML when the body is HTML-heavy. Notes you create in the app are Markdown and render with Markdown + GitHub-style extras.',
  },
  {
    step: 3,
    action: 'Add optional Created: / Modified: lines at the end, then import on the Import page.',
    notes: 'Matches how phone and script exports structure files.',
  },
];
