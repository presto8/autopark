var tabTimes = new Array();

function setTabTime(tab) {
    tabTimes[tab.id] = Date.now();
    console.log('Set time for tab to now: ' + tab.id);
}

function setTabsTime() {
    chrome.tabs.query({}, function(tabs){ tabs.map(setTabTime); });
}

function init() {
    setTabsTime();
}

function onCreateTab(tab) {
    setTabTime(tab);
}

function onActivateTab(activeInfo) {
    chrome.tabs.get(activeInfo.tabId, setTabTime);
}

window.addEventListener("load", init);
chrome.tabs.onCreated.addListener(onCreateTab);
chrome.tabs.onActivated.addListener(onActivateTab);
// chrome.windows.onFocusChanged.addListener(setTabTime);
chrome.tabs.onDetached.addListener(setTabTime);
chrome.tabs.onAttached.addListener(setTabTime);
