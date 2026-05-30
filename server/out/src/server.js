"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_js_1 = require("vscode-languageserver/node.js");
const vscode_languageserver_textdocument_1 = require("vscode-languageserver-textdocument");
// Import Hank Core (using relative path to submodule source)
const Lexer_js_1 = require("../vendor/hank-ts/src/Lexer.js");
const Parser_js_1 = require("../vendor/hank-ts/src/Parser.js");
// Import Metadata
const metadata_js_1 = require("./metadata.js");
const connection = (0, node_js_1.createConnection)(node_js_1.ProposedFeatures.all);
const documents = new node_js_1.TextDocuments(vscode_languageserver_textdocument_1.TextDocument);
connection.onInitialize((params) => {
    const result = {
        capabilities: {
            textDocumentSync: node_js_1.TextDocumentSyncKind.Incremental,
            completionProvider: {
                resolveProvider: false,
                triggerCharacters: ['.']
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
connection.onCompletion((pos) => {
    const doc = documents.get(pos.textDocument.uri);
    if (!doc)
        return [];
    const text = doc.getText();
    const offset = doc.offsetAt(pos.position);
    // Check if we are after a dot
    const textBefore = text.substring(0, offset);
    const dotMatch = textBefore.match(/([a-zA-Z_][a-zA-Z0-9_]*)\.$/);
    if (dotMatch) {
        const moduleName = dotMatch[1];
        const module = metadata_js_1.HANK_STDLIB_METADATA[moduleName];
        if (module) {
            return Object.values(module.tasks).map(t => ({
                label: t.name,
                kind: node_js_1.CompletionItemKind.Function,
                detail: t.signature,
                documentation: t.description
            }));
        }
    }
    // Suggest top-level modules
    return Object.values(metadata_js_1.HANK_STDLIB_METADATA).map(m => ({
        label: m.name,
        kind: node_js_1.CompletionItemKind.Module,
        detail: `Hank Standard Library: ${m.name}`,
        documentation: m.description
    }));
});
// Implement Signature Help
connection.onSignatureHelp((params) => {
    const doc = documents.get(params.textDocument.uri);
    if (!doc)
        return null;
    const text = doc.getText();
    const offset = doc.offsetAt(params.position);
    const textBefore = text.substring(0, offset);
    // Find the innermost unclosed function call
    let parenDepth = 0;
    let currentPos = textBefore.length - 1;
    let commaCount = 0;
    while (currentPos >= 0) {
        const char = textBefore[currentPos];
        if (char === ')')
            parenDepth++;
        if (char === '(') {
            if (parenDepth === 0)
                break;
            parenDepth--;
        }
        if (char === ',' && parenDepth === 0)
            commaCount++;
        currentPos--;
    }
    if (currentPos < 0)
        return null;
    // Extract the task name before the '('
    const nameMatch = textBefore.substring(0, currentPos).match(/([a-zA-Z_][a-zA-Z0-9_.]*)$/);
    if (!nameMatch)
        return null;
    const symbol = nameMatch[1];
    let metadata;
    if (symbol.includes('.')) {
        const [modName, taskName] = symbol.split('.');
        metadata = metadata_js_1.HANK_STDLIB_METADATA[modName]?.tasks[taskName];
    }
    if (metadata) {
        const signature = {
            label: metadata.signature,
            documentation: {
                kind: node_js_1.MarkupKind.Markdown,
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
connection.onHover((params) => {
    const doc = documents.get(params.textDocument.uri);
    if (!doc)
        return null;
    const text = doc.getText();
    const offset = doc.offsetAt(params.position);
    // Extract the symbol under cursor (either module.task or just identifier)
    const lineText = text.split('\n')[params.position.line];
    const charPos = params.position.character;
    // Find boundaries of the word/symbol
    let start = charPos;
    while (start > 0 && /[a-zA-Z0-9_.]/.test(lineText[start - 1]))
        start--;
    let end = charPos;
    while (end < lineText.length && /[a-zA-Z0-9_.]/.test(lineText[end]))
        end++;
    const symbol = lineText.substring(start, end);
    // Handle module.task
    if (symbol.includes('.')) {
        const [modName, taskName] = symbol.split('.');
        const metadata = metadata_js_1.HANK_STDLIB_METADATA[modName]?.tasks[taskName];
        if (metadata) {
            return {
                contents: {
                    kind: node_js_1.MarkupKind.Markdown,
                    value: [
                        `### \`${metadata.signature}\``,
                        `---`,
                        metadata.description,
                        metadata.example ? `\n**Example:**\n\`\`\`hank\n${metadata.example}\n\`\`\`` : ''
                    ].join('\n')
                }
            };
        }
    }
    // Handle just module
    const module = metadata_js_1.HANK_STDLIB_METADATA[symbol];
    if (module) {
        return {
            contents: {
                kind: node_js_1.MarkupKind.Markdown,
                value: [
                    `### Module: \`${module.name}\``,
                    `---`,
                    module.description,
                    `\n**Tasks:** ${Object.keys(module.tasks).join(', ')}`
                ].join('\n')
            }
        };
    }
    return null;
});
async function validateTextDocument(textDocument) {
    const text = textDocument.getText();
    const diagnostics = [];
    try {
        const lexer = new Lexer_js_1.Lexer(text);
        const tokens = lexer.tokenize();
        // Dummy macro resolver for LSP diagnostics
        // In the future, we could actually try to resolve and parse macros for deeper validation
        const parser = new Parser_js_1.Parser(tokens, textDocument.uri, (id) => {
            throw new Error(`Macro resolution not yet supported in LSP: ${id}`);
        });
        parser.parse();
    }
    catch (e) {
        // If it's a HankErrorValue (from the Parser/Lexer)
        if (e && typeof e === 'object' && 'line' in e) {
            const hankError = e;
            // Note: Hank lines/cols are 1-based, VSCode lines/cols are 0-based
            const line = Math.max(0, (hankError.line || 1) - 1);
            const character = Math.max(0, (hankError.column || 1) - 1);
            const diagnostic = {
                severity: node_js_1.DiagnosticSeverity.Error,
                range: {
                    start: { line, character },
                    end: { line, character: character + 1 }
                },
                message: hankError.message,
                source: 'hank'
            };
            diagnostics.push(diagnostic);
        }
        else {
            // Generic error
            const diagnostic = {
                severity: node_js_1.DiagnosticSeverity.Error,
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
//# sourceMappingURL=server.js.map