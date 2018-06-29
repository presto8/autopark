var tabTimes = new Array();

var options = {
    parktime: 90,
    authtoken: '',
    tag: 'autopark',
    bookmarkfolder: 'autopark'
};

function setTabTime(tab) {
    if (tab.url == null || onWhitelist(tab.url)) {
        return;
    }

    var now = new Date();
    tabTimes[tab.id] = now;
}

function periodic() {
    console.info("running periodic");
    findTabsOlderThanMinutes(60);
}

function onCreateTab(tab) {
    setTabTime(tab);
}

function onActivateTab(activeInfo) {
    chrome.tabs.get(activeInfo.tabId, setTabTime);
}

function addPinboardIn(url, title, callback=null) {
    var restEndpoint = 'https://api.pinboard.in/v1/posts/add?';
    var addUrl = restEndpoint + 'url=' + encodeURIComponent(url) +
        '&description=' + encodeURIComponent(title) + 
        '&tags=autopark' + 
        '&toread=yes' +
        '&replace=no' +  // todo: retrieve existing entry and add autopark tag
        '&auth_token=' + options.authtoken; //presto8:0F2AFD30038CD0C39E4E';

    var req = new XMLHttpRequest();
    req.open('GET', addUrl);
    req.onload = function() {
        console.info('added to pinboard.in! ' + url);
        if (callback != null) {
            callback();
        }
    };
    req.send()
}

function addTabToBookmarkFolder(tab) {
    chrome.bookmarks.search('Parked', function(results){
        var folder = results[0];
        chrome.bookmarks.create({parentId: folder.id, title: tab.title, url: tab.url});
    });
}

function onWhitelist(url) {
    whitelist = ['google.com/mail',
                 'chrome://',
                 'pinboard.in/',
                ];
    matches = whitelist.filter(x => url.indexOf(x) > -1);
    return matches.length > 0;
}

function openPinboardTab() {
    var url = 'https://pinboard.in/u:presto8/t:autopark';
    // refresh tab if active else open a new one
    chrome.tabs.query({url: url}, function(result) {
        if (chrome.runtime.lastError) {
            console.info("creating a new pinboard windows");
            chrome.tabs.create({url: 'https://pinboard.in/u:presto8/t:autopark'});
        } else {
            console.info("refreshing existing windows");
            results.map(x => chrome.tabs.reload(x.id));
        }
    });
}

function onOldTab(tabid, tab) {
    if (chrome.runtime.lastError) {
        delete tabTimes[tabid];
        return;
    }

    if (tab.url == null) {
        console.info("removing tab that doesn't have a url: ", tabid);
        delete tabTimes[tabid];
        return;
    }

    if (onWhitelist(tab.url)) {
        return;
    }

    console.info(tab.url + ' is inactive, time to park it');
    addPinboardIn(tab.url, tab.title, function() { 
        chrome.tabs.remove(tab.id);
        delete tabTimes[tabid];
    });

    openPinboardTab();

    addTabToBookmarkFolder(tab);
}

function findTabsOlderThanMinutes(minutes) {
    var cutoffTime = new Date();
    cutoffTime.setMinutes(cutoffTime.getMinutes() - minutes);

    for (var tabid in tabTimes) {
        tabid = parseInt(tabid);
        var tabLastActiveTime = tabTimes[tabid];
        if (tabLastActiveTime < cutoffTime) {
            chrome.tabs.get(tabid, function(tab){ onOldTab(tabid, tab); });
        }
    }
}

function restoreOptions() {
    chrome.storage.sync.get(options, function(items) {
        for (item in items) {
            options[item] = items[item];
        }
        console.log(options);
    });
}

function init() {
    restoreOptions();

    // Initialize current time for all existing tabs
    chrome.tabs.query({}, function(tabs){ tabs.map(setTabTime); });

    // Register callback to listen for new tabs created from now on
    chrome.tabs.onCreated.addListener(onCreateTab);

    // Update a tab's time whenever it's activated
    chrome.tabs.onActivated.addListener(onActivateTab);

    // Update a tab's time whenever it's moved, detached, or attached to a window
    chrome.tabs.onDetached.addListener(setTabTime);
    chrome.tabs.onAttached.addListener(setTabTime);
    chrome.tabs.onMoved.addListener(setTabTime);

    // Remove tab whenever it's closed
    chrome.tabs.onRemoved.addListener(x => delete tabTimes[x.id]);

    // Run periodic scheduler every minute
    setInterval(periodic, 30 * 1000);

    // chrome.windows.onFocusChanged.addListener(setTabTime);
}

window.addEventListener("load", init);
