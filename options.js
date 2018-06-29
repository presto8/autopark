// Saves options to chrome.storage
var options = {
    parktime: 90,
    authtoken: '',
    tag: 'autopark',
    bookmarkfolder: 'autopark',
    ignoreurls: '',
};

function save_options() {
    for (option in options) {
        options[option] = document.getElementById(option).value;
    }

    chrome.storage.sync.set(options, function() {
        if (chrome.runtime.lastError) {
            console.info("unable to set!")
            return;
        }
    });
}

function restore_option(option, value) {
    document.getElementById(option).value = value;
    options[option] = value;
}

function restore_options() {
    chrome.storage.sync.get(options, function(items) {
        for (item in items) {
            restore_option(item, items[item]);
        }
    });
}

document.addEventListener('DOMContentLoaded', restore_options);
document.getElementById('save').addEventListener('click', save_options);
