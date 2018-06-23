var tabs = Array();
var tabTimes = new Array();

function setTabTime(tab) {
    var now = new Date();
    tabTimes[tab.id] = now;
    console.log('tab ' + tab.id + ', title ' + tab.title + ', last active time set to: ' + now);
}

function setTabsTime() {
    chrome.tabs.query({}, function(tabs){ tabs.map(setTabTime); });
}

function init() {
    setTabsTime();
}

function onCreateTab(tab) {
    setTabTime(tab);
//    tabs.push(tab);
//    console.log("all tabs: " + tabs);
}

function onActivateTab(activeInfo) {
    chrome.tabs.get(activeInfo.tabId, setTabTime);
    findTabsOlderThanMinutes(1);
}

function addPinboardIn(url) {
    var restEndpoint = 'https://api.pinboard.in/v1/posts/add'
}

function findTabsOlderThanMinutes(minutes) {
    var cutoffTime = new Date();
    cutoffTime.setMinutes(cutoffTime.getMinutes() - minutes);

    for (var tabid in tabTimes) {
        tabid = parseInt(tabid);
        var tabLastActiveTime = tabTimes[tabid];
        if (tabLastActiveTime < cutoffTime) {
            chrome.tabs.get(tabid, function(tab) {
                //console.log(tab.id + ", title " + tab.title + ", last active time of " + tabLastActiveTime + " is older than cutoffTime of " + cutoffTime);
                console.log(tab.url + ' is inactive, time to park it');

            });
        }
        
    }
}

window.addEventListener("load", init);
chrome.tabs.onCreated.addListener(onCreateTab);
chrome.tabs.onActivated.addListener(onActivateTab);
// chrome.windows.onFocusChanged.addListener(setTabTime);
chrome.tabs.onDetached.addListener(setTabTime);
chrome.tabs.onAttached.addListener(setTabTime);
