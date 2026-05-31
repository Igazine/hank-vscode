import {
    createConnection,
    TextDocuments,
    Diagnostic,
    DiagnosticSeverity,
    ProposedFeatures,
    InitializeParams,
    TextDocumentSyncKind,
    InitializeResult,
    CompletionItem,
    CompletionItemKind,
    TextDocumentPositionParams,
    Hover,
    MarkupKind,
    SignatureHelp,
    SignatureInformation,
    ParameterInformation,
    Range
} from 'vscode-languageserver/node.js';

import { TextDocument } from 'vscode-languageserver-textdocument';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// Import Hank Core (using relative path to submodule source)
import { Lexer } from '../vendor/hank-ts/src/Lexer.js';
import { Parser } from '../vendor/hank-ts/src/Parser.js';
import { Runner } from '../vendor/hank-ts/src/Runner.js';
import { StdLib } from '../vendor/hank-ts/src/stdlib/index.js';
import { Expr, HankErrorValue, Param, Resource, Value, ValueType } from '../vendor/hank-ts/src/Types.js';

// Import Metadata
import { HANK_STDLIB_METADATA } from './metadata.js';

interface LocalSymbol {
    name: string;
    kind: 'Task' | 'Variable';
    parameters?: string[];
    line: number;
    notes?: string[];
}

const documentSymbols: Map<string, Record<string, LocalSymbol>> = new Map();
const deadCodeRanges: Map<string, Range[]> = new Map();

// Resource implementation for LSP execution
class LSPResource extends Resource {
    constructor(public id: string, public override content: string | null = null) {
        super(id);
    }
    async load() {
        if (this.content !== null) return;
        const filePath = fileURLToPath(this.id);
        this.content = fs.readFileSync(filePath, 'utf-8');
    }
    resolve(rawPath: string) {
        const currentPath = this.id.startsWith('file://') ? fileURLToPath(this.id) : process.cwd();
        const parentDir = path.dirname(currentPath);
        let targetPath = path.resolve(parentDir, rawPath);
        if (!targetPath.endsWith('.hank')) targetPath += '.hank';
        
        // Convert path back to URI for the Resource ID
        const targetUri = targetPath.startsWith('/') ? `file://${targetPath}` : `file:///${targetPath.replace(/\\/g, '/')}`;
        return new LSPResource(targetUri);
    }
}

const connection = createConnection(ProposedFeatures.all);
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

connection.onInitialize((params: InitializeParams) => {
    const result: InitializeResult = {
        capabilities: {
            textDocumentSync: TextDocumentSyncKind.Incremental,
            completionProvider: {
                resolveProvider: false
            },
            hoverProvider: true,
            signatureHelpProvider: {
                triggerCharacters: ['(', ',']
            }
        }
    };
    return result;
});

// The content of a text document has changed. This event is emitted
// when the text document first opened or when its content has changed.
documents.onDidChangeContent(change => {
    validateTextDocument(change.document);
});

// Implement Autocomplete
connection.onCompletion((pos: TextDocumentPositionParams): CompletionItem[] => {
    const items: CompletionItem[] = Object.values(HANK_STDLIB_METADATA).map(t => ({
        label: t.name,
        kind: CompletionItemKind.Function,
        detail: t.signature,
        documentation: t.description
    }));

    const local = documentSymbols.get(pos.textDocument.uri);
    if (local) {
        for (const symbol of Object.values(local)) {
            items.push({
                label: symbol.name,
                kind: symbol.kind === 'Task' ? CompletionItemKind.Function : CompletionItemKind.Variable,
                detail: symbol.kind === 'Task' ? `${symbol.name}(${(symbol.parameters || []).join(', ')})` : symbol.name,
                documentation: `Local ${symbol.kind} defined on line ${symbol.line}`
            });
        }
    }

    return items;
});

// Implement Signature Help
connection.onSignatureHelp((params: TextDocumentPositionParams): SignatureHelp | null => {
    const doc = documents.get(params.textDocument.uri);
    if (!doc) return null;

    const text = doc.getText();
    const offset = doc.offsetAt(params.position);
    const textBefore = text.substring(0, offset);

    // Find the innermost unclosed function call
    let parenDepth = 0;
    let currentPos = textBefore.length - 1;
    let commaCount = 0;

    while (currentPos >= 0) {
        const char = textBefore[currentPos];
        if (char === ')') parenDepth++;
        if (char === '(') {
            if (parenDepth === 0) break;
            parenDepth--;
        }
        if (char === ',' && parenDepth === 0) commaCount++;
        currentPos--;
    }

    if (currentPos < 0) return null;

    // Extract the task name before the '('
    const nameMatch = textBefore.substring(0, currentPos).match(/([a-zA-Z_][a-zA-Z0-9_]*)$/);
    if (!nameMatch) return null;

    const symbol = nameMatch[1];
    let metadata: any = HANK_STDLIB_METADATA[symbol];

    if (!metadata) {
        const local = documentSymbols.get(params.textDocument.uri);
        if (local && local[symbol] && local[symbol].kind === 'Task') {
            const sym = local[symbol];
            metadata = {
                signature: `${sym.name}(${(sym.parameters || []).join(', ')})`,
                description: `Local task defined on line ${sym.line}`,
                parameters: (sym.parameters || []).map(p => ({ label: p, description: '' }))
            };
        }
    }

    if (metadata) {
        const signature: SignatureInformation = {
            label: metadata.signature,
            documentation: {
                kind: MarkupKind.Markdown,
                value: metadata.description
            },
            parameters: metadata.parameters.map((p: any) => ({
                label: p.label,
                documentation: p.description
            }))
        };

        return {
            signatures: [signature],
            activeSignature: 0,
            activeParameter: commaCount
        };
    }

    return null;
});

// Implement Hover Documentation
connection.onHover((params: TextDocumentPositionParams): Hover | null => {
    const doc = documents.get(params.textDocument.uri);
    if (!doc) return null;

    const text = doc.getText();
    const offset = doc.offsetAt(params.position);

    // Extract the symbol under cursor (either module.task or just identifier)
    const lineText = text.split('\n')[params.position.line];
    const charPos = params.position.character;
    
    // Find boundaries of the word/symbol
    let start = charPos;
    while (start > 0 && /[a-zA-Z0-9_]/.test(lineText[start - 1])) start--;
    let end = charPos;
    while (end < lineText.length && /[a-zA-Z0-9_]/.test(lineText[end])) end++;
    
    const symbol = lineText.substring(start, end);
    let metadata: any = HANK_STDLIB_METADATA[symbol];

    const local = documentSymbols.get(params.textDocument.uri);
    if (!metadata) {
        if (local && local[symbol]) {
            const sym = local[symbol];
            metadata = {
                signature: sym.kind === 'Task' ? `${sym.name}(${(sym.parameters || []).join(', ')})` : sym.name,
                description: `Local ${sym.kind.toLowerCase()} defined on line ${sym.line}`,
                notes: sym.notes || []
            };
        }
    }

    // Check for unreachable code
    const deadCode = deadCodeRanges.get(params.textDocument.uri);
    const isUnreachable = deadCode?.some(r => 
        params.position.line >= r.start.line && 
        params.position.line <= r.end.line &&
        params.position.character >= r.start.character
    );

    if (metadata || isUnreachable) {
        const contents = metadata ? [
            `### \`${metadata.signature}\``,
            `---`,
            metadata.description,
            metadata.example ? `\n**Example:**\n\`\`\`hank\n${metadata.example}\n\`\`\`` : ''
        ] : [];

        const notes = metadata?.notes || [];
        if (isUnreachable) {
            notes.push(`**Unreachable Code**: This statement follows an unconditional return (\`^\`) and will never be executed.`);
        }

        if (notes.length > 0) {
            if (contents.length > 0) contents.push(`\n---`);
            notes.forEach((note: string) => {
                contents.push(`\n*${note}*`);
            });
        }

        return {
            contents: {
                kind: MarkupKind.Markdown,
                value: contents.join('\n')
            }
        };
    }

    return null;
});

// Implement Embedded Execution
connection.onRequest('hank/execute', async (params: { uri: string, content: string }) => {
    const runner = new Runner();
    const stdlib = new StdLib();
    runner.registerExtension(stdlib);

    // Intercept logs and pipe them back to the client
    runner.registerTasks({
        log_print: (args) => {
            const msg = args.map(a => valToString(a)).join(' ');
            connection.sendNotification('hank/log', msg);
            return { type: ValueType.Void };
        },
        log_error: (args) => {
            const msg = args.map(a => valToString(a)).join(' ');
            connection.sendNotification('hank/error', msg);
            return { type: ValueType.Void };
        },
        log_warn: (args) => {
            const msg = args.map(a => valToString(a)).join(' ');
            connection.sendNotification('hank/log', `[WARN] ${msg}`);
            return { type: ValueType.Void };
        }
    });

    try {
        const resource = new LSPResource(params.uri, params.content);
        const result = await runner.run(resource, []);
        return valToString(result);
    } catch (e: any) {
        connection.sendNotification('hank/error', e.message || String(e));
        return 'Execution Failed';
    }
});

function valToString(v: Value): string {
    if (!v) return 'Void';
    switch (v.type) {
        case ValueType.String: return v.value;
        case ValueType.Number: {
            let s = v.value.toString();
            if (s.endsWith('.0')) s = s.substring(0, s.length - 2);
            return s;
        }
        case ValueType.Void: return 'Void';
        case ValueType.Array: return '[Array]';
        case ValueType.Map: return '[Map]';
        case ValueType.Opaque: return `[Opaque:${v.label}]`;
        case ValueType.Task: return '[Task]';
        case ValueType.Error: return `[Error:${v.code}]`;
        default: return 'Void';
    }
}
async function validateTextDocument(textDocument: TextDocument): Promise<void> {
    const text = textDocument.getText();
    const diagnostics: Diagnostic[] = [];
    const localSymbols: Record<string, LocalSymbol> = {};

    try {
        const lexer = new Lexer(text);
        const tokens = lexer.tokenize();
        
        // Proper macro resolver for LSP
        const macroResolver = (rawPath: string): Expr => {
            let parentDir: string;
            if (textDocument.uri.startsWith('file://')) {
                parentDir = path.dirname(fileURLToPath(textDocument.uri));
            } else {
                // For untitled files, we don't have a reliable parent directory.
                // We'll try to find a workspace root if available, otherwise use CWD.
                parentDir = process.cwd();
            }
            
            let targetPath = path.resolve(parentDir, rawPath);
            if (!targetPath.endsWith('.hank')) targetPath += '.hank';

            if (!fs.existsSync(targetPath)) {
                // Throw a custom error that our validator can catch and map to a line
                const err = new Error(`Macro file not found: ${targetPath}`);
                (err as any).isMacroError = true;
                throw err;
            }

            const content = fs.readFileSync(targetPath, 'utf-8');
            const subLexer = new Lexer(content);
            const subTokens = subLexer.tokenize();
            
            // Note: pass targetPath as a file:// URI if possible to keep sub-resolutions consistent
            const targetUri = targetPath.startsWith('/') ? `file://${targetPath}` : `file:///${targetPath.replace(/\\/g, '/')}`;
            const subParser = new Parser(subTokens, targetUri, macroResolver);
            return subParser.parse();
        };

        const parser = new Parser(tokens, textDocument.uri, macroResolver);
        const ast = parser.parse();

        // Walk AST to extract symbols with scope tracking
        const scopeStack: Set<string>[] = [new Set()];
        const docDeadCode: Range[] = [];

        const isDefined = (name: string) => {
            for (let i = scopeStack.length - 1; i >= 0; i--) {
                if (scopeStack[i].has(name)) return true;
            }
            return false;
        };

        const walk = (node: Expr): boolean => {
            if (!node) return false;
            switch (node.kind) {
                case 'Block':
                    scopeStack.push(new Set());
                    let blockReturns = false;
                    for (let i = 0; i < node.stmts.length; i++) {
                        const stmt = node.stmts[i];
                        if (blockReturns) {
                            // This statement is unreachable
                            docDeadCode.push({
                                start: { line: stmt.td.line - 1, character: stmt.td.column - 1 },
                                end: { line: stmt.td.line - 1, character: 999 } // End of line approx
                            });
                        }
                        if (walk(stmt)) blockReturns = true;
                    }
                    scopeStack.pop();
                    return blockReturns;

                case 'Assign':
                    const notes: string[] = [];
                    // Analyze RHS first (Evaluate)
                    if (node.value.kind === 'Ident') {
                        const rhsName = (node.value as any).name;
                        if (rhsName === node.name) {
                            if (!isDefined(rhsName) && !HANK_STDLIB_METADATA[rhsName]) {
                                notes.push(`**Evaluate-Then-Bind**: The right-side '${rhsName}' was not found in any scope and evaluated to **Void**. This value is now bound to the local identifier '${rhsName}'.`);
                            } else if (isDefined(rhsName)) {
                                notes.push(`**Shadowing**: This captures the value of '${rhsName}' from a parent scope. Changes to this local variable will not affect the original.`);
                            }
                        }
                    }

                    const isTask = node.value.kind === 'FuncDef';
                    localSymbols[node.name] = {
                        name: node.name,
                        kind: isTask ? 'Task' : 'Variable',
                        parameters: isTask ? (node.value as any).params.map((p: Param) => p.name) : undefined,
                        line: node.td.line,
                        notes: notes.length > 0 ? notes : undefined
                    };

                    const rhsReturns = walk(node.value);

                    // Bind LHS to current scope
                    scopeStack[scopeStack.length - 1].add(node.name);
                    return rhsReturns;

                case 'FuncDef':
                    scopeStack.push(new Set(node.params.map(p => p.name)));
                    walk(node.body); // Return status within task doesn't terminate parent block
                    scopeStack.pop();
                    return false;

                case 'UnOp':
                    walk(node.target);
                    return node.op === '^';

                case 'FlowControl':
                    walk(node.condition);
                    walk(node.success);
                    if (node.fallback) walk(node.fallback);
                    if (node.rescue) walk(node.rescue);
                    return false; // Gates are conditional

                case 'FuncCall':
                    walk(node.target);
                    node.args.forEach(walk);
                    return false;

                case 'Array':
                    node.items.forEach(walk);
                    return false;

                case 'Map':
                    node.fields.forEach(walk);
                    return false;

                case 'Ident':
                case 'Literal':
                case 'Error':
                    return false;
            }
            return false;
        };

        walk(ast);
        documentSymbols.set(textDocument.uri, localSymbols);
        deadCodeRanges.set(textDocument.uri, docDeadCode);

    } catch (e: any) {
        // If it's a HankErrorValue (from the Parser/Lexer)
        if (e && typeof e === 'object' && 'line' in e) {
            const hankError = e as HankErrorValue;
            
            // Note: Hank lines/cols are 1-based, VSCode lines/cols are 0-based
            const line = Math.max(0, (hankError.line || 1) - 1);
            const character = Math.max(0, (hankError.column || 1) - 1);
            
            const diagnostic: Diagnostic = {
                severity: DiagnosticSeverity.Error,
                range: {
                    start: { line, character },
                    end: { line, character: character + 1 } 
                },
                message: hankError.message,
                source: 'hank'
            };
            diagnostics.push(diagnostic);
        } else {
            // Generic error
            const diagnostic: Diagnostic = {
                severity: DiagnosticSeverity.Error,
                range: {
                    start: { line: 0, character: 0 },
                    end: { line: 0, character: 0 }
                },
                message: e.message || 'Unknown error during parsing',
                source: 'hank'
            };
            diagnostics.push(diagnostic);
        }
    }

    // Send the computed diagnostics to VSCode.
    connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
}

// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);

// Listen on the connection
connection.listen();
