'use strict';

import MultiRegExp2 from './multiRegExp2.js';
import Tooltips from './strings.js';

const displayMap = {
    'match-btn': [['mode', 'regex', 'search', 'results'], showMatchUI],
    'matchall-btn': [['mode', 'regex', 'search', 'results'], showMatchUI],
    'split-btn': [['mode', 'regex', 'search', 'splitresults'], showMatchUI],
    'replace-btn': [['mode', 'regex', 'replacement', 'search', 'replaced', 'results'], showReplaceUI],
    'replaceall-btn': [['mode', 'regex', 'replacement', 'search', 'replaced', 'results'], showReplaceUI],
};

const vscode = acquireVsCodeApi();

function showMatchUI() {
    $('#regex-section').removeClass("col1").addClass("col-all");
    $('#search-section').removeClass("col1").addClass("col-all");
}

function showReplaceUI() {
    $('#regex-section').removeClass("col-all").addClass("col1");
    $('#search-section').removeClass("col-all").addClass("col1");
}

function updateModeButtons(el) {
    $('.mode-btn').each((_, btn) => {
        if (btn.id === el.target.id) {
            $(btn).addClass('selected');
        } else {
            $(btn).removeClass('selected')
        }
    });

    const selectedId = $('.selected')[0].id;
    const toBeDisplayed = displayMap[selectedId][0].reduce((m, x) => {
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

    displayMap[selectedId][1]();

    execute();
};

function execute() {
    $('#results').empty();
    $('#splitresults').empty();

    const selectedId = $('.selected')[0].id.replace("-btn", "");

    vscode.postMessage({
        command: 'execute',
        type: selectedId,
        regex: $('#regex').val(),
        flags: getSwitches(),
        subject: $('#search').val(),
        replacement: $('#replacement').val(),
    });
}

function processResults(r) {
    switch (r.op) {
        case 'match':
            buildResultsTable(r.results, $('#results'));
            break;
        case 'matchAll':
            buildResultsTable(r.results, $('#results'));
            break;
        case 'split': {
            const items = r.results.map(s => s.replace(/[\r\n]/g, "&nbsp;"));
            const results = items.map(item => `<span class="nl">${item}</span>`).join('');
            $('#splitresults').empty().html(results);
            break;
        }
        case 'replace':
            buildResultsTable(r.results.matches, $('#results'));
            $('#replaced').val(r.results.result);
            break;
        case 'replaceAll':
            buildResultsTable(r.results.matches, $('#results'));
            $('#replaced').val(r.results.result);
            break;
        case 'ERROR':
            $('#results').html(r.results.message);
            $('#splitresults').html(r.results.message);
            break;
    }

    updateStateInHost();
}

function buildResultsTable(results, parent) {
    const tr = html => `<tr>${html}</tr>`;
    const th = (arry, attrs) => arry.reduce((s, html) => s += `<th ${attrs || ''}>${html}</th>`, '');
    const td = (arry, attrs) => arry.reduce((s, html) => s += `<td ${attrs || ''}>${html}</td>`, '');

    let table = '<table class="ta">';
    table += tr(td(['Group', 'Span', 'Value'], 'class="bold"'));

    let matchIndex = 0;
    results.forEach(e => {
        table += tr(th([`Match ${matchIndex}`, `${e[0].start}-${e[0].end}`, e[0].match]));

        if (e.length > 0) {
            let groupIndex = 1;
            while (groupIndex < e.length) {
                const g = e[groupIndex];
                const title = 'name' in g
                    ? `Group ${groupIndex} (${g.name})`
                    : `Group ${groupIndex}`;

                table += tr(td([title, `${g.start}-${g.end}`, g.match]));
                groupIndex++;
            }
        }
        matchIndex++;
    });

    table += '</table>';

    $(parent).empty().html($(table));
    wireThClick();
}

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

function setTooltips() {
    const browserLang = navigator.language.substring(0, 2);
    const lang = browserLang in Tooltips
        ? browserLang
        : 'en';

    const strings = Tooltips[lang];

    for (const el in strings) {
        if (strings[el] !== null) {
            $(el).prop('title', strings[el]);
        }
    }
}

function wireUpThemeDetection() {
    const observer = new MutationObserver(mutations => {
        mutations.forEach(m => {
            if (m.attributeName === "class") {
                applyVscodeThemeCss();
            }
        });
    });

    observer.observe($('body').get(0), {
        attributes: true
    });
}

$(document).ready(() => {

    wireUpThemeDetection();

    $(".lined").linedtextarea();

    $('#regex').bind('input propertychange', onRegexChange);
    $('#search').bind('input propertychange', onSearchChange);
    $('#replacement').bind('input propertychange', onReplacementChange);

    $('.mode-btn').click(updateModeButtons);
    $('.switch').click(onSwitchClick);

    $('.folder').click(() => { vscode.postMessage({ command: "loadsearchtext" }); });

    setTooltips();

    window.addEventListener('message', e => {
        const message = e.data;
        switch (message.command) {
            case 'setState':
                setUiState(message.state);
                break;
            case 'results':
                processResults(message);
                break;
        }
    });

    vscode.postMessage({ command: "ready" });

});