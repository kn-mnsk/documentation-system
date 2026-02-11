// Base on an implementation by @markedjs (MIT License)
// Source: https://github.com/UziTech/marked-html-renderer/blob/main/src/renderer.ts#L42

import type { MarkedOptions, Parser, Tokens } from 'marked';

/**
 * Custom renderer for Markdown → HTML.
 * Handles code blocks (Mermaid, Bash, generic) and tables.
 */
export const renderer: any = {

  options: null as unknown as MarkedOptions<string, Node | string>,
  parser: null as unknown as Parser<string, Node | string>,

  code(token: Tokens.Code) {
    const langString = token.lang || "plaintext"; // Default to plaintext if no language is provided
    const divEl = document.createElement('div');
    const preEl = document.createElement('pre');
    const codeEl = document.createElement('code');
    codeEl.innerHTML = token.text;

    if (langString === 'mermaid' || langString === 'folder') {
      divEl.className = langString + '-container';
      preEl.className = langString;
      preEl.innerHTML = token.text;
      divEl.appendChild(preEl);

      return divEl.outerHTML;
    }

    codeEl.className = 'language-' + langString;
    preEl.appendChild(codeEl);
    codeEl.innerHTML = token.text;

    // console.log(`Log: marked.renderer.ts renderer code=`, divEl.innerText);
    return preEl.outerHTML;

  },

  table(token: Tokens.Table) {
    const table = document.createElement('table');
    table.className = "md-table"
    const thead = document.createElement('thead');

    const headerCell = document.createDocumentFragment();
    for (let j = 0; j < token.header.length; j++) {
      headerCell.append(this.tablecell(token.header[j]));
    }
    // console.log(`Log: RederService renderer headercell=`, headerCell);
    thead.append(headerCell);

    table.append(thead);

    if (token.rows.length === 0) {
      return table.outerHTML;
    }

    const tbody = document.createElement('tbody');
    for (let j = 0; j < token.rows.length; j++) {
      const row = token.rows[j];

      // const cell = document.createElement('td');
      const cell = document.createDocumentFragment();
      for (let k = 0; k < row.length; k++) {
        cell.append(this.tablecell(row[k]));
      }

      tbody.append(this.tablerow({ text: cell }));
      // console.log(`Log: RederService renderer cell=`, j, cell);
    }

    table.append(tbody);

    const div = document.createElement('div');
    div.className = "md-table-container";
    div.append(table);

    // console.log(`Log: RederService renderer table=`, div);
    return div.outerHTML;
  },


  // tablerow({ text }: any) {
  tablerow(token: Tokens.TableRow) {
    const tr = document.createElement('tr');
    tr.append(token.text);
    // console.log(`Log: RederService renderer tablerow`, tr);

    return tr;
  },

  tablecell(token: Tokens.TableCell) {

    const content = this.parser.parseInline(token.tokens);

    // console.log(`Log: RederService renderer tablecell content=`, token.text);

    const cell = document.createElement(token.header ? 'th' : 'td');

    // cell.innerHTML = token.text;
    cell.innerHTML = content;

    if (token.align) {
      cell.setAttribute('align', token.align);
    }
    // console.log(`Log: RederService renderer tablecell=`, cell.outerHTML, `tonek.header`, token.header);

    return cell;

  },

}

