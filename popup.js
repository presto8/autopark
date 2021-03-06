function handleErrors(response) {
    if (!response.ok) {
        throw Error(response.statusText);
    }
    return response;
}

function getRecentPinboard(authtoken) {
    var url = `https://api.pinboard.in/v1/posts/recent?auth_token=${authtoken}&format=json&tag=autopark`;
    fetch(url)
        .then(handleErrors)
        .then(resp => resp.text())
        .then(text => JSON.parse(text))
        .then(function(json) {
            for (var i in json.posts) {
                 createEntry(json.posts[i]);
            }
        });
}

function createEntry(post) {
    var ul = document.getElementById('list');
    var li = document.createElement("LI");
    var text = document.createTextNode(post.description);
    li.appendChild(text);
    li.onclick = function() {
        openPage(post.href);
    };
    li.appendChild(text);
    ul.appendChild(li);
}

function openPage(url) {
    chrome.tabs.create({url: url});
}

window.onload = function() {
    chrome.runtime.getBackgroundPage(function(background) {
        getRecentPinboard(background.options.authtoken);
    });
};
