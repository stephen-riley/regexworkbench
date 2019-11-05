// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

import * as path from 'path';

let statusBarItem: vscode.StatusBarItem;

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	const cmdId = 'regexworkbench.start';

	context.subscriptions.push(
		vscode.commands.registerCommand(cmdId, () => {
			RegexWorkbenchPanel.createOrShow(context.extensionPath);
		})
	);

	statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
	statusBarItem.command = cmdId;
	context.subscriptions.push(statusBarItem);

	statusBarItem.text = `/$(star)/`;
	statusBarItem.show();

	if (vscode.window.registerWebviewPanelSerializer) {
		// Make sure we register a serializer in activation event
		vscode.window.registerWebviewPanelSerializer(RegexWorkbenchPanel.viewType, {
			async deserializeWebviewPanel(webviewPanel: vscode.WebviewPanel, state: any) {
				RegexWorkbenchPanel.revive(webviewPanel, context.extensionPath);
			}
		});
	}
}


class RegexWorkbenchPanel {
	/**
	 * Track the currently panel. Only allow a single panel to exist at a time.
	 */
	public static currentPanel: RegexWorkbenchPanel | undefined;

	public static readonly viewType = 'regexworkbench';

	private readonly _panel: vscode.WebviewPanel;
	private readonly _extensionPath: string;
	private _disposables: vscode.Disposable[] = [];

	public static createOrShow(extensionPath: string) {
		const column = vscode.window.activeTextEditor
			? vscode.window.activeTextEditor.viewColumn
			: undefined;

		// If we already have a panel, show it.
		if (RegexWorkbenchPanel.currentPanel) {
			RegexWorkbenchPanel.currentPanel._panel.reveal(column);
			return;
		}

		// Otherwise, create a new panel.
		const panel = vscode.window.createWebviewPanel(
			RegexWorkbenchPanel.viewType,
			'Regex Workbench',
			column || vscode.ViewColumn.One,
			{
				// Enable javascript in the webview
				enableScripts: true,

				// And restrict the webview to only loading content from our extension's `media` directory.
				localResourceRoots: [vscode.Uri.file(path.join(extensionPath, 'media'))]
			}
		);

		RegexWorkbenchPanel.currentPanel = new RegexWorkbenchPanel(panel, extensionPath);
	}

	public static revive(panel: vscode.WebviewPanel, extensionPath: string) {
		RegexWorkbenchPanel.currentPanel = new RegexWorkbenchPanel(panel, extensionPath);
	}

	private constructor(panel: vscode.WebviewPanel, extensionPath: string) {
		this._panel = panel;
		this._extensionPath = extensionPath;

		// Set the webview's initial html content
		this._update();

		// Listen for when the panel is disposed
		// This happens when the user closes the panel or when the panel is closed programatically
		this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

		// Update the content based on view changes
		this._panel.onDidChangeViewState(
			(_: any) => {
				if (this._panel.visible) {
					this._update();
				}
			},
			null,
			this._disposables
		);

		// Handle messages from the webview
		this._panel.webview.onDidReceiveMessage(
			(message: any) => {
				switch (message.command) {
					case 'alert':
						vscode.window.showErrorMessage(message.text);
						return;
				}
			},
			null,
			this._disposables
		);
	}

	public dispose() {
		RegexWorkbenchPanel.currentPanel = undefined;

		// Clean up our resources
		this._panel.dispose();

		while (this._disposables.length) {
			const x = this._disposables.pop();
			if (x) {
				x.dispose();
			}
		}
	}

	private _update() {
		const webview = this._panel.webview;
		this._panel.title = "Regex Workbench";
		this._panel.webview.html = this._getHtmlForWebview();
	}

	private _getHtmlForWebview() {
		const webview = this._panel.webview;

		const [regexworkbenchjsUri, jqueryjsUri, regexworkbenchcssUri] = ["regexworkbench.js", "jquery-3.4.1.min.js", "regexworkbench.css"].map(script => {
			const pathOnDisk = vscode.Uri.file(path.join(this._extensionPath, 'media', script));
			const uri = webview.asWebviewUri(pathOnDisk);
			return uri;
		});

		const doc = `
			<!DOCTYPE html>
			<html lang="en">

			<head>
				<meta charset="UTF-8">
				<meta
					http-equiv="Content-Security-Policy"
					content="default-src 'none'; script-src ${webview.cspSource}; style-src ${webview.cspSource};"
				/>
				<link rel="stylesheet" type="text/css" href="${regexworkbenchcssUri}">
				<title>Regular Expression Workbench</title>
			</head>

			<body>
				<div id="mode-section" class="section">
					<button id="match-btn" class="mode-btn">Match</button>
					<button id="matchall-btn" class="mode-btn">Match All</button>
					<button id="split-btn" class="mode-btn">Split</button>
					<button id="replace-btn" class="mode-btn">Replace</button>
					<button id="replaceall-btn" class="mode-btn">Replace All</button>
				</div>

				<div id="regex-section" class="section">
					<span class="section-header">Regular Expression</span>
					<textarea id="regex" class="ta"></textarea>
					<span class="switchpanel">
						&nbsp;/
						<span id="i-switch" class="switch">i</span>
						<span id="m-switch" class="switch">m</span>
						<span id="s-switch" class="switch">s</span>
					</span>
				</div>

				<div id="replacement-section" class="section">
					<span class="section-header">Replacement</span>
					<textarea id="replacement" class="ta"></textarea>
				</div>

				<div id="search-section" class="section">
					<span class="section-header">Search Text</span>
					<textarea id="search" class="ta"></textarea>
				</div>

				<div id="replaced-section" class="section">
					<span class="section-header">Replaced Text</span>
					<textarea id="replaced" class="ro ta"></textarea>
				</div>

				<div id="results-section" class="section">
					<span class="section-header">Replace Results</span>
					<textarea id="results" class="ro ta"></textarea>
				</div>

				<div id="splitresults-section" class="section">
					<span class="section-header">Split Results</span>
					<textarea id="splitresults" class="ro ta"></textarea>
				</div>

				<script src="${jqueryjsUri}"></script>
				<script src="${regexworkbenchjsUri}"></script>
			</body>

			</html>
		`;

		return doc;
	}
}