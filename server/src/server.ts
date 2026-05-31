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
    ParameterInformation
} from 'vscode-languageserver/node.js';

import { TextDocument } from 'vscode-languageserver-textdocument';

// Import Hank Core (using relative path to submodule source)
import { Lexer } from '../vendor/hank-ts/src/Lexer.js';
import { Parser } from '../vendor/hank-ts/src/Parser.js';
import { Runner } from '../vendor/hank-ts/src/Runner.js';
import { StdLib } from '../vendor/hank-ts/src/stdlib/index.js';
import { HankErrorValue, Resource, Value, ValueType } from '../vendor/hank-ts/src/Types.js';

// Import Metadata
import { HANK_STDLIB_METADATA } from './metadata.js';

// Mock Resource for LSP execution
class MemoryResource implements Resource {
    public ast: any = null;
    constructor(public id: string, public content: string) {}
    async load() { return; }
    resolve(path: string) { return new MemoryResource(path, ''); }
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
    return Object.values(HANK_STDLIB_METADATA).map(t => ({
        label: t.name,
        kind: CompletionItemKind.Function,
        detail: t.signature,
        documentation: t.description
    }));
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
    const metadata = HANK_STDLIB_METADATA[symbol];

    if (metadata) {
        const signature: SignatureInformation = {
            label: metadata.signature,
            documentation: {
                kind: MarkupKind.Markdown,
                value: metadata.description
            },
            parameters: metadata.parameters.map(p => ({
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
    const metadata = HANK_STDLIB_METADATA[symbol];

    if (metadata) {
        return {
            contents: {
                kind: MarkupKind.Markdown,
                value: [
                    `### \`${metadata.signature}\``,
                    `---`,
                    metadata.description,
                    metadata.example ? `\n**Example:**\n\`\`\`hank\n${metadata.example}\n\`\`\`` : ''
                ].join('\n')
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
        const resource = new MemoryResource(params.uri, params.content);
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

    try {
        const lexer = new Lexer(text);
        const tokens = lexer.tokenize();
        
        // Dummy macro resolver for LSP diagnostics
        // In the future, we could actually try to resolve and parse macros for deeper validation
        const parser = new Parser(tokens, textDocument.uri, (id) => {
            throw new Error(`Macro resolution not yet supported in LSP: ${id}`);
        });

        parser.parse();
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
