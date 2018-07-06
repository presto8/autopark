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

function setTabTime(tab) {
    if (chrome.runtime.lastError) {
        log('error occurred when trying setTabTime()');
        return;
    }

    if (tab.url === undefined || onIgnoreList(tab.url)) {
        return;
    }

    var now = new Date();
    tabTimes[tab.id] = now;
}

function periodic() {
    parkTabsOlderThanMinutes(options.parktime)
        .then(function(numParked) {
            if (numParked > 0) {
                log("parked " + numParked + " tab(s)");
                openPinboardTab(options.authtoken);
            }
        });
}

function onCreateTab(tab) {
    setTabTime(tab);
}

function onActivateTab(activeInfo) {
    if (activeInfo !== undefined) {
        chrome.tabs.get(activeInfo.tabId, setTabTime);
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
        return;
    }

    addTabToBookmarkFolder(tab, options.bookmarkfolder);

    var authtoken = options.authtoken;
    if (authtoken.length === 0) {
        log('not saving pinboard.in because authtoken not set in options');
        return;
    }

    var newEntry = createOrGetPinboardEntry(authtoken, tab.url, tab.title);
    addPinboardIn(authtoken, newEntry, function() {
        log('added to pinboard.in: ' + newEntry);
        chrome.tabs.remove(tab.id);
        delete tabTimes[tabid];
    });
}

function parkTabsOlderThanMinutes(minutes) {
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
    
    return new Promise(function(resolve, reject) {
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

        resolve(numParked);
    });
}

function postRestore() {
    // Initialize current time for all existing tabs
    //chrome.tabs.query({}, function(tabs){ tabs.map(setTabTime); });
    chrome.tabs.query({}, tabs => tabs.map(setTabTime));

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
