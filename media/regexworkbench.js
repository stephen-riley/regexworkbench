const displayMap = {
    'match-btn': ['mode', 'regex', 'search', 'results'],
    'matchall-btn': ['mode', 'regex', 'search', 'results'],
    'split-btn': ['mode', 'regex', 'search', 'splitresults'],
    'replace-btn': ['mode', 'regex', 'replacement', 'search', 'replaced', 'results'],
    'replaceall-btn': ['mode', 'regex', 'replacement', 'search', 'replaced', 'results'],
};

const updateModeButtons = (el) => {
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

const execute = () => {
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
};

const match = () => {
    const regex = new RegExp($('#regex').val(), getSwitches());
    const search = $('#search').val();

    const results = regex.exec(search);
    const resultsJson = results != null ? JSON.stringify(processResults(results), null, "  ") : "(no match)";
    $('#results').val(resultsJson);
};

const matchAll = () => {
    const regex = new RegExp($('#regex').val(), "g" + getSwitches());
    const search = $('#search').val();

    let results = [];
    let iteration;
    while ((iteration = regex.exec(search)) != null) {
        results.push(processResults(iteration));
    }

    const resultsJson = results != null ? JSON.stringify(processResults(results), null, "  ") : "(no matches)";
    $('#results').val(resultsJson);
};

const split = () => {
    const regex = new RegExp($('#regex').val(), "g" + getSwitches());
    const search = $('#search').val();

    const results = search.split(regex).map(s => s.replace("\n", "\\n"));
    const resultsString = results.join("\n");
    $('#splitresults').val(resultsString);
};

const replace = () => {
    match();
    const regex = new RegExp($('#regex').val(), getSwitches());
    const search = $('#search').val();
    const replacement = $('#replacement').val();

    $('#replaced').val(search.replace(regex, replacement));
};

const replaceAll = () => {
    matchAll();
    const regex = new RegExp($('#regex').val(), "g" + getSwitches());
    const search = $('#search').val();
    const replacement = $('#replacement').val();

    $('#replaced').val(search.replace(regex, replacement));
};

const processResults = (r) => {
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

const getSwitches = () => {
    const switches = $('.switch.selected').get().reduce((p, el) => p + el.id.replace("-switch", ""), "");
    return switches;
};

let regexTimeoutHandle;

const onRegexChange = (_) => {
    if (regexTimeoutHandle) {
        clearTimeout(regexTimeoutHandle);
        regexTimeoutHandle = undefined;
    }

    regexTimeoutHandle = setTimeout(execute, 300);
};

let searchTimeoutHandle;

const onSearchChange = (_) => {
    if (searchTimeoutHandle) {
        clearTimeout(searchTimeoutHandle);
        searchTimeoutHandle = undefined;
    }

    searchTimeoutHandle = setTimeout(execute, 300);
};

const onSwitchClick = (e) => {
    const el = $(e.target);

    if (el.attr('class').split(/\s+/).includes('selected')) {
        el.removeClass('selected');
    } else {
        el.addClass('selected');
    }
    execute();
};

$(document).ready(() => {
    $('#regex').bind('input propertychange', onRegexChange);
    $('#search').bind('input propertychange', onSearchChange);
    $('.mode-btn').click(updateModeButtons);
    $('.switch').click(onSwitchClick);

    $('#match-btn').click();
    //    $('#regex').val(`(?<file>.+?):(?<line>\\d+):(?<code>.*)`);
    $('#regex').val(`:`);
    $('#replacement').val(`file:$<file>, line: $2, code: "$<code>"`);
    $('#search').val(
        `foo.pl:25:use strict;
bar.pm:42:sub bar { # womba womba womba
spam.py:234:seuss = ['green', 'eggs', 'ham']`
    );
});