"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_js_1 = require("vscode-languageserver/node.js");
const vscode_languageserver_textdocument_1 = require("vscode-languageserver-textdocument");
// Import Hank Core (using relative path to submodule source)
const Lexer_js_1 = require("../vendor/hank-ts/src/Lexer.js");
const Parser_js_1 = require("../vendor/hank-ts/src/Parser.js");
const connection = (0, node_js_1.createConnection)(node_js_1.ProposedFeatures.all);
const documents = new node_js_1.TextDocuments(vscode_languageserver_textdocument_1.TextDocument);
connection.onInitialize((params) => {
    const result = {
        capabilities: {
            textDocumentSync: node_js_1.TextDocumentSyncKind.Incremental,
            // Future phases:
            // hoverProvider: true,
            // completionProvider: {
            //     resolveProvider: true
            // }
        }
    };
    return result;
});
// The content of a text document has changed. This event is emitted
// when the text document first opened or when its content has changed.
documents.onDidChangeContent(change => {
    validateTextDocument(change.document);
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