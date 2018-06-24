var tabTimes = new Array();

function setTabTime(tab) {
    if (tab.url == null || onWhitelist(tab.url)) {
        return;
    }

    var now = new Date();
    tabTimes[tab.id] = now;
}

function init() {
    // Initialize current time for all existing tabs
    chrome.tabs.query({}, function(tabs){ tabs.map(setTabTime); });

    // Register callback to listen for new tabs created from now on
    chrome.tabs.onCreated.addListener(onCreateTab);

    // Update a tab's time whenever it's activated
    chrome.tabs.onActivated.addListener(onActivateTab);
}

function onCreateTab(tab) {
    setTabTime(tab);
}

function onActivateTab(activeInfo) {
    chrome.tabs.get(activeInfo.tabId, setTabTime);
    findTabsOlderThanMinutes(120);
}

function addPinboardIn(url, title, callback=null) {
    var restEndpoint = 'https://api.pinboard.in/v1/posts/add?';
    var addUrl = restEndpoint + 'url=' + encodeURIComponent(url) +
        '&description=' + encodeURIComponent(title) + 
        '&tags=autopark' + 
        '&toread=yes' +
        '&replace=no' +  // todo: retrieve existing entry and add autopark tag
        '&auth_token=presto8:0F2AFD30038CD0C39E4E';

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

function onOldTab(tabid, tab) {
    if (chrome.runtime.lastError) {
        console.info("removing tab that no longer exists: ", tabid);
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

window.addEventListener("load", init);
// chrome.windows.onFocusChanged.addListener(setTabTime);
chrome.tabs.onDetached.addListener(setTabTime);
chrome.tabs.onAttached.addListener(setTabTime);
