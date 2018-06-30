var options;

function save_options() {
    for (option in options) {
        options[option] = document.getElementById(option).value;
    }

    chrome.storage.sync.set(options, function() {
        if (chrome.runtime.lastError) {
            console.info('unable to set!');
            return;
        } else {
            var status = document.getElementById('status');
            status.textContent = 'Options saved.';
            setTimeout(function(){ status.textContent = ''; }, 2000);
        }
    });
}

function restore_options() {
    chrome.runtime.getBackgroundPage(function(background) {
        options = background.options;

        for (option in options) {
            document.getElementById(option).value = options[option];
        }
    });
}

document.addEventListener('DOMContentLoaded', restore_options);
document.getElementById('save').addEventListener('click', save_options);
