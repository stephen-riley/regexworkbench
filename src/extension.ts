// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

import * as path from 'path';
import * as fs from 'fs';

const cmdId = 'regexworkbench.start';
const regexKey = "regexworkbench.regex";
const searchKey = "regexworkbench.search";
const replacementKey = "regexworkbench.replacement";
const modeKey = "regexworkbench.mode";

const defaultState: RegexWorkbenchPanelState = {
	regex: "(there)",
	search: "hello there!",
	replacement: "world",
	mode: "match"
};

let statusBarItem: vscode.StatusBarItem;
let extensionContext: vscode.ExtensionContext;

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	extensionContext = context;

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

interface RegexWorkbenchPanelState {
	regex: string;
	replacement: string;
	search: string;
	mode: string;
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

	private _state: RegexWorkbenchPanelState = defaultState;

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

		this._readState();

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
					case 'stateChange':
						this._state = JSON.parse(message.text);
						this._writeState();
						return;
					case 'ready':
						this._setState();
						return;
					case 'info':
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

		this._writeState();

		// Clean up our resources
		this._panel.dispose();

		while (this._disposables.length) {
			const x = this._disposables.pop();
			if (x) {
				x.dispose();
			}
		}
	}

	private _setState() {
		this._panel.webview.postMessage({ command: 'setState', state: this._state });
	}

	private _readState() {
		const state = {
			regex: extensionContext.globalState.get<string>(regexKey) || defaultState.regex,
			search: extensionContext.globalState.get<string>(searchKey) || defaultState.search,
			replacement: extensionContext.globalState.get<string>(replacementKey) || defaultState.replacement,
			mode: extensionContext.globalState.get<string>(modeKey) || defaultState.mode,
		};

		this._state = state.regex !== undefined ? state : defaultState;
	}

	private _writeState() {
		extensionContext.globalState.update(regexKey, this._state.regex);
		extensionContext.globalState.update(searchKey, this._state.search);
		extensionContext.globalState.update(replacementKey, this._state.replacement);
		extensionContext.globalState.update(modeKey, this._state.mode);
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