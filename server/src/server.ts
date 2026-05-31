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

interface SymbolDefinition {
    name: string;
    kind: 'Task' | 'Variable';
    parameters?: string[];
    uri: string;
    range: Range; // Definition location
    scopeRange: Range; // Visibility range
    notes?: string[];
}

const documentDefinitions: Map<string, SymbolDefinition[]> = new Map();
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
            },
            definitionProvider: true
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

    const defs = documentDefinitions.get(pos.textDocument.uri);
    if (defs) {
        // Find definitions visible at current position
        const visible = defs.filter(d => 
            pos.position.line >= d.scopeRange.start.line && 
            pos.position.line <= d.scopeRange.end.line
        );
        for (const symbol of visible) {
            items.push({
                label: symbol.name,
                kind: symbol.kind === 'Task' ? CompletionItemKind.Function : CompletionItemKind.Variable,
                detail: symbol.kind === 'Task' ? `${symbol.name}(${(symbol.parameters || []).join(', ')})` : symbol.name,
                documentation: `Local ${symbol.kind.toLowerCase()} defined in ${symbol.uri === pos.textDocument.uri ? `line ${symbol.range.start.line + 1}` : 'macro-included file'}`
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
        const defs = documentDefinitions.get(params.textDocument.uri);
        if (defs) {
            const visible = defs.filter(d => d.name === symbol && d.kind === 'Task' &&
                params.position.line >= d.scopeRange.start.line && 
                params.position.line <= d.scopeRange.end.line
            );
            visible.sort((a, b) => (a.scopeRange.end.line - a.scopeRange.start.line) - (b.scopeRange.end.line - b.scopeRange.start.line));
            const sym = visible[0];
            if (sym) {
                metadata = {
                    signature: `${sym.name}(${(sym.parameters || []).join(', ')})`,
                    description: `Local task defined in ${sym.uri === params.textDocument.uri ? `line ${sym.range.start.line + 1}` : 'macro-included file'}`,
                    parameters: (sym.parameters || []).map(p => ({ label: p, description: '' }))
                };
            }
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

    const defs = documentDefinitions.get(params.textDocument.uri);
    if (!metadata) {
        if (defs) {
            const visible = defs.filter(d => d.name === symbol && 
                params.position.line >= d.scopeRange.start.line && 
                params.position.line <= d.scopeRange.end.line
            );
            visible.sort((a, b) => (a.scopeRange.end.line - a.scopeRange.start.line) - (b.scopeRange.end.line - b.scopeRange.start.line));
            const sym = visible[0];
            if (sym) {
                const origin = sym.uri === params.textDocument.uri ? `line ${sym.range.start.line + 1}` : `macro-included file`;
                metadata = {
                    signature: sym.kind === 'Task' ? `${sym.name}(${(sym.parameters || []).join(', ')})` : sym.name,
                    description: `Local ${sym.kind.toLowerCase()} defined in ${origin}`,
                    notes: sym.notes || []
                };
            }
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

// Implement Go to Definition
connection.onDefinition((params: TextDocumentPositionParams) => {
    const doc = documents.get(params.textDocument.uri);
    if (!doc) return null;

    const text = doc.getText();
    const lineText = text.split('\n')[params.position.line];
    const charPos = params.position.character;
    
    let start = charPos;
    while (start > 0 && /[a-zA-Z0-9_]/.test(lineText[start - 1])) start--;
    let end = charPos;
    while (end < lineText.length && /[a-zA-Z0-9_]/.test(lineText[end])) end++;
    
    const symbol = lineText.substring(start, end);
    const defs = documentDefinitions.get(params.textDocument.uri);

    if (defs) {
        // Find the specific definition that covers this cursor position
        const visible = defs.filter(d => d.name === symbol && 
            params.position.line >= d.scopeRange.start.line && 
            params.position.line <= d.scopeRange.end.line
        );
        // Prioritize the definition with the smallest scope (most local)
        visible.sort((a, b) => (a.scopeRange.end.line - a.scopeRange.start.line) - (b.scopeRange.end.line - b.scopeRange.start.line));
        
        const sym = visible[0];
        if (sym) {
            return {
                uri: sym.uri,
                range: sym.range
            };
        }
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
    const definitions: SymbolDefinition[] = [];

    try {
        const lexer = new Lexer(text, textDocument.uri);
        const tokens = lexer.tokenize();
        
        // Recursive macro resolver factory
        const createResolver = (currentUri: string) => {
            return (rawPath: string): Expr => {
                let parentDir: string;
                if (currentUri.startsWith('file://')) {
                    parentDir = path.dirname(fileURLToPath(currentUri));
                } else {
                    parentDir = process.cwd();
                }
                
                let targetPath = path.resolve(parentDir, rawPath);
                if (!targetPath.endsWith('.hank')) targetPath += '.hank';

                if (!fs.existsSync(targetPath)) {
                    const err = new Error(`Macro file not found: ${targetPath}`);
                    (err as any).isMacroError = true;
                    throw err;
                }

                const content = fs.readFileSync(targetPath, 'utf-8');
                const subLexer = new Lexer(content, `file://${targetPath.replace(/\\/g, '/')}`);
                const subTokens = subLexer.tokenize();
                
                const targetUri = targetPath.startsWith('/') ? `file://${targetPath}` : `file:///${targetPath.replace(/\\/g, '/')}`;
                
                const subParser = new Parser(subTokens, targetUri, createResolver(targetUri));
                return subParser.parse();
            };
        };

        const parser = new Parser(tokens, textDocument.uri, createResolver(textDocument.uri));
        const ast = parser.parse();

        // Walk AST to extract symbols with scope tracking
        const docDeadCode: Range[] = [];
        const scopeStack: Set<string>[] = [new Set()];

        const isDefinedAt = (name: string) => {
            for (let i = scopeStack.length - 1; i >= 0; i--) {
                if (scopeStack[i].has(name)) return true;
            }
            return false;
        };

        const walk = (node: Expr, currentScope: Range): boolean => {
            if (!node) return false;
            const nodeFilename = node.td.filename || textDocument.uri;

            switch (node.kind) {
                case 'Block':
                    scopeStack.push(new Set());
                    const blockRange: Range = {
                        start: { line: node.td.line - 1, character: node.td.column - 1 },
                        end: { line: node.td.line + 9999, character: 999 } 
                    };
                    let blockReturns = false;
                    for (const stmt of node.stmts) {
                        if (blockReturns && nodeFilename === textDocument.uri) {
                            docDeadCode.push({
                                start: { line: stmt.td.line - 1, character: stmt.td.column - 1 },
                                end: { line: stmt.td.line - 1, character: 999 }
                            });
                        }
                        if (walk(stmt, blockRange)) blockReturns = true;
                    }
                    scopeStack.pop();
                    return blockReturns;

                case 'Assign':
                    const notes: string[] = [];
                    
                    // Semantic Notes (Shadowing/Void)
                    if (node.value.kind === 'Ident') {
                        const rhsName = (node.value as any).name;
                        if (rhsName === node.name) {
                            if (!isDefinedAt(rhsName) && !HANK_STDLIB_METADATA[rhsName]) {
                                notes.push(`**Evaluate-Then-Bind**: The right-side '${rhsName}' was not found in any scope and evaluated to **Void**. This value is now bound to the local identifier '${rhsName}'.`);
                            } else if (isDefinedAt(rhsName)) {
                                notes.push(`**Shadowing**: This captures the value of '${rhsName}' from a parent scope. Changes to this local variable will not affect the original.`);
                            }
                        }
                    }
                    
                    // Task detection logic
                    let isTask = false;
                    let parameters: string[] | undefined = undefined;
                    let defUri = nodeFilename;
                    let defLine = node.td.line;
                    let defCol = node.td.column;

                    const checkTask = (val: Expr) => {
                        if (val.kind === 'FuncDef') {
                            isTask = true;
                            parameters = val.params.map(p => p.name);
                            defUri = val.td.filename || defUri;
                            defLine = val.td.line;
                            defCol = val.td.column;
                        } else if (val.kind === 'Block') {
                            const last = val.stmts[val.stmts.length - 1];
                            if (last) checkTask(last);
                        }
                    };
                    checkTask(node.value);

                    definitions.push({
                        name: node.name,
                        kind: isTask ? 'Task' : 'Variable',
                        parameters,
                        uri: defUri,
                        range: {
                            start: { line: defLine - 1, character: defCol - 1 },
                            end: { line: defLine - 1, character: defCol + node.name.length - 1 }
                        },
                        scopeRange: currentScope,
                        notes: notes.length > 0 ? notes : undefined
                    });

                    const rhsReturns = walk(node.value, currentScope);
                    
                    // Bind LHS to current scope
                    scopeStack[scopeStack.length - 1].add(node.name);
                    return rhsReturns;

                case 'FuncDef':
                    scopeStack.push(new Set(node.params.map(p => p.name)));
                    const funcRange: Range = {
                        start: { line: node.td.line - 1, character: node.td.column - 1 },
                        end: { line: node.td.line + 9999, character: 999 } 
                    };
                    walk(node.body, funcRange);
                    scopeStack.pop();
                    return false;

                case 'UnOp':
                    walk(node.target, currentScope);
                    return node.op === '^';

                case 'FlowControl':
                    walk(node.condition, currentScope);
                    walk(node.success, currentScope);
                    if (node.fallback) walk(node.fallback, currentScope);
                    if (node.rescue) walk(node.rescue, currentScope);
                    return false;

                case 'FuncCall':
                    walk(node.target, currentScope);
                    node.args.forEach(a => walk(a, currentScope));
                    return false;

                case 'Array':
                    node.items.forEach(a => walk(a, currentScope));
                    return false;

                case 'Map':
                    node.fields.forEach(a => walk(a, currentScope));
                    return false;

                default:
                    return false;
            }
        };

        const globalScope: Range = { start: { line: 0, character: 0 }, end: { line: 9999, character: 999 } };
        walk(ast, globalScope);
        documentDefinitions.set(textDocument.uri, definitions);
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
