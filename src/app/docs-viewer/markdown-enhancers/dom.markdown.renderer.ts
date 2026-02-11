import { marked, TokensList, Tokens, Token, Renderer } from 'marked';

// we’ll just use marked.lexer(src) to get tokens
export type BlockToken = (
  | Tokens.Paragraph
  | Tokens.Heading
  | Tokens.List
  | Tokens.Blockquote
  | Tokens.Hr
  | Tokens.Space);

export type InlineToken = (
  | Tokens.Text
  | Tokens.Em
  | Tokens.Strong
  | Tokens.Codespan
  | Tokens.Br
  | Tokens.Del
  | Tokens.Link
  | Tokens.Image);



export class DomMarkdownRenderer {
  render(markdown: string): DocumentFragment {
    const tokens = marked.lexer(markdown);
    return this.renderBlocks(tokens);
  }

  private renderBlocks(tokens: Token[]): DocumentFragment {
  // private renderBlocks(tokens: TokensList): DocumentFragment {

    const frag = document.createDocumentFragment();
    for (const token of tokens) {
      const node = this.renderBlock(token as BlockToken);
      if (node) frag.appendChild(node);
    }
    return frag;
  }

  private renderBlock(token: BlockToken): Node | null {
    switch (token.type) {
      case 'paragraph': {
        const p = document.createElement('p');
        p.append(this.renderInlines(token.tokens));
        return p;
      }
      case 'heading': {
        const h = document.createElement('h' + token.depth);
        h.append(this.renderInlines(token.tokens));
        return h;
      }
      case 'list': {
        const list = document.createElement(token.ordered ? 'ol' : 'ul');
        for (const item of token.items) {
          const li = document.createElement('li');
          li.append(this.renderBlocks(item.tokens));
          list.appendChild(li);
        }
        return list;
      }
      case 'blockquote': {
        const bq = document.createElement('blockquote');
        bq.append(this.renderBlocks(token.tokens));
        return bq;
      }
      case 'hr': {
        return document.createElement('hr');
      }
      case 'space': {
        return document.createTextNode(' ');
      }
      default:
        return null;
    }
  }

  private renderInlines(tokens: Token[] | undefined): DocumentFragment {
  // private renderInlines(tokens: InlineToken[] | undefined): DocumentFragment {
    const frag = document.createDocumentFragment();
    if (!tokens) return frag;

    for (const token of tokens) {
      const node = this.renderInline(token);
      if (node) frag.appendChild(node);
    }
    return frag;
  }

  private renderInline(token: Token): Node | null {
  // private renderInline(token: InlineToken): Node | null {
    switch (token.type) {
      case 'text':
        return document.createTextNode(token.text);

      case 'em': {
        const em = document.createElement('em');
        em.append(this.renderInlines(token.tokens));
        return em;
      }

      case 'strong': {
        const strong = document.createElement('strong');
        strong.append(this.renderInlines(token.tokens));
        return strong;
      }

      case 'codespan': {
        const code = document.createElement('code');
        code.textContent = token.text;
        return code;
      }

      case 'br':
        return document.createElement('br');

      case 'del': {
        const del = document.createElement('del');
        del.append(this.renderInlines(token.tokens));
        return del;
      }

      case 'link': {
        const a = document.createElement('a');
        a.href = token.href || '';
        if (token.title) a.title = token.title;
        a.append(this.renderInlines(token.tokens));
        return a;
      }

      case 'image': {
        const img = document.createElement('img');
        img.src = token.href || '';
        img.alt = token.text || '';
        if (token.title) img.title = token.title;
        return img;
      }

      default:
        return null;
    }
  }
}
