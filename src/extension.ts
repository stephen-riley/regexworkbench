
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

const cmdId = 'regexworkbench.start';
const regexKey = "regexworkbench.regex";
const searchKey = "regexworkbench.search";
const replacementKey = "regexworkbench.replacement";
const modeKey = "regexworkbench.mode";
const iKey = "regexworkbench.i";
const mKey = "regexworkbench.m";
const sKey = "regexworkbench.s";

interface RegexWorkbenchPanelState {
	regex: string;
	replacement: string;
	search: string;
	mode: string;
	switches: {
		i: boolean;
		m: boolean;
		s: boolean;
	};
}

const defaultState: RegexWorkbenchPanelState = {
	regex: "(there)",
	search: "hello there!",
	replacement: "world",
	mode: "match",
	switches: {
		i: false,
		m: false,
		s: false
	}
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

		if (RegexWorkbenchPanel.currentPanel) {
			RegexWorkbenchPanel.currentPanel._panel.reveal(column);
			return;
		}

		const panel = vscode.window.createWebviewPanel(
			RegexWorkbenchPanel.viewType,
			'Regex Workbench',
			column || vscode.ViewColumn.One,
			{
				enableScripts: true,
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
		this._update();

		this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

		this._panel.onDidChangeViewState(
			(_: any) => {
				if (this._panel.visible) {
					this._update();
				}
			},
			null,
			this._disposables
		);

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
					case 'loadsearchtext':
						this._loadSearchTextFile();
				}
			},
			null,
			this._disposables
		);
	}

	public dispose() {
		RegexWorkbenchPanel.currentPanel = undefined;

		this._writeState();

		this._panel.dispose();

		while (this._disposables.length) {
			const x = this._disposables.pop();
			if (x) {
				x.dispose();
			}
		}
	}

	private _loadSearchTextFile() {
		const options: vscode.OpenDialogOptions = {
			canSelectMany: false,
			openLabel: 'Open',
			filters: { 'All files': ['*'] }
		};

		vscode.window.showOpenDialog(options).then(fileUri => {
			if (fileUri && fileUri[0]) {
				const text = fs.readFileSync(fileUri[0].fsPath, { encoding: 'utf-8' });
				this._state.search = text;
				this._setState();
			}
		});
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
			switches: {
				i: extensionContext.globalState.get<boolean>(iKey) || defaultState.switches.i,
				m: extensionContext.globalState.get<boolean>(mKey) || defaultState.switches.m,
				s: extensionContext.globalState.get<boolean>(sKey) || defaultState.switches.s,
			}
		};

		this._state = state.regex !== undefined ? state : defaultState;
	}

	private _writeState() {
		extensionContext.globalState.update(regexKey, this._state.regex);
		extensionContext.globalState.update(searchKey, this._state.search);
		extensionContext.globalState.update(replacementKey, this._state.replacement);
		extensionContext.globalState.update(modeKey, this._state.mode);
		extensionContext.globalState.update(iKey, this._state.switches.i);
		extensionContext.globalState.update(mKey, this._state.switches.m);
		extensionContext.globalState.update(sKey, this._state.switches.s);
	}

	private _update() {
		const webview = this._panel.webview;
		this._panel.title = "Regex Workbench";
		this._panel.webview.html = this._getHtmlForWebview();
	}

	private _getNonce() {
		let text = '';
		const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
		for (let i = 0; i < 32; i++) {
			text += possible.charAt(Math.floor(Math.random() * possible.length));
		}
		return text;
	}

	private _getHtmlForWebview() {
		const webview = this._panel.webview;

		const nonce = this._getNonce();

		const [workbenchjsUri, workbenchcssUri, jqueryjsUri, linedtajsUri, linedtacssUri] =
			["js/regexworkbench.js", "css/regexworkbench.css", "js/jquery-3.4.1.min.js", "js/jquery-linedtextarea.js", "css/jquery-linedtextarea.css"]
				.map(script => {
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
					content="default-src 'none'; script-src 'nonce-${nonce}'; style-src ${webview.cspSource} 'unsafe-inline';"
				/>

				<link rel="stylesheet" type="text/css" href="${linedtacssUri}">
				<link rel="stylesheet" type="text/css" href="${workbenchcssUri}">

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

				<div id="container">
					<div id="regex-section" class="section col1">
						<span class="section-header">Regular Expression</span>
						<div class="regex-panel">
							<table>
								<tr>
									<td class="regex-td">
										<textarea id="regex" class="ta lined" style="width:100%"></textarea>
									</td>
									<td width="85px" valign="top">
										<span class="switchpanel">
											&nbsp;/
											<span id="i-switch" class="switch">i</span>
											<span id="m-switch" class="switch">m</span>
											<span id="s-switch" class="switch">s</span>
										</span>
									</td>
								</tr>
							</table>
						</div>
					</div>

					<div id="replacement-section" class="section col2">
						<span class="section-header">Replacement</span>
						<textarea id="replacement" class="ta lined" style="width:100%"></textarea>
					</div>

					<div id="search-section" class="section col1">
						<span class="section-header ta">
							Search Text
							<span id="folder" class="folder">open</span>
						</span>
						<textarea id="search" class="ta lined" style="width:100%"></textarea>
					</div>

					<div id="replaced-section" class="section col2">
						<span class="section-header">Replaced Text</span>
						<textarea id="replaced" class="ta lined" readonly style="width:100%"></textarea>
					</div>

					<div id="results-section" class="section col-all">
						<span class="section-header">Replace Results</span>
						<div id="results" class="ta"></div>
					</div>

					<div id="splitresults-section" class="section col-all">
						<span class="section-header">Split Results</span>
						<div id="splitresults" class="ta"></div>
					</div>
				</div>

				<script nonce="${nonce}" src="${jqueryjsUri}"></script>
				<script nonce="${nonce}" src="${linedtajsUri}"></script>
				<script nonce="${nonce}" type="module" src="${workbenchjsUri}"></script>
			</body>

			</html>
		`;

		return doc;
	}
}