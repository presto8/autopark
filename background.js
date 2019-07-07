/* TODO: Rewrite to use Date.now() native data objects instead of ms
 * 
 */
var debugMode = true;

/* tabTimes is the work horse of this extension. tabs are stored using this
 * object like an associative array, tabid: tabtime. Times stored in Unix epoch
 * milliseconds (which is what JavaScript getTime() returns).
 */
var tabTimes = {};
var lastCheck = getNowMs();

var options = {
    parktime: 90,
    authtoken: '',
    tag: 'autopark',
    bookmarkfolder: 'autopark',

    // ignoreurls has to be a single string; when it is parsed later, it will
    // be converted to a list
    ignoreurls: ['chrome://',
                 'google.com/mail'
                ].join('\n')
};

function log(mesg) {
    if (debugMode) {
        console.log(mesg);
    }
}

function getNowMs() {
    return new Date().getTime();
}

function setTabTime(tab) {
    if (chrome.runtime.lastError) {
        log('error occurred when trying setTabTime()');
        return;
    }

    if (tab.url === undefined || onIgnoreList(tab.url)) {
        return;
    }

    tabTimes[tab.id] = getNowMs();
}

function periodic() {
    parkTabsOlderThanMinutes(options.parktime)
        .then(function(numParked) {
            if (numParked > 0) {
                log("parked " + numParked + " tab(s)");
                openPinboardTab(options.authtoken);
            }
            // runPeriodic();
        });
}

function onCreateTab(tab) {
    setTabTime(tab);
}

function onRemoveTab(tabId, removeInfo) {
    log('tab ' + tabId + ' closed by user');
    delete tabTimes[tabId];
}

function onActivateTab(activeInfo) {
    if (activeInfo !== undefined) {
        var tabId = activeInfo.tabId;
        log("tab " + tabId + " activated");
        chrome.tabs.get(tabId, setTabTime);
    }
}

function createOrGetPinboardEntry(authtoken, url, title, callback) {
    // retrieves existing entry or creates new one, returns parameter list to use for adding
    var newEntry = {
        'url': url,
        'description': title,  // "description" is the title on pinboard, "extended" is the description
        'tags': 'autopark',
        'toread': 'yes',
        'auth_token': authtoken
    };

    var getUrl = 'https://api.pinboard.in/v1/posts/get?';
    var u = new URLSearchParams({auth_token: authtoken,
                                 url: url,
                                 format: 'json'});
    fetch(getUrl + u)
        .then(resp => resp.text())
        .then(text => JSON.parse(text))
        .then(function(json) {
            if (json.posts.length > 0) {
                if (json.posts.length != 1) {
                    log("warning, multiple posts returned, only updating first");
                }

                var old = json.posts[0];
                log("updating existing entry");
                log(old);

                newEntry.description = old.description;
                newEntry.extended = old.extended;
                newEntry.tags = old.tags + " autopark";
                newEntry.toread = old.toread;
                newEntry.dt = new Date().toISOString();  // update timestamp to now to bring to top of list
            }
        });

    return newEntry;
}

function addPinboardIn(authtoken, newEntry, callback) {
    var addUrl = 'https://api.pinboard.in/v1/posts/add?';
    var u = new URLSearchParams(newEntry);
    fetch(addUrl + u)
        .then(callback());
}

function addTabToBookmarkFolder(tab, foldername) {
    chrome.bookmarks.search(foldername, function(results){
        if (chrome.runtime.lastError) {
            log('caught an error while trying to add bookmark');
            log(chrome.runtime.lastError);
        } else {
            var folder = results[0];
            chrome.bookmarks.create({parentId: folder.id, title: tab.title, url: tab.url},
                function() {
                    if (chrome.runtime.lastError) {
                        log("error occurred while trying to add bookmark, already exists maybe?");
                    }
                });
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
            log('refreshing existing pinboard autopark:toread tab');
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
        delete tabTimes[tabid];
        return;
    }

    // addTabToBookmarkFolder(tab, options.bookmarkfolder);

    var authtoken = options.authtoken;
    if (authtoken.length === 0) {
        log('not saving pinboard.in because authtoken not set in options');
        return;
    }

    var newEntry = createOrGetPinboardEntry(authtoken, tab.url, tab.title);
    addPinboardIn(authtoken, newEntry, function() {
        log('added to pinboard.in: ' + tab.url);
        chrome.tabs.remove(tab.id);
        delete tabTimes[tabid];
    });
}

function parkTabsOlderThanMinutes(minutes) {
    return new Promise(function(resolve, reject) {
        // define handler here since jshint doesn't like function declaration
        // inside a loop
        var tab_handler = function(tabid) {
            log("tab_handler for " + tabid);
            chrome.tabs.get(tabid, function(tab){
                if (chrome.runtime.lastError) {
                    delete tabTimes[tabid];
                } else {
                    onOldTab(tabid, tab);
                }
            });
        };

        var cutoffTime = getNowMs() - minutes * options.parktime * 1000;
        log("cutoffTime is " + cutoffTime + ", " + Object.keys(tabTimes).length + " entries in tabTimes");

        var numParked = 0;
        for (var tabid in tabTimes) {
            tabid = parseInt(tabid);
            if (tabTimes[tabid] < cutoffTime) {
                tab_handler(tabid);
                numParked++;
            }
        }

        resolve(numParked);
    });
}

function postRestore() {
    // Initialize current time for all existing tabs
    //chrome.tabs.query({}, function(tabs){ tabs.map(setTabTime); });
    chrome.tabs.query({}, tabs => tabs.map(setTabTime));

    // Register callback to listen for new tabs created from now on
    chrome.tabs.onCreated.addListener(onCreateTab);

    // Remove tabs when they are closed
    chrome.tabs.onRemoved.addListener(onRemoveTab);

    // Update a tab's time whenever it's activated
    chrome.tabs.onActivated.addListener(onActivateTab);

    // Update a tab's time whenever it's moved, detached, or attached to a window
    chrome.tabs.onDetached.addListener(setTabTime);
    chrome.tabs.onAttached.addListener(setTabTime);
    chrome.tabs.onMoved.addListener(setTabTime);

    // Remove tab whenever it's closed
    chrome.tabs.onRemoved.addListener(x => delete tabTimes[x.id]);

    // chrome.windows.onFocusChanged.addListener(setTabTime);

    // Create an alarm to run our periodic task. Don't use setTimeout because
    // Chrome will automatically suspend tabs after some inactivity which will
    // cause the timeout to stop working.
    // chrome.alarms.create("Alarm", {delayInMinutes: 1, periodInMinutes: 1});
    chrome.alarms.create({periodInMinutes: 1});
    chrome.alarms.onAlarm.addListener(function(alarm) {
        console.log("Got an alarm!", alarm);
        periodic();
    });
}

function restoreOptions() {
    chrome.storage.sync.get(options, function(items) {
        for (var item in items) {
            options[item] = items[item];
        }

        // Do all init in a post-restore function; otherwise, the options may not
        // have been loaded before the methods are called.
        postRestore();
    });
}

function init() {
    restoreOptions();
}

window.addEventListener('load', init);
