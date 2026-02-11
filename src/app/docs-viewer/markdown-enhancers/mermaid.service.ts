import { Injectable, signal } from '@angular/core';

import mermaid, { MermaidConfig } from 'mermaid';

import { isBrowser } from '../../global.utils/global.utils';

// import { mermaidConfigDarkTheme, mermaidConfigLightTheme } from '../meta/docsmeta';


//
const mermaidConfigDarkTheme: MermaidConfig = {
  // startOnLoad: true,
  // legacyMathML: true,
  theme: 'dark',
  themeVariables: {
    fontSize: '18px',
    fontFamily: 'Trebuchet MS, Verdana, Arial, Sans-Serif',
    primaryColor: '#2d3748',
    primaryTextColor: '#e2e8f0',
    primaryBorderColor: '#63b3ed',
    secondaryColor: '#4a5568',
    tertiaryColor: '#2c5282',
    lineColor: '#63b3ed',
    nodeTextSize: '20px',
    edgeLabelFontSize: '14px',
    labelTextSize: '16px',
    background: '#1e1e1e',
    clusterBkg: '#2d3748',
    clusterBorder: '#63b3ed'
  },
  flowchart: { htmlLabels: true, curve: 'linear' }
};

const mermaidConfigLightTheme: MermaidConfig = {
  // startOnLoad: true,
  // legacyMathML: true,
  theme: 'default',
  themeVariables: {
    fontSize: '16px',
    fontFamily: 'Trebuchet MS, Verdana, Arial, Sans-Serif',
    primaryColor: '#f0f9ff',
    primaryTextColor: '#1a202c',
    primaryBorderColor: '#3182ce',
    secondaryColor: '#bee3f8',
    tertiaryColor: '#90cdf4',
    lineColor: '#3182ce',
    nodeTextSize: '18px',
    edgeLabelFontSize: '14px',
    labelTextSize: '16px',
    background: '#ffffff',
    clusterBkg: '#edf2f7',
    clusterBorder: '#3182ce'
  },
  flowchart: { htmlLabels: true, curve: 'basis' }
};


@Injectable({ providedIn: 'root' })
export class MermaidService {

  $title = signal<string>('MarkdownRenderService');

  //------------------------------------------------------------------
  // Mermaid Initialization
  //------------------------------------------------------------------
  /**
     * Core Mermaid initialization.
     * Runs once at startup.
     * Sets global behavior that should not change.
     */
  initializeMermaidCore(): void {
    if (!isBrowser()) return;

    mermaid.initialize({
      startOnLoad: false,     // We control rendering manually
      securityLevel: 'strict',
      legacyMathML: true,
    });

    // console.log(`Log: ${this.title()} \ninitializeMermaidCore() Finiched`);
  }

  /**
   * Theme initialization.
   * Runs every time Markdown is rendered.
   * Mermaid requires re-initialization for theme changes.
   */
  applyMermaidTheme(isDarkMode: boolean): void {
    mermaid.initialize(
      isDarkMode ? mermaidConfigDarkTheme : mermaidConfigLightTheme
    );
  }


  /**
     * Render Mermaid diagrams.
     * Avoids re-rendering already-rendered blocks.
     */
  async renderMermaidBlocks(container: HTMLElement): Promise<void> {

    // Select only Mermaid source blocks (not already rendered)
    const mermaidBlocks = Array.from(
      container.querySelectorAll<HTMLElement>('.mermaid')
      // container.querySelectorAll<HTMLElement>('.mermaid')
    ).filter(el => !el.classList.contains('mermaid-rendered')) as ArrayLike<HTMLElement>;

    if (mermaidBlocks.length === 0) return;

    // console.log(`Log: ${this.title()} renderMermaidBlocks() \nmermaidBlocks=`, mermaidBlocks);

    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        await mermaid.run({ nodes: mermaidBlocks });
        break;
      } catch (err) {
        if (attempt === 2) throw err;
        await new Promise(r => setTimeout(r, 30));
      }
    }

  }



}
