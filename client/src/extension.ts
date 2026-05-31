import * as path from 'path';
import { workspace, ExtensionContext, window, OutputChannel, commands } from 'vscode';
import {
    LanguageClient,
    LanguageClientOptions,
    ServerOptions,
    TransportKind
} from 'vscode-languageclient/node';

let client: LanguageClient;
let outputChannel: OutputChannel;

export function activate(context: ExtensionContext) {
    // Create Output Channel
    outputChannel = window.createOutputChannel('Hank');

    // The server is implemented in node
    const serverModule = context.asAbsolutePath(
        path.join('server', 'out', 'src', 'server.js')
    );

    // If the extension is launched in debug mode then the debug server options are used
    // Otherwise the run options are used
    const serverOptions: ServerOptions = {
        run: { module: serverModule, transport: TransportKind.ipc },
        debug: {
            module: serverModule,
            transport: TransportKind.ipc,
        }
    };

    // Options to control the language client
    const clientOptions: LanguageClientOptions = {
        // Register the server for hank documents
        documentSelector: [{ scheme: 'file', language: 'hank' }],
        synchronize: {
            // Notify the server about file changes to '.hank files contained in the workspace
            fileEvents: workspace.createFileSystemWatcher('**/*.hank')
        }
    };

    // Create the language client and start the client.
    client = new LanguageClient(
        'hankLanguageServer',
        'Hank Language Server',
        serverOptions,
        clientOptions
    );

    // Register Run Command
    context.subscriptions.push(commands.registerCommand('hank.runScript', () => {
        const editor = window.activeTextEditor;
        if (!editor) {
            window.showErrorMessage('No active Hank script found.');
            return;
        }

        const script = editor.document.getText();
        const uri = editor.document.uri.toString();

        outputChannel.clear();
        outputChannel.show(true); // Focus the tab
        outputChannel.appendLine(`--- Running: ${path.basename(editor.document.fileName)} ---`);

        client.sendRequest('hank/execute', { uri, content: script }).then((result: any) => {
            outputChannel.appendLine(`\n--- Execution Finished (Result: ${result}) ---`);
        }).catch((err) => {
            outputChannel.appendLine(`\n--- Execution Failed ---`);
            outputChannel.appendLine(err.message || String(err));
        });
    }));

    // Start the client. This will also launch the server
    client.start().then(() => {
        // Register custom notifications from the server
        client.onNotification('hank/log', (msg: string) => {
            outputChannel.appendLine(msg);
        });
        client.onNotification('hank/error', (msg: string) => {
            outputChannel.appendLine(`[ERROR] ${msg}`);
        });
    });
}

export function deactivate(): Thenable<void> | undefined {
    if (!client) {
        return undefined;
    }
    return client.stop();
}
