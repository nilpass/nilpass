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

function messageResponsePromise(message) {
  return new lastErrorPromise(resolve =>
    chrome.runtime.sendMessage(message, resolve));
}

const pActiveTab = getActiveTab();

let passwords = [];
let activePassword = null;

function updateActivePasswordState() {

}

function updatePasswords() {
  if (passwords.length > 0) {
    // TODO: Default to matching name or something
    activePassword = passwords[0];
  }
  updateActivePasswordState();
}

// TODO: subscribe to live out-of-band updates on this
function receiveStatusUpdate(status) {
  passwords = status.passwords;
  updatePasswords();
}

// Set the initial password state
messageResponsePromise({method: 'getPasswordStatus'})
  .then(receiveStatusUpdate);

chrome.runtime.onMessage.addListener((message, sender, respond) => {
  switch (message.method) {
    // NOTE: this will probably not ever be implemented -
    // status subscriptions will probably use runtime.connect
    case 'statusUpdate':
      return receiveStatusUpdate(message.status);
  }
});

function getDomainOfUrl(url) {
  const a = document.createElement('a');
  a.href = url;
  return a.hostname;
}

function requestPasswordGeneration() {
  return pActiveTab.then(activeTab =>
    messageResponsePromise({method: 'generatePassword',
      name: activeTab.url && getDomainOfUrl(activeTab.url) || 'nowhere'}))
  .then(updatePasswords);
}

document.getElementById('generate')
  .addEventListener('click', requestPasswordGeneration);

function fillPassword() {
  chrome.tabs.executeScript({code: `
    for (let input of document.querySelectorAll('input[type=password]') {
      input.value = ${JSON.stringify(activePassword.password)};
    }`});
}

document.getElementById('generate')
  .addEventListener('click', fillPassword);
