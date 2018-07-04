var debugMode = true;

/* tabTimes is the work horse of this extension. tabs are stored as an
 * associative array, tabid: tabtime.
 */
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
    if (chrome.runtime.lastError) {
        log('error occurred when trying setTabTime()');
        return;
    }

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
    if (activeInfo !== undefined) {
        chrome.tabs.get(activeInfo.tabId, setTabTime);
    }
}

function addOrUpdatePinboardIn(authtoken, url, title, callback) {
    var getUrl = 'https://api.pinboard.in/v1/posts/get?';
    var u = new URLSearchParams();
    u.append('auth_token', authtoken);
    u.append('url', url);
    fetch(getUrl + u)
        .then(response => log("get returned: " + response.text()));
}

function addPinboardIn(authtoken, url, title, callback) {
    var addUrl = 'https://api.pinboard.in/v1/posts/add?';
    var u = new URLSearchParams();
    u.append('description', title);
    u.append('tags', 'autopark');
    u.append('toread', 'yes');
    u.append('replace', 'no');
    u.append('auth_token', authtoken);
    u.append('url', url);

    fetch(addUrl + u)
        .then(log('added to pinboard.in: ' + url))
        .then(callback());
}

function addTabToBookmarkFolder(tab, foldername) {
    chrome.bookmarks.search(foldername, function(results){
        if (chrome.runtime.lastError) {
            log('caught an error while trying to add bookmark');
        } else {
            var folder = results[0];
            chrome.bookmarks.create({parentId: folder.id, title: tab.title, url: tab.url});
        }
    });
}

function onIgnoreList(url) {
    var re_list = options.ignoreurls.split('\n').filter(x => x !== '').map(x => new RegExp(x));
    matches = re_list.filter(x => url.match(x));
    return matches.length > 0;
}

function openPinboardTab(authtoken) {
    // get username from authtoken
    var username = authtoken.substr(0, authtoken.indexOf(':'));
    var url = 'https://pinboard.in/u:' + username + 't:autopark/unread';
    // refresh tab if active else open a new one
    chrome.tabs.query({url: url}, function(results) {
        if (chrome.runtime.lastError) {
            log('creating a new pinboard tab');
            chrome.tabs.create({url: url});
        } else {
            log('refreshing existing tab');
            results.map(x => chrome.tabs.reload(x.id));
        }
    });
}

function onOldTab(tabid, tab) {
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
    // define handler here since jshint doesn't like function declaration
    // inside a loop
    var tab_handler = function(tabid) {
        chrome.tabs.get(tabid, function(tab){
            if (chrome.runtime.lastError) {
                delete tabTimes[tabid];
            } else {
                onOldTab(tabid, tab);
            }
        });
    };

    var cutoffTime = new Date();
    cutoffTime.setMinutes(cutoffTime.getMinutes() - minutes);

    var numParked = 0;
    for (var tabid in tabTimes) {
        tabid = parseInt(tabid);
        var tabLastActiveTime = tabTimes[tabid];
        if (tabLastActiveTime < cutoffTime) {
            tab_handler(tabid);
            numParked++;
        }
    }

    if (numParked > 0) {
        log("parked " + numParked);
        openPinboardTab(options.authtoken);
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
