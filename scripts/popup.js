/* global chrome */

"use strict";

function lastErrorPromise(cb) {
  return new Promise((resolve, reject) => {
    return cb(value => chrome.runtime.lastError
      ? reject(chrome.runtime.lastError)
      : resolve(value));
  });
}

function getActiveTab() {
  return new lastErrorPromise(resolve =>
    chrome.tabs.query({active: true, currentWindow: true}, resolve)
    ).then(tabs => tabs[0]);
}

function expressionInActiveTab(code) {
  return new lastErrorPromise(resolve =>
    chrome.tabs.executeScript({code}, resolve)).then(([result]) => result);
}

function messageResponsePromise(message) {
  return new lastErrorPromise(resolve =>
    chrome.runtime.sendMessage(message, resolve));
}

const pActiveTab = getActiveTab();

// TODO: subscribe to live out-of-band updates on this
function updatePasswordStatus(statuses) {
  pActiveTab.then(activeTab => {

    // TODO: If there's an active password, set an interval to update the
    //       countdown to expiration

  });
}

// Set the initial password state
messageResponsePromise({method: 'getPasswordStatus'})
  .then(updatePasswordStatus);

chrome.runtime.onMessage.addListener((message, sender, respond) => {
  switch (message.method) {
    // NOTE: this will probably not ever be implemented -
    // status subscriptions will probably use runtime.connect
    case 'statusUpdate':
      return updatePasswordStatus(message.statuses);
  }
});

function requestPasswordGeneration() {

}
