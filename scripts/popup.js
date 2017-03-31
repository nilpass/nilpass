/* global chrome parseDuration */

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
let countdownInterval = null;

const activeStateControls = document.getElementById('active');
const inactiveStateControls = document.getElementById('inactive');
const countdownElement = document.getElementById('countdown');

function passwordExpiryHack() {
    // This is sort of a hack to shortcut waiting for the status update
    // to come back from the background page (which doesn't happen yet)
    // One way this won't work well is if there's another password that
    // would be fallen back to after this one expires, but that's kind of
    // an edge case for the time being
    activePassword = null;
    updateActivePasswordState();
}

function updateCountdown() {
  const timeleft = activePassword.expiry - Date.now();
  if (timeleft <= 0) {
    passwordExpiryHack();
  } else {
    const minutes = Math.floor(timeleft / 60000);
    let seconds = Math.floor(timeleft / 1000 % 60);
    if (seconds < 10) seconds = '0' + seconds;
    countdownElement.textContent = `${minutes}:${seconds}`;
  }
}

function updateActivePasswordState() {
  inactiveStateControls.hidden =
    !(activeStateControls.hidden = !activePassword);
  if (activePassword) {
    if (!countdownInterval) {
      updateCountdown();
      countdownInterval = setInterval(updateCountdown, 1000);
    }
  } else {
    clearInterval(countdownInterval);
    countdownInterval = null;
  }
}

function updatePasswords() {
  if (passwords.length > 0) {
    // TODO: Default to matching name or something
    activePassword = passwords[0];
  } else {
    activePassword = null;
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
  .then(receiveStatusUpdate);
}

document.getElementById('generate')
  .addEventListener('click', requestPasswordGeneration);

function fillPassword() {
  chrome.tabs.executeScript({code: `
    for (let input of document.querySelectorAll('input[type=password]') {
      input.value = ${JSON.stringify(activePassword.password)};
    }`});
}

document.getElementById('fill')
  .addEventListener('click', fillPassword);

function forgetPassword() {
  chrome.runtime.sendMessage({
    method: 'forgetPassword', name: activePassword.name});
  passwordExpiryHack();
}

document.getElementById('forget')
  .addEventListener('click', forgetPassword);

const ttlInput = document.getElementById('ttl');

function updateTTL() {
  const ttl = parseDuration(ttlInput.value);
  if (ttl) {
    const expiry = Date.now() + ttl;
    // Minor hack: this should be changed by a status update from the
    // background page, not the caller
    activePassword.expiry = expiry;
    chrome.runtime.sendMessage({
      method: 'setPasswordExpiry',
        name: activePassword.name, expiry});
  } else {
    // If they want it to expire now, they should click "Forget password"
    // TODO: Some kind of error
    // TODO: teach parseDuration to differentiate between 0 and unparsable
    //       (or just switch to https://github.com/zeit/ms)
  }
}

document.getElementById('expiryform')
  .addEventListener('submit', updateTTL);
