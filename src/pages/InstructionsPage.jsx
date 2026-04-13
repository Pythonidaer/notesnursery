import { useId, useRef, useState } from 'react';
import { APPLE_NOTES_EXPORT_SCRIPT } from '../data/instructionsAppleScript.js';
import {
  MANUAL_INSTRUCTION_ROWS,
  PHONE_INSTRUCTION_ROWS,
  SCRIPT_INSTRUCTION_ROWS,
} from '../data/instructionsContent.js';
import {
  APPLE_NOTES_STYLE_EXAMPLE,
  MARKDOWN_CANONICAL_EXAMPLE,
} from '../data/instructionsManualExamples.js';
import { MANUAL_HTML_SUPPORT_ROWS } from '../data/instructionsManualSupport.js';
import styles from './InstructionsPage.module.css';

const TABS = [
  { id: 'phone', label: 'By Phone' },
  { id: 'script', label: 'By Script' },
  { id: 'manual', label: 'Manually' },
];

/**
 * @param {{ rows: { step: number, action: string, notes: string }[], caption?: string }} props
 */
function InstructionTable({ rows, caption }) {
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        {caption ? <caption className={styles.tableCaption}>{caption}</caption> : null}
        <thead>
          <tr>
            <th scope="col" className={styles.thStep}>
              Step
            </th>
            <th scope="col">Action</th>
            <th scope="col">Notes</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.step}>
              <td className={styles.tdStep}>{row.step}</td>
              <td>{row.action}</td>
              <td className={styles.tdNotes}>{row.notes}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * @param {{ rows: { tag: string, role: string, notes: string }[] }} props
 */
function HtmlSupportTable({ rows }) {
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <caption className={styles.tableCaption}>Supported HTML (Apple Notes–style bodies)</caption>
        <thead>
          <tr>
            <th scope="col" className={styles.thTag}>
              Element
            </th>
            <th scope="col">Role</th>
            <th scope="col">Notes</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.tag}>
              <td className={styles.tdTag}>
                <code className={styles.tagCode}>{row.tag}</code>
              </td>
              <td>{row.role}</td>
              <td className={styles.tdNotes}>{row.notes}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * @param {{ label: string, children: string }} props
 */
function CodeExample({ label, children }) {
  return (
    <figure className={styles.codeFigure}>
      <figcaption className={styles.codeCaption}>{label}</figcaption>
      <div className={styles.codeScroll}>
        <pre className={styles.pre}>
          <code className={styles.code}>{children}</code>
        </pre>
      </div>
    </figure>
  );
}

export default function InstructionsPage() {
  const [activeTab, setActiveTab] = useState(/** @type {'phone' | 'script' | 'manual'} */ ('phone'));
  const baseId = useId();
  const tabRefs = useRef(/** @type {(HTMLButtonElement | null)[]} */ ([]));

  const goToIndex = (/** @type {number} */ next) => {
    const id = TABS[next]?.id;
    if (!id) return;
    setActiveTab(id);
    requestAnimationFrame(() => {
      tabRefs.current[next]?.focus();
    });
  };

  /**
   * @param {React.KeyboardEvent<HTMLButtonElement>} e
   * @param {number} index
   */
  const onTabKeyDown = (e, index) => {
    const len = TABS.length;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      goToIndex((index + 1) % len);
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      goToIndex((index - 1 + len) % len);
    } else if (e.key === 'Home') {
      e.preventDefault();
      goToIndex(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      goToIndex(len - 1);
    }
  };

  return (
    <div className={styles.wrap}>
      <h1 className={styles.heading}>Preparing notes for upload</h1>
      <p className={styles.lead}>
        There are several ways to get your notes into Markdown files that you can import into Notes Nursery.
        Pick the option that fits your device and how technical you want to get.
      </p>

      <div
        className={styles.tabList}
        role="tablist"
        aria-label="How you prepare notes for import"
      >
        {TABS.map((tab, index) => {
          const selected = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              ref={(el) => {
                tabRefs.current[index] = el;
              }}
              type="button"
              role="tab"
              id={`${baseId}-tab-${tab.id}`}
              className={styles.tab}
              aria-selected={selected}
              aria-controls={`${baseId}-panel-${tab.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setActiveTab(/** @type {'phone' | 'script' | 'manual'} */ (tab.id))}
              onKeyDown={(e) => onTabKeyDown(e, index)}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <div
        id={`${baseId}-panel-phone`}
        role="tabpanel"
        aria-labelledby={`${baseId}-tab-phone`}
        hidden={activeTab !== 'phone'}
        className={styles.panel}
      >
        <p className={styles.panelIntro}>
          <strong>By Phone</strong> is the most common and easiest path for many people, especially on mobile.
          You export <em>one</em> note as a single Markdown file, then upload that file. There is not currently a
          bulk version of this same workflow from the phone.
        </p>
        <InstructionTable
          rows={PHONE_INSTRUCTION_ROWS}
          caption="Steps to export from iPhone and import one file"
        />
      </div>

      <div
        id={`${baseId}-panel-script`}
        role="tabpanel"
        aria-labelledby={`${baseId}-tab-script`}
        hidden={activeTab !== 'script'}
        className={styles.panel}
      >
        <p className={styles.panelIntro}>
          <strong>By Script</strong> is the bulk-import option on a Mac. It uses AppleScript to dump notes from the
          Apple Notes app into a folder on your Desktop. It is aimed at heavier or more technical users. It may not be
          used often, but it is the only current way to export many notes at once from Notes.app.
        </p>
        <p className={styles.panelIntro}>
          The script creates a <code className={styles.inlineCode}>notes-export</code> folder on the Desktop with
          Markdown files, plus <code className={styles.inlineCode}>export-log.csv</code> and{' '}
          <code className={styles.inlineCode}>export-errors.txt</code> for auditing.
        </p>
        <InstructionTable
          rows={SCRIPT_INSTRUCTION_ROWS}
          caption="Steps to run the export script and import"
        />
        <h2 className={styles.scriptHeading}>AppleScript (paste into Script Editor)</h2>
        <p className={styles.scriptHint}>
          Copy the script below exactly. Run it from Script Editor after granting any prompts for Notes.
        </p>
        <div className={styles.codeScroll}>
          <pre className={styles.pre}>
            <code className={styles.code}>{APPLE_NOTES_EXPORT_SCRIPT}</code>
          </pre>
        </div>
      </div>

      <div
        id={`${baseId}-panel-manual`}
        role="tabpanel"
        aria-labelledby={`${baseId}-tab-manual`}
        hidden={activeTab !== 'manual'}
        className={styles.panel}
      >
        <p className={styles.panelIntro}>
          <strong>Manually</strong> is for technical users who build <code className={styles.inlineCode}>.md</code> files
          by hand—including people without Apple devices. You can mirror real Apple Notes exports (HTML-heavy) or write
          cleaner Markdown. The first line must stay a Markdown <code className={styles.inlineCode}># Title</code>; the
          importer uses it as the note title in the library.
        </p>
        <InstructionTable rows={MANUAL_INSTRUCTION_ROWS} caption="Quick steps" />

        <h2 className={styles.manualH2} id={`${baseId}-manual-apple-html`}>
          Apple Notes compatible format
        </h2>
        <p className={styles.manualP}>
          Apple Notes exports often put HTML inside the <code className={styles.inlineCode}>.md</code> file:{' '}
          <code className={styles.inlineCode}>&lt;div&gt;</code> blocks, <code className={styles.inlineCode}>&lt;br&gt;</code>{' '}
          for spacing, <code className={styles.inlineCode}>&lt;ul class=&quot;Apple-dash-list&quot;&gt;</code>, list items,
          and sometimes an <code className={styles.inlineCode}>&lt;h1&gt;</code> nested in a div. Metadata usually appears
          at the bottom as <code className={styles.inlineCode}>Created:</code> and <code className={styles.inlineCode}>Modified:</code>{' '}
          lines—the same pattern the importer understands.
        </p>
        <HtmlSupportTable rows={MANUAL_HTML_SUPPORT_ROWS} />
        <div className={styles.callout} role="note">
          <p className={styles.calloutTitle}>Titles and duplicates</p>
          <ul className={styles.manualList}>
            <li>
              Apple-style files may repeat the title as both <code className={styles.inlineCode}># Title</code> (first line)
              and <code className={styles.inlineCode}>&lt;h1&gt;</code> inside a <code className={styles.inlineCode}>div</code>.
            </li>
            <li>
              <strong>Prefer the Markdown</strong> <code className={styles.inlineCode}># Title</code> as the source of
              truth for the note name in Notes Nursery.
            </li>
            <li>
              Spacing is often <code className={styles.inlineCode}>&lt;div&gt;&lt;br&gt;&lt;/div&gt;</code>—that is normal
              for exports.
            </li>
          </ul>
        </div>

        <h3 className={styles.manualH3}>Canonical Apple Notes–style example</h3>
        <p className={styles.manualP}>
          This example mixes a Markdown title line with HTML in the body, like a cleaned real export. Copy the whole
          block into a <code className={styles.inlineCode}>.md</code> file to experiment.
        </p>
        <CodeExample label="Copy-paste: Apple Notes–style .md file">{APPLE_NOTES_STYLE_EXAMPLE}</CodeExample>

        <h2 className={styles.manualH2} id={`${baseId}-manual-markdown`}>
          Recommended Markdown format
        </h2>
        <p className={styles.manualP}>
          For hand-authored files, Markdown is usually easier to read and edit than raw HTML. The example below is
          intentionally full-featured so you can copy patterns you need.
        </p>
        <p className={styles.manualP}>It includes:</p>
        <ul className={styles.manualList}>
          <li>
            Headings: <code className={styles.inlineCode}>#</code>, <code className={styles.inlineCode}>##</code>,{' '}
            <code className={styles.inlineCode}>###</code>
          </li>
          <li>
            Emphasis: <code className={styles.inlineCode}>**bold**</code>, <code className={styles.inlineCode}>*italic*</code>,{' '}
            <code className={styles.inlineCode}>~~strikethrough~~</code>
          </li>
          <li>Bullet list, numbered list, and checklist items</li>
          <li>Blockquotes, pipe tables, horizontal rules</li>
          <li>Links, image syntax, and a file link for a PDF</li>
          <li>Trailing Created / Modified lines</li>
        </ul>
        <CodeExample label="Copy-paste: Markdown-heavy .md file (authoring reference)">{MARKDOWN_CANONICAL_EXAMPLE}</CodeExample>

        <h2 className={styles.manualH2} id={`${baseId}-manual-guidance`}>
          Guidance
        </h2>
        <ul className={styles.manualList}>
          <li>
            <strong>Apple Notes exports</strong> are HTML-heavy inside the markdown file. That matches how Notes Nursery
            stores and displays the body (as HTML in read mode).
          </li>
          <li>
            <strong>Markdown in the body</strong> is great for authoring, but this app does not run a Markdown renderer on
            import: the body is shown with the browser’s HTML engine. If the body is plain Markdown (for example{' '}
            <code className={styles.inlineCode}>**bold**</code> without HTML tags), you will see those characters literally
            in read mode until you convert the body to HTML (for example with Pandoc or your editor) or switch to the HTML
            patterns above.
          </li>
          <li>
            <strong>Both approaches are valid:</strong> use Apple-style HTML for parity with Notes, or Markdown for
            source clarity—just plan how you want the body to render after import.
          </li>
          <li>
            Keep structure reasonably simple—deep nesting or unusual tags may not match note styling.
          </li>
        </ul>
      </div>
    </div>
  );
}
