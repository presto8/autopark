window.onload = function() {
    chrome.runtime.getBackgroundPage(function(background) {
        //var history = document.getElementById('list');
        // history.innerHTML = background.parkedHistory.map(x => `<li>${x.title}</li>`).toString();
        getRecentPinboard(background.options.authtoken);
    });
};


function getRecentPinboard(authtoken) {
    var url = `https://api.pinboard.in/v1/posts/recent?auth_token=${authtoken}&format=json`;
    fetch(url)
        .then(resp => resp.text())
        .then(text => JSON.parse(text))
        .then(function(json) {
            // for (var i in json.posts) {
            //     createEntry(i);
            // }

            posts = json.posts.map(x => `<li>${x.description}</li>`);
            document.getElementById('list').innerHTML = posts.join(" ");
        });
}

function createEntry(post) {
    var ul = document.getElementById('list');
    var node = document.createElement("LI");
    var textnode = document.createTextNode(post.href);
    node.appendChild(textnode);
    ul.appendChild(node);
}

function openPage(url) {
    chrome.tabs.create({url: url});
}
