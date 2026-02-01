import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Tokens, Tokenizer, Marked, Renderer, MarkedOptions, Parser, marked, parser, lexer, parse } from 'marked';
import { Observable } from 'rxjs';
// import mermaid from 'mermaid';

import { KatexService } from './katex.service';
import { MermaidService } from './mermaid.service';

import { sanitizeNodeText } from '../../global.utils/global.utils';

@Injectable({ providedIn: 'root' })
export class RenderService {

  $title = signal<string>('MarkService');


  //Reference: https://marked.js.org/using_advanced

  // private marked: Marked | null = null;

  /**
   * Custom renderer for Markdown → HTML.
   * Handles code blocks (Mermaid, Bash, generic) and tables.
   */

  // Base on an implementation by @markedjs (MIT License)
  // Source: https://github.com/UziTech/marked-html-renderer/blob/main/src/renderer.ts#L42
  private renderer: any = {

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

  constructor(
    private http: HttpClient,
    private katexService: KatexService,
    private mermaidService: MermaidService,
  ) {
    this.initializeMarked();
    this.mermaidService.initializeMermaidCore();
  }

  /**
  * Load raw Markdown text from a URL.
  */
  loadMarkdown(url: string): Observable<string> {
    return this.http.get(url, { responseType: 'text' });
  }

  /**
   * Main pipeline:
   * 1. Markdown → HTML
   * 2. Sanitize text nodes
   * 3. Render KaTeX
   * 4. Apply Mermaid theme
   * 5. Wait for DOM + CSS + fonts + transitions
   * 6. Render Mermaid diagrams
   * 7. Wait again for Mermaid’s own layout changes
   */
  async renderMarkdownToDOM(
    markdown: string,
    filetype: string | undefined,
    viewer: HTMLElement,
    isDarkMode: boolean
  ): Promise<void> {

    // 1. Markdown -> html
    const html = marked.parse(markdown) as string;
    // const html = this.marked?.parse(markdown) as string;
    viewer.innerHTML = html;
    // console.log(`Log: ${this.$title()} renderMarkdownToDOM html=`, html);

    // 2. Sanitize text nodes (replace non-breaking spaces)
    sanitizeNodeText(viewer);
    if (filetype !== "ts") {
      // 3. Render KaTeX math expressions
      this.katexService.renderMath(viewer);

      // 4. Apply Mermaid theme
      this.mermaidService.applyMermaidTheme(isDarkMode);

      // 5. Wait for DOM + CSS + fonts + transitions
      await this.waitForViewerToSettle(viewer);;

      // 6. Render Mermaid diagrams
      await this.mermaidService.renderMermaidBlocks(viewer);
    }

    // 7. Wait again for Mermaid’s own layout changes
    await this.waitForViewerToSettle(viewer);

    // force layout flush
    viewer.getBoundingClientRect();

    // console.log(`Log: ${this.title()} \nrenderToElement() Finished `);
  }

  //-----------------------------------------------------
  // Layout Stabilization, mainly for mermaid rendering
  //-----------------------------------------------------

  // refer to https://developer.mozilla.org/en-US/docs/Web/API/ResizeObserver#instance_properties for resizeObeser
  // https://mdn.github.io/dom-examples/resize-observer/resize-observer-text.html
  // https://github.com/mdn/dom-examples/blob/main/resize-observer/resize-observer-text.html

  private waitForViewerToSettle(viewer: HTMLElement): Promise<void> {
    return new Promise(resolve => {
      let lastSize = viewer.getBoundingClientRect();
      let stableTimer: any;

      const observer = new ResizeObserver(() => {
        const newSize = viewer.getBoundingClientRect();

        const sizeChanged =
          newSize.width !== lastSize.width ||
          newSize.height !== lastSize.height;

        if (sizeChanged) {
          lastSize = newSize;
          clearTimeout(stableTimer);

          stableTimer = setTimeout(() => {
            observer.disconnect();
            resolve();
          }, 80);
        }
      });

      observer.observe(viewer);

      // Fallback: if no resize events happen at all
      setTimeout(() => {
        observer.disconnect();
        resolve();
      }, 200);
    });
  }

  //--------------------------
  // Marked Initialization
  //--------------------------
  private initializeMarked(): void {
  
    marked.use(
      // this.marked.use(
      {
        async: false,
        breaks: false,
        gfm: true,
        pedantic: false,
        renderer: this.renderer,
        silent: false,
        tokenizer: new Tokenizer(),
        walkTokens: null
      },
      {
        extensions: [{
          name: 'typescript',
          renderer(token) {
            console.log('Log: marked extension', token.raw);
            return `<pre class="typescript">NONE</pre>`;
          }
        }]
      }
    );

    // this.marked.use({
    //   extensions: [{
    //     name: 'typescript',
    //     renderer(token) {
    //       console.log('Log: marked extension', token.raw);
    //       return `<pre class="typescript">${token.raw}</pre>`;
    //     }
    //   }]
    // });

  }


}

