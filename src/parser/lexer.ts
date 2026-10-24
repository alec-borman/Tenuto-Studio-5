export enum TokenType {
  KEYWORD = 'KEYWORD',
  COLON = 'COLON',
  DOT = 'DOT',
  DOLLAR = 'DOLLAR',
  AT = 'AT',
  LBRACE = 'LBRACE',
  RBRACE = 'RBRACE',
  LPAREN = 'LPAREN',
  RPAREN = 'RPAREN',
  LBRACKET = 'LBRACKET', 
  RBRACKET = 'RBRACKET', 
  SLASH = 'SLASH',
  COMMA = 'COMMA',
  STRING_LIT = 'STRING_LIT',
  INTEGER = 'INTEGER',
  BRACKET = 'BRACKET', 
  PIPE = 'PIPE',
  IDENTIFIER = 'IDENTIFIER',
  ASSIGN = 'ASSIGN',
  PLUS = 'PLUS',
  MINUS = 'MINUS',
  TILDE = 'TILDE',
  EOF = 'EOF'
}

export interface Token {
  type: TokenType;
  value: string;
}

const KEYWORDS = new Set([
  'tenuto',
  'def',
  'def_return',
  'return',
  'group',
  'scene',
  'clip',
  'locator',
  'groove',
  'rack',
  'measure',
  'macro',
  'meta',
  'var',
  'style',
  'patch',
  'map',
]);

export class Lexer {
  private input: string;
  private position: number = 0;

  constructor(input: string) {
    this.input = input;
  }

  private peek(offset: number = 0): string {
    if (this.position + offset >= this.input.length) return '\0';
    return this.input[this.position + offset];
  }

  private advance(): string {
    const char = this.peek();
    this.position++;
    return char;
  }

  private isWhitespace(char: string): boolean {
    return char === ' ' || char === '\t' || char === '\n' || char === '\r';
  }

  private isAlpha(char: string): boolean {
    return (char >= 'a' && char <= 'z') || (char >= 'A' && char <= 'Z') || char === '_';
  }

  private isDigit(char: string): boolean {
    return char >= '0' && char <= '9';
  }

  public nextToken(): Token {
    while (this.isWhitespace(this.peek())) {
      this.advance();
    }

    if (this.peek() === '\0') {
      return { type: TokenType.EOF, value: '' };
    }

    // Skip Comments
    if (this.peek() === '%' && this.peek(1) === '%') {
      while (this.peek() !== '\n' && this.peek() !== '\0') {
        this.advance();
      }
      return this.nextToken();
    }

    const startChar = this.peek();

    if (startChar === '<' && this.peek(1) === '[') {
      this.advance(); this.advance();
      return { type: TokenType.BRACKET, value: '<[' };
    }
    if (startChar === ']' && this.peek(1) === '>') {
      this.advance(); this.advance();
      return { type: TokenType.BRACKET, value: ']>' };
    }

    const char = this.advance();
    switch (char) {
      case ':': return { type: TokenType.COLON, value: ':' };
      case '.': return { type: TokenType.DOT, value: '.' };
      case '$': return { type: TokenType.DOLLAR, value: '$' };
      case '@': return { type: TokenType.AT, value: '@' };
      case '{': return { type: TokenType.LBRACE, value: '{' };
      case '}': return { type: TokenType.RBRACE, value: '}' };
      case '(': return { type: TokenType.LPAREN, value: '(' };
      case ')': return { type: TokenType.RPAREN, value: ')' };
      case '[': return { type: TokenType.LBRACKET, value: '[' };
      case ']': return { type: TokenType.RBRACKET, value: ']' };
      case '/': return { type: TokenType.SLASH, value: '/' };
      case ',': return { type: TokenType.COMMA, value: ',' };
      case '|': return { type: TokenType.PIPE, value: '|' };
      case '=': return { type: TokenType.ASSIGN, value: '=' };
      case '+': return { type: TokenType.PLUS, value: '+' };
      case '-': return { type: TokenType.MINUS, value: '-' };
      case '~': return { type: TokenType.TILDE, value: '~' };
      case '"': {
        let str = '"';
        while (this.peek() !== '"' && this.peek() !== '\0') {
          str += this.advance();
        }
        if (this.peek() === '"') str += this.advance();
        return { type: TokenType.STRING_LIT, value: str };
      }
    }

    if (this.isAlpha(char)) {
      let id = char;
      while (this.isAlpha(this.peek()) || this.isDigit(this.peek()) || this.peek() === '#' || this.peek() === '_') {
        id += this.advance();
      }
      
      if (this.peek() === ':') {
         if (this.isDigit(this.peek(1))) { // it's a duration! c4:4
            id += this.advance(); // consume :
            while (this.isDigit(this.peek()) || this.peek() === '/') {
               id += this.advance();
            }
         }
      }

      if (KEYWORDS.has(id.toLowerCase())) {
        return { type: TokenType.KEYWORD, value: id.toLowerCase() };
      }
      return { type: TokenType.IDENTIFIER, value: id };
    }

    if (this.isDigit(char)) {
      let num = char;
      while (this.isDigit(this.peek())) {
        num += this.advance();
      }
      if (this.peek() === '.') {
        num += this.advance();
        while (this.isDigit(this.peek())) num += this.advance();
      }
      return { type: TokenType.INTEGER, value: num };
    }

    throw new Error(`E1001: Unrecognized token at character '${char}'`);
  }

  public tokenize(): Token[] {
    const tokens: Token[] = [];
    let token = this.nextToken();
    while (token.type !== TokenType.EOF) {
      tokens.push(token);
      token = this.nextToken();
    }
    return tokens;
  }
}
