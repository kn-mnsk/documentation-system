// Base on an implementation by @markedjs (MIT License)
// Source: https://github.com/UziTech/marked-html-renderer/blob/main/src/renderer.ts#L42

import type { MarkedOptions, Parser, Tokens } from 'marked';

  /**
   * Custom renderer for Markdown → HTML.
   * Handles code blocks (Mermaid, Bash, generic) and tables.
   */
  export const renderer: any = {

    options: null as unknown as MarkedOptions<DocumentFragment, Node | string>,
    parser: null as unknown as Parser<DocumentFragment, Node | string>,

    code(token: Tokens.Code): string {
      const language = token.lang || "plaintext"; // Default to plaintext if no language is provided

      // Wrap the folowings blocks in a div
      if (language === "mermaid") {
        // console.log(`Log MarkdownRenderService render code() langauge=`, language, token.text);
        return `<div class="mermaid-container"><pre class="mermaid">${token.text}</pre></div>`;
      }

      if (language === "folder" ) {
        // Wrap Bash code blocks in a div
        return `<div class="folder-container">
        <pre class="folder"><code>${token.text}<code></pre></div>`;
      }

      return `<pre><code class="language-${language}">${token.text}</code></pre>`;

    },

    table(token: Tokens.Table) {
      const table = document.createElement('table');
      table.className = "md-table"
      const thead = document.createElement('thead');

      const headerCell = document.createDocumentFragment();
      for (let j = 0; j < token.header.length; j++) {
        headerCell.append(this.tablecell(token.header[j]));
      }
      thead.append(this.tablerow(headerCell));
      table.append(thead);

      if (token.rows.length === 0) {
        return table.outerHTML;
      }

      const tbody = document.createElement('tbody');
      for (let j = 0; j < token.rows.length; j++) {
        const row = token.rows[j];

        const cell = document.createDocumentFragment();
        for (let k = 0; k < row.length; k++) {
          cell.append(this.tablecell(row[k]));
        }

        tbody.append(this.tablerow(cell));
      }

      table.append(tbody);

      const div = document.createElement('div');
      div.className = "md-table-container";
      div.append(table);
      return div.outerHTML;
    },

    tablerow(text: any) {
      const tr = document.createElement('tr');
      tr.append(text);
      return tr;
    },

    tablecell(token: Tokens.TableCell) {

      const content = this.parser.parseInline(token.tokens);

      // console.log(`Log: RederService renderer tablecell content=`, content);

      const cell = document.createElement(token.header ? 'th' : 'td');

      cell.innerHTML = content;

      if (token.align) {
        cell.setAttribute('align', token.align);
      }
      // console.log(`Log: RederService renderer tablecell`, out);

      return cell;

    },

  }

