// Saves options to chrome.storage
var fields = ['parktime', 'authtoken', 'tag', 'bookmarkfolder'];

function save_options() {
    var options = Array();
    fields.forEach(x => options[x] = document.getElementById(x).value);
    console.log(options);

    chrome.storage.sync.set({options: options}, function() {
        // Update status to let user know options were saved.
        var status = document.getElementById('status');
        status.textContent = 'Options saved.';
        setTimeout(function() {
            status.textContent = '';
        }, 750);
    });
}

// Restores select box and checkbox state using the preferences
// stored in chrome.storage.
function restore_options() {
    // Use default value color = 'red' and likesColor = true.
    chrome.storage.sync.get({
        favoriteColor: 'red',
        likesColor: true
    }, function(items) {
        document.getElementById('color').value = items.favoriteColor;
        document.getElementById('like').checked = items.likesColor;
    });
}

document.addEventListener('DOMContentLoaded', restore_options);
document.getElementById('save').addEventListener('click', save_options);
