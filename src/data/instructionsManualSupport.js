/** @type {{ tag: string, role: string, notes: string }[]} */
export const MANUAL_HTML_SUPPORT_ROWS = [
  { tag: '<div>', role: 'Primary block container', notes: 'Apple Notes wraps most body content in divs.' },
  { tag: '<br>', role: 'Line breaks / spacing', notes: 'Often paired with empty <div><br></div> for vertical space.' },
  { tag: '<strong>, <b>', role: 'Bold', notes: 'Use either; both are common in exports.' },
  { tag: '<em>, <i>', role: 'Italic', notes: 'Use either; both are common in exports.' },
  { tag: '<u>', role: 'Underline', notes: 'Rendered if the browser supports it.' },
  { tag: '<s>, <del>', role: 'Strikethrough', notes: 'Either tag is fine for struck-through text.' },
  { tag: '<ul class="Apple-dash-list">', role: 'Apple-style bullet list', notes: 'Real exports use this class name for dash lists.' },
  { tag: '<ol>', role: 'Numbered list', notes: 'Standard ordered lists.' },
  { tag: '<li>', role: 'List item', notes: 'Used inside ul or ol.' },
  { tag: '<blockquote>', role: 'Quoted text', notes: 'Block quotes.' },
  { tag: '<a href="">', role: 'Links', notes: 'Use absolute https URLs for reliability.' },
  { tag: '<h1>, <h2>, <h3>', role: 'Headings inside the body', notes: 'May duplicate the Markdown # title line; see guidance below.' },
  { tag: '<img>', role: 'Images', notes: 'Use a reachable URL or path; local paths only work if the browser can load them.' },
  { tag: '<table>', role: 'Tables', notes: 'Standard table markup; note view styles tables for readability.' },
];
