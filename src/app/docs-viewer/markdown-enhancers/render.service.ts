import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Tokenizer, Marked } from 'marked';
import { Observable } from 'rxjs';

import { renderer, } from './marked.renderer';

import { KatexService } from './katex.service';
import { MermaidService } from './mermaid.service';

import { sanitizeNodeText } from '../../global.utils/global.utils';

@Injectable({ providedIn: 'root' })
export class RenderService {

  $title = signal<string>('MarkService');


  //Reference: https://marked.js.org/using_advanced

  private marked: Marked | null = null;

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
    const html = this.marked?.parse(markdown) as string;
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

    if (!this.marked) {
      this.marked = new Marked()
    }

    this.marked.use(
      {
        async: false,
        breaks: false,
        gfm: true,
        pedantic: false,
        renderer: renderer,
        silent: false,
        tokenizer: new Tokenizer(),
        walkTokens: null
      }
    );

  }


}

