import { Component, ElementRef, input, effect, OnInit, AfterViewInit, signal, ViewChild, OnDestroy, computed, PLATFORM_ID, Inject } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { take, firstValueFrom } from 'rxjs';

import { RenderService } from './markdown-enhancers/render.service';
import { DocsRegistry } from './registry/docs-registry'
import { ScrollService } from './markdown-enhancers/scroll.service';
import { navigate } from '../global.utils/global.utils';

import { readSessionState, writeSessionState } from './session-state.manage';


@Component({
  selector: 'app-docs-viewer',
  imports: [
    CommonModule,
    MatIconModule
  ],
  templateUrl: './docs-viewer.html',
  styleUrls: ['./docs-viewer.scss']
})
export class DocsViewer implements OnInit, AfterViewInit, OnDestroy {

  protected readonly $title = signal("DocsViewer");

  private $isBrowser = signal<boolean>(false);

  protected $isDarkMode = signal<boolean>(true);

  protected $inputDocId = input.required<string>(); // from DocsViewerDirective
  protected $docId = signal<string | null>(null);
  private $reload = signal(0);

  $activeDocId = computed<{ docId: string, reloadCounter: number }>(() => ({
    docId: this.$docId() ?? this.$inputDocId(),
    reloadCounter: this.$reload()
  }));

  protected docTitle!: string | undefined;

  // private isFirstLoad: boolean = true;
  // keep a reference to the handler
  private clickHandler = this.onClick.bind(this);
  private scrollHandler = this.onScroll.bind(this);

  @ViewChild('markdownViewer', { static: true }) markdownViewer!: ElementRef<HTMLElement>;

  private internalLinks: NodeListOf<Element> | null = null;

  constructor(
    private router: Router,
    private renderService: RenderService,
    private docsRegistry: DocsRegistry,
    protected scrollService: ScrollService,
    @Inject(PLATFORM_ID) private platformId: Object,
  ) {

    const isBrowser = isPlatformBrowser(this.platformId);
    this.$isBrowser.set(isBrowser);

    if (isBrowser) {
      // thema setting
      const savedTheme = localStorage.getItem("theme") || "light";
      this.$isDarkMode.set(savedTheme === "dark"); // Sync button state
      document.documentElement.setAttribute("data-theme", savedTheme);

    }

    effect(() => {
      const { docId } = this.$activeDocId();
      this.effectWrapper(docId)
    });

  }

  ngOnInit(): void { }


  ngAfterViewInit(): void {
    if (this.$isBrowser()) {

    }

  }


  ngOnDestroy(): void {
    if (this.$isBrowser()) {
      this.clearPreviousDoc();

      console.log(`Log: ${this.$title()} ngOnDestroy completed isBrowser=true`);

    }

    console.log(`Log: ${this.$title()} ngOnDestroy completed`);

  }


  /**
     * Reactive effect:
     * - Watches activeDocId()
     * - Loads markdown into the viewer
     * - On first load only, triggers a safe "second read" of the initial doc
  */
  private effectWrapper(docId: string): void {

    if (!this.$isBrowser()) return;

    if (docId === null) return;

    const currentDocId = (readSessionState(this.$isBrowser())).docId;

    // in case of 'docId === currentDocId', no necessity due to reload the same doc
    if (docId !== currentDocId) {
      // set current docId to previous odcId, set new docId to current docId;
      writeSessionState({ docId: docId, prevDocId: currentDocId }, this.$isBrowser());
    }


    // Guard: only run if markdownViewer is initialized
    const viewer = this.markdownViewer?.nativeElement;
    if (!viewer) return;

    // this.scrollService.setLastDocId(docId);
    this.docTitle = this.docsRegistry.get(docId)?.title;

    // Fire-and-forget async pipeline, but internally fully awaited.
    void this.loadAndMaybeRedirect(docId);

    // console.log(`Log: ${this.$title()} \neffectWrapper() finihed  docId=`, docId);

  }

  /**
   * Load markdown, render it, then (on first load only)
   * trigger a second read of the initial doc.
  */
  private async loadAndMaybeRedirect(docId: string): Promise<void> {

    const viewer = this.markdownViewer.nativeElement;
    if (!viewer) {
      console.error(`Error ${this.$title()} : class="markdownViewer" not found`); return;
    }

    await this.loadAndRenderMarkdown(docId);

  }

  /**
     * Load markdown from registry, render into the viewer, wire events, restore scroll.
     * Entire pipeline is awaited.
  */
  private async loadAndRenderMarkdown(docId: string): Promise<void> {

    const viewer = this.markdownViewer.nativeElement;

    if (!viewer) {
      console.error(`Error ${this.$title()} : class="markdownViewer" not found`); return;
    }

    // console.log(`Log: ${this.$title()} loadAndRenderMarkdown viewer=`, viewer);

    const docMeta = this.docsRegistry.get(docId);
    const docPath = docMeta?.path;
    if (!docPath) {
      console.warn(`Warn ${this.$title()} : not found`, docId);
      viewer.innerHTML = `<p><em>Documentation not found. url=${docPath}</em></p>`;
      // navigate(this.router, ['/fallback']);
      return;
    };

    const fileType = docMeta.filetype;

    // clear info related the previously referenced markdown file
    this.clearPreviousDoc();

    try {

      let markdown = await firstValueFrom<string>(
        this.renderService.loadMarkdown(docPath).pipe(take(1))
      );

      // console.log(`Log: ${this.$title()} loadAndRenderMarkdown try loadMarkdown`, markdown);

      viewer.classList.add('hidden-during-render');

      // in order to display the TypeScript format
      if (fileType === "ts") {
        markdown = "```typescript" + "\n" + markdown + "\n" + "```";
      }

      await this.renderService.renderMarkdownToDOM(
        markdown,
        fileType,
        viewer,
        this.$isDarkMode()
      );

      // console.log(`Log: ${this.$title()} loadAndRenderMarkdown try renderMarkdownToDOM`, viewer);

      viewer.classList.remove('hidden-during-render');

      // After render: wire internal links and click & scroll handling
      this.internalLinks = viewer.querySelectorAll('a[href^="#docId:"], a[href^="#inlineId:"]');

      // console.log(`Log: ${this.$title()} loadAndRenderMarkdown try internalLinks`, this.internalLinks);


      this.internalLinks.forEach((el: Element) => {
        el.addEventListener('click', this.clickHandler);
      });

      viewer.addEventListener('scroll', this.scrollHandler);

      // Restore scroll after rendering
      const savedPos = this.scrollService.getPosition(docId);
      viewer.scrollTop = savedPos;



    } catch (er) {
      viewer.classList.remove('hidden-during-render');
      viewer.innerHTML = `<p><em>${this.$title()} Error in Try-Catch  renderService.loadAndRender. <br> error=${er}, <br> url=${docPath}, <br> docId=${docId}, <br> viewer=${JSON.stringify(viewer)}</em></p>`;
      console.error(`Error: ${this.$title()} MarkdownRenderService.loadAndRender`, docId, viewer, JSON.stringify(er));
    }

    // console.log(`Log: ${this.title()} \nloadMarkdown() Finished`);

  }

  // ensures to write scrollPos at most once per animation frame (~60fps max).
  private rafPending = false;
  private onScroll(event: Event): void {
    if (!this.$isBrowser()) return;

    // Capture the element synchronously — this is CRITICAL
    const el = event.currentTarget as HTMLElement;
    const docId = this.$activeDocId().docId ?? '';

    if (!this.rafPending) {
      this.rafPending = true;

      requestAnimationFrame(() => {
        const pos = el.scrollTop;
        const height = el.scrollHeight - el.clientHeight;
        this.scrollService.setPosition(docId, pos, height);
        writeSessionState({ scrollPos: pos }, this.$isBrowser());

        this.rafPending = false;
      });
    }
  }

  private onClick(e: Event): void {

    e.preventDefault();
    // console.log(`Log ${this.title()} On Click()`);

    // Use currentTarget to reliably reference the element you attached the listener to. and Use HTMLAnchorElement to get type-safe access to anchor-specific properties.
    const anchor = e.currentTarget as HTMLAnchorElement;
    const href = (anchor.getAttribute('href'))?.split(':').flat() ?? null;

    if (!href) {
      console.warn(`Warn ${this.$title()} : On Click  Failed  Reference Not Found`);
      navigate(this.router, ['/fallback']);
      return;
    }

    // console.log(`Log ${this.title()} On Click -> href=`, JSON.stringify(href));

    const hrefId = href[1];
    switch (href[0]) {
      case '#docId': {
        this.$docId.set(hrefId); // ✅ update signal for reactive markdown reading
        // console.log(`Log ${this.title()} On Click -> activeDocId=${this.activeDocId().docId}`);

        break;
      }
      case '#inlineId': {
        // console.log(`Log ${this.title()} On Click -> inlineId=`, hrefId);

        const inlineRef = document.getElementById(hrefId);

        if (!inlineRef) return console.error(`Error ${this.$title()} Element not found`, href, inlineRef);

        if (!inlineRef.hasAttribute("contenteditable")) {
          inlineRef.setAttribute("contenteditable", "true");
        }

        // scroll to inlineRef
        this.scrollService.scrollToElementInViewer(
          this.markdownViewer.nativeElement, inlineRef,
          "smooth",
          "center"
        );

        // Add a temporary highlight
        inlineRef.classList.add("highlight");
        setTimeout(() => inlineRef.classList.remove("highlight"), 1000);
        break;
      }
    }
  }

  private clearPreviousDoc(): void {
    const viewer = this.markdownViewer?.nativeElement;
    if (viewer) {
      viewer.innerHTML = '';
      viewer.removeEventListener('scroll', this.scrollHandler);
    }

    if (this.internalLinks) {
      this.internalLinks.forEach((el: Element) => {
        el.removeEventListener('click', this.clickHandler);
      });

      this.internalLinks = null;
    }

  }

  protected toggleTheme(event: Event): void {
    event.preventDefault();
    // console.log(`Log ${this.title()} toogleTheme event`, event);
    this.$isDarkMode.set(!this.$isDarkMode());

    const newTheme = this.$isDarkMode() ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", newTheme);
    localStorage.setItem("theme", newTheme); // Save preference

    // force effect to reload markdown, in order to enable thema chage
    this.$reload.update(n => n + 1);
  }

  protected backToIndex(event?: MouseEvent): void {
    if (event) {
      event.preventDefault();
    }
    this.scrollService.setPosition('initialdoc', 0, 0);

    this.$docId.set('initialdoc');
    // force effect to reload markdown in case the activeDocId is the same as previously
    this.$reload.update(n => n + 1);

  }

  protected backToPrevious(event?: MouseEvent): void {
    if (event) {
      event.preventDefault();
    }
    this.scrollService.setPosition('initialdoc', 0, 0);
    const prevDocId = (readSessionState(this.$isBrowser())).prevDocId;
    if (!prevDocId) return;

    this.$docId.set(prevDocId);
    // force effect to reload markdown in case the activeDocId is the same as previously
    this.$reload.update(n => n + 1);

  }
}

