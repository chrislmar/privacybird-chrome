// JavaScript for popup*.html

function openOptions() {
    chrome.tabs.create({url: "options.html"});
}

function refreshSite() {
    chrome.extension.sendRequest({arg: "refresh"});
    window.close();
}

function exitPopup() {
    window.close();
}

function newTab(url) {
    chrome.tabs.create({url: url});
}

function info() {
    chrome.tabs.create({url: "http://www.privacybird.org/help/help-privacypreferencesettings.html"});
}

