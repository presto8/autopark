var debugMode = true;
var tabTimes = [];
var options = {
    parktime: 90,
    authtoken: '',
    tag: 'autopark',
    bookmarkfolder: 'autopark',
    ignoreurls: ['chrome://',
                 'google.com/mail'
                ].join('\n')
};

function log(mesg) {
    if (debugMode) {
        console.log(mesg);
    }
}

function setTabTime(tab) {
    if (tab.url === null || onIgnoreList(tab.url)) {
        return;
    }

    var now = new Date();
    tabTimes[tab.id] = now;
}

function periodic() {
    findTabsOlderThanMinutes(options.parktime);
}

function onCreateTab(tab) {
    setTabTime(tab);
}

function onActivateTab(activeInfo) {
    chrome.tabs.get(activeInfo.tabId, setTabTime);
}

function addPinboardIn(authtoken, url, title, callback) {
    var restEndpoint = 'https://api.pinboard.in/v1/posts/add?';
    var addUrl = restEndpoint + 'url=' + encodeURIComponent(url) +
        '&description=' + encodeURIComponent(title) + 
        '&tags=autopark' + 
        '&toread=yes' +
        '&replace=no' +  // todo: retrieve existing entry and add autopark tag
        '&auth_token=' + authtoken;

    var req = new XMLHttpRequest();
    req.open('GET', addUrl);
    req.onload = function() {
        log('added to pinboard.in! ' + url);
        if (callback !== null) {
            callback();
        }
    };
    req.send();
}

function addTabToBookmarkFolder(tab, foldername) {
    chrome.bookmarks.search(foldername, function(results){
        var folder = results[0];
        chrome.bookmarks.create({parentId: folder.id, title: tab.title, url: tab.url});
    });
}

function onIgnoreList(url) {
    var whitelist = options.ignoreurls.split('\n');
    matches = whitelist.filter(x => x !== '' && url.indexOf(x) > -1);
    return matches.length > 0;
}

function openPinboardTab(authtoken) {
    // get username from authtoken
    var username = authtoken.substr(0, authtoken.indexOf(':'));
    var url = 'https://pinboard.in/u:' + username + 't:autopark';
    // refresh tab if active else open a new one
    chrome.tabs.query({url: url}, function(results) {
        if (chrome.runtime.lastError) {
            log('creating a new pinboard windows');
            chrome.tabs.create({url: 'https://pinboard.in/u:presto8/t:autopark'});
        } else {
            log('refreshing existing windows');
            results.map(x => chrome.tabs.reload(x.id));
        }
    });
}

function onOldTab(tabid, tab) {
    if (chrome.runtime.lastError) {
        delete tabTimes[tabid];
        return;
    }

    if (tab.url === null) {
        log('removing tab without an url: ', tabid);
        delete tabTimes[tabid];
        return;
    }

    if (onIgnoreList(tab.url)) {
        log(tab.url + ' is on the ignorelist');
        return;
    }

    addTabToBookmarkFolder(tab, options.bookmarkfolder);

    var authtoken = options.authtoken;
    if (authtoken.length === 0) {
        log('not saving pinboard.in because authtoken not set in options');
        return;
    }

    addPinboardIn(authtoken, tab.url, tab.title, function() {
        chrome.tabs.remove(tab.id);
        delete tabTimes[tabid];
    });

    openPinboardTab(authtoken);
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
        for (var item in items) {
            options[item] = items[item];
        }

        // Initialize current time for all existing tabs
        chrome.tabs.query({}, function(tabs){ tabs.map(setTabTime); });
    });
}

function init() {
    restoreOptions();

//    // Initialize current time for all existing tabs
//    chrome.tabs.query({}, function(tabs){ tabs.map(setTabTime); });

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
    setInterval(periodic, 60 * 1000);

    // chrome.windows.onFocusChanged.addListener(setTabTime);
}

window.addEventListener('load', init);
