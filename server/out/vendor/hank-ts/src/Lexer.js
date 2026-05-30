import { HankError } from './Types.js';
import { HankErrorRegistry } from './ErrorRegistry.js';
export var TokenType;
(function (TokenType) {
    TokenType[TokenType["Identifier"] = 0] = "Identifier";
    TokenType[TokenType["Number"] = 1] = "Number";
    TokenType[TokenType["String"] = 2] = "String";
    TokenType[TokenType["Assign"] = 3] = "Assign";
    TokenType[TokenType["Question"] = 4] = "Question";
    TokenType[TokenType["Colon"] = 5] = "Colon";
    TokenType[TokenType["Rescue"] = 6] = "Rescue";
    TokenType[TokenType["At"] = 7] = "At";
    TokenType[TokenType["Hash"] = 8] = "Hash";
    TokenType[TokenType["Not"] = 9] = "Not";
    TokenType[TokenType["Caret"] = 10] = "Caret";
    TokenType[TokenType["Dot"] = 11] = "Dot";
    TokenType[TokenType["Comma"] = 12] = "Comma";
    TokenType[TokenType["LParen"] = 13] = "LParen";
    TokenType[TokenType["RParen"] = 14] = "RParen";
    TokenType[TokenType["LBrace"] = 15] = "LBrace";
    TokenType[TokenType["RBrace"] = 16] = "RBrace";
    TokenType[TokenType["LBracket"] = 17] = "LBracket";
    TokenType[TokenType["RBracket"] = 18] = "RBracket";
    TokenType[TokenType["Newline"] = 19] = "Newline";
    TokenType[TokenType["EOF"] = 20] = "EOF";
    TokenType[TokenType["Error"] = 21] = "Error";
})(TokenType || (TokenType = {}));
export class Lexer {
    input;
    pos = 0;
    line = 1;
    lineStart = 0;
    tokens = [];
    constructor(input) {
        this.input = input;
    }
    tokenize() {
        while (this.pos < this.input.length) {
            const char = this.input[this.pos];
            if (/\s/.test(char)) {
                if (char === '\n') {
                    this.addToken(TokenType.Newline, '\n');
                    this.line++;
                    this.pos++;
                    this.lineStart = this.pos;
                }
                else {
                    this.pos++;
                }
                continue;
            }
            if (char === '/' && this.input[this.pos + 1] === '/') {
                this.skipComment();
                continue;
            }
            if (char === '-' && /[0-9]/.test(this.input[this.pos + 1] || '')) {
                this.readNumber();
                continue;
            }
            if (/[0-9]/.test(char)) {
                this.readNumber();
                continue;
            }
            if (/[a-zA-Z_]/.test(char)) {
                this.readIdentifier();
                continue;
            }
            if (char === '"' || char === "'") {
                this.readString(char);
                continue;
            }
            switch (char) {
                case '=':
                    this.addToken(TokenType.Assign, '=');
                    break;
                case '?':
                    this.addToken(TokenType.Question, '?');
                    break;
                case ':':
                    this.addToken(TokenType.Colon, ':');
                    break;
                case '~':
                    this.addToken(TokenType.Rescue, '~');
                    break;
                case '@':
                    this.addToken(TokenType.At, '@');
                    break;
                case '#':
                    this.addToken(TokenType.Hash, '#');
                    break;
                case '!':
                    this.addToken(TokenType.Not, '!');
                    break;
                case '^':
                    this.addToken(TokenType.Caret, '^');
                    break;
                case '.':
                    this.addToken(TokenType.Dot, '.');
                    break;
                case ',':
                    this.addToken(TokenType.Comma, ',');
                    break;
                case '(':
                    this.addToken(TokenType.LParen, '(');
                    break;
                case ')':
                    this.addToken(TokenType.RParen, ')');
                    break;
                case '{':
                    this.addToken(TokenType.LBrace, '{');
                    break;
                case '}':
                    this.addToken(TokenType.RBrace, '}');
                    break;
                case '[':
                    this.addToken(TokenType.LBracket, '[');
                    break;
                case ']':
                    this.addToken(TokenType.RBracket, ']');
                    break;
                default:
                    this.addToken(TokenType.Error, HankErrorRegistry.create(HankError.UnexpectedCharacter, [char]).message);
            }
            this.pos++;
        }
        this.addToken(TokenType.EOF, '');
        return this.tokens;
    }
    addToken(type, literal, posOffset = 0) {
        const column = (this.pos - posOffset) - this.lineStart + 1;
        this.tokens.push({
            type,
            literal,
            line: this.line,
            column,
            lineText: this.getCurrentLineText()
        });
    }
    skipComment() {
        while (this.pos < this.input.length && this.input[this.pos] !== '\n') {
            this.pos++;
        }
    }
    readNumber() {
        const start = this.pos;
        if (this.input[this.pos] === '-')
            this.pos++;
        let hasDot = false;
        while (this.pos < this.input.length) {
            const char = this.input[this.pos];
            if (char === '.') {
                if (hasDot)
                    break; // Stop at second dot; parser will catch dot-after-number
                hasDot = true;
            }
            else if (!/[0-9]/.test(char)) {
                break;
            }
            this.pos++;
        }
        // Validate: EBNF requires digits after a dot if present
        const literal = this.input.substring(start, this.pos);
        if (literal.endsWith('.')) {
            this.pos--; // Roll back the dot
        }
        // Check for illegal suffix (e.g., 100a)
        if (this.pos < this.input.length && /[a-zA-Z_]/.test(this.input[this.pos])) {
            const char = this.input[this.pos];
            this.addToken(TokenType.Error, HankErrorRegistry.create(HankError.UnexpectedCharacter, [char]).message, this.pos - start);
            return;
        }
        this.addToken(TokenType.Number, this.input.substring(start, this.pos), this.pos - start);
    }
    readIdentifier() {
        const start = this.pos;
        this.pos++;
        while (this.pos < this.input.length && /[a-zA-Z0-9_]/.test(this.input[this.pos])) {
            this.pos++;
        }
        this.addToken(TokenType.Identifier, this.input.substring(start, this.pos), this.pos - start);
    }
    readString(quote) {
        const start = this.pos;
        this.pos++; // skip quote
        let val = '';
        while (this.pos < this.input.length && this.input[this.pos] !== quote) {
            if (this.input[this.pos] === '\\') {
                this.pos++;
                switch (this.input[this.pos]) {
                    case 'n':
                        val += '\n';
                        break;
                    case 't':
                        val += '\t';
                        break;
                    default:
                        val += this.input[this.pos];
                        break;
                }
            }
            else {
                val += this.input[this.pos];
            }
            this.pos++;
        }
        if (this.pos >= this.input.length) {
            this.addToken(TokenType.Error, HankErrorRegistry.create(HankError.UnclosedStringLiteral).message, this.pos - start);
            return;
        }
        this.pos++; // skip quote
        this.addToken(TokenType.String, val, this.pos - start);
    }
    getCurrentLineText() {
        let end = this.pos;
        while (end < this.input.length && this.input[end] !== '\n') {
            end++;
        }
        return this.input.substring(this.lineStart, end);
    }
}
//# sourceMappingURL=Lexer.js.map