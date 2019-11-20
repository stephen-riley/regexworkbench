'use strict';

const displayMap = {
    'match-btn': ['mode', 'regex', 'search', 'results'],
    'matchall-btn': ['mode', 'regex', 'search', 'results'],
    'split-btn': ['mode', 'regex', 'search', 'splitresults'],
    'replace-btn': ['mode', 'regex', 'replacement', 'search', 'replaced', 'results'],
    'replaceall-btn': ['mode', 'regex', 'replacement', 'search', 'replaced', 'results'],
};

const vscode = acquireVsCodeApi();

function updateModeButtons(el) {
    $('.mode-btn').each((_, btn) => {
        if (btn.id === el.target.id) {
            $(btn).addClass('selected');
        } else {
            $(btn).removeClass('selected')
        }
    });

    const selectedId = $('.selected')[0].id;
    const toBeDisplayed = displayMap[selectedId].reduce((m, x) => {
        m[`${x}-section`] = 0;
        return m;
    }, {});

    $('.section').each((_, section) => {
        if (section.id in toBeDisplayed) {
            $(`#${section.id}`).show();
        } else {
            $(`#${section.id}`).hide();
        }
    });

    execute();
};

function execute() {
    $('#results').empty();
    $('#splitresults').empty();

    const selectedId = $('.selected')[0].id.replace("-btn", "");

    try {
        switch (selectedId) {
            case 'match': match(); break;
            case 'matchall': matchAll(); break;
            case 'split': split(); break;
            case 'replace': replace(); break;
            case 'replaceall': replaceAll(); break;
        }
    } catch (e) {
        console.log(e);
        $('#results').val('Invalid regular expression');
        $('#splitresults').val('Invalid regular expression');
    }

    updateStateInHost();
};

function buildResultsTable(results, parent) {
    const tr = html => `<tr>${html}</tr>`;
    const th = (arry, attrs) => arry.reduce((s, html) => s += `<th ${attrs || ''}>${html}</th>`, '');
    const td = (arry, attrs) => arry.reduce((s, html) => s += `<td ${attrs || ''}>${html}</td>`, '');

    let table = '<table class="ta">';
    table += tr(td(['Group', 'Span', 'Value'], 'class="bold"'));

    let matchIndex = 0;
    results.forEach(e => {
        table += tr(th([`Match ${matchIndex}`, `${e.start}-${e.end}`, e.match]));

        if (e.groups.length > 0) {
            let groupIndex = 1;
            e.groups.forEach(g => {
                const title = 'name' in g
                    ? `Group ${groupIndex} (${g.name})`
                    : `Group ${groupIndex}`;

                table += tr(td([title, `${g.start}-${g.end}`, g.match]));
                groupIndex++;
            });
        }
        matchIndex++;
    });

    table += '</table>';

    $(parent).empty();
    $(parent).html($(table));
    wireThClick();
}

function match() {
    const regex = new MultiRegExp2(new RegExp($('#regex').val(), "g" + getSwitches()));
    const search = $('#search').val();

    const execResults = regex.execForAllGroups(search, true);
    if (execResults == null) {
        return;
    }

    const match = execResults.shift();
    match.groups = execResults;

    buildResultsTable([match], $('#results'));
};

function matchAll() {
    const regex = new MultiRegExp2(new RegExp($('#regex').val(), "g" + getSwitches()));
    const search = $('#search').val();

    let results = [];
    let iteration;

    while ((iteration = regex.execForAllGroups(search, true)) != null) {
        const match = iteration.shift();
        match.groups = iteration;
        results.push(match);
    }

    buildResultsTable(results, $('#results'));
};

function split() {
    const regex = new RegExp($('#regex').val(), "g" + getSwitches());
    const search = $('#search').val();

    const items = search.split(regex).map(s => s.replace(/[\r\n]/g, "&nbsp;"));
    const results = items.map(item => `<span class="nl">${item}</span>`).join('');

    $('#splitresults').empty().html(results);
};

function replace() {
    match();
    const regex = new RegExp($('#regex').val(), getSwitches());
    const search = $('#search').val();
    const replacement = $('#replacement').val();

    $('#replaced').val(search.replace(regex, replacement));
};

function replaceAll() {
    matchAll();
    const regex = new RegExp($('#regex').val(), "g" + getSwitches());
    const search = $('#search').val();
    const replacement = $('#replacement').val();

    $('#replaced').val(search.replace(regex, replacement));
};

function processResults(r) {
    if (r === null) {
        return null;
    }

    let expanded = { results: [] };
    for (let i = 0; i < r.length; i++) {
        expanded.results[i] = r[i];
    }
    if ('groups' in r) {
        expanded.groups = r.groups;
    }
    return expanded;
};

function getSwitches() {
    const switches = $('.switch.selected').get().reduce((p, el) => p + el.id.replace("-switch", ""), "");
    return switches;
};

let regexTimeoutHandle;
function onRegexChange(_) {
    if (regexTimeoutHandle) {
        clearTimeout(regexTimeoutHandle);
        regexTimeoutHandle = undefined;
    }

    regexTimeoutHandle = setTimeout(execute, 300);
};

let searchTimeoutHandle;
function onSearchChange(_) {
    if (searchTimeoutHandle) {
        clearTimeout(searchTimeoutHandle);
        searchTimeoutHandle = undefined;
    }

    searchTimeoutHandle = setTimeout(execute, 300);
};

let replacementTimeoutHandle;
function onReplacementChange(_) {
    if (replacementTimeoutHandle) {
        clearTimeout(replacementTimeoutHandle);
        replacementTimeoutHandle = undefined;
    }

    replacementTimeoutHandle = setTimeout(execute, 500);
};

function updateStateInHost() {
    const state = {
        regex: $('#regex').val(),
        search: $('#search').val(),
        replacement: $('#replacement').val(),
        mode: $('.mode-btn.selected')[0].id.replace("-btn", ""),
        switches: {
            i: $('#i-switch.selected').length > 0,
            m: $('#m-switch.selected').length > 0,
            s: $('#s-switch.selected').length > 0
        }
    };

    vscode.postMessage({
        command: "stateChange",
        text: JSON.stringify(state)
    });
};

function onSwitchClick(e) {
    const el = $(e.target);

    if (el.attr('class').split(/\s+/).includes('selected')) {
        el.removeClass('selected');
    } else {
        el.addClass('selected');
    }
    execute();
};

function getVscodeTheme() {
    const theme = $('body').attr('class').split(' ').reduce((res, c) => c.startsWith('vscode-') ? c : res, "");
    return theme;
};

function applyVscodeThemeCss() {
    const theme = getVscodeTheme();
    $('*').addClass(theme);
};

function infoWindow(msg) {
    vscode.postMessage({ command: 'info', text: msg });
};

function setUiState(state) {
    $('#regex').val(state.regex);
    $('#search').val(state.search);
    $('#replacement').val(state.replacement);

    const buttonId = `#${state.mode}-btn`;
    $(buttonId).click();

    if (state.switches.i) {
        $('#i-switch').click();
    }
    if (state.switches.m) {
        $('#m-switch').click();
    }
    if (state.switches.s) {
        $('#s-switch').click();
    }
};

function wireThClick() {
    $('th').unbind();

    $('th').click(e => {
        const el = $(e.target);
        let curNode = el.parent().next();

        while (true) {
            const firstChild = curNode.children().first();

            const childTag = firstChild.prop('tagName');
            if (childTag === undefined) {
                break;
            }
            if (childTag.toLowerCase() === 'th') {
                break;
            }

            curNode.toggle();
            curNode = curNode.next();
        }
    });
}

$(document).ready(() => {
    applyVscodeThemeCss();

    $('#regex').bind('input propertychange', onRegexChange);
    $('#search').bind('input propertychange', onSearchChange);
    $('#replacement').bind('input propertychange', onReplacementChange);

    $('.mode-btn').click(updateModeButtons);
    $('.switch').click(onSwitchClick);

    $('#results').css('font-size', $('#regex').css('font-size'));
    $('#splitresults').css('font-size', $('#regex').css('font-size'));

    window.addEventListener('message', e => {
        const message = e.data;
        switch (message.command) {
            case 'setState':
                setUiState(message.state);
                break;
        }
    });

    vscode.postMessage({ command: "ready" });
});