"use strict";

window.transientPasswordStore = (function(){
  // Passwords we're currently holding
  const passwords = new Map();

  // the timeout ID for the next password expiry
  let nextChangeTimeout = null;

  function serializableStatusData() {
    return {
      passwords: passwords.entries().map(
        ([name, {password, expiry}]) => ({name, password, expiry})),
    };
  }

  function processExpiries() {
    let nextExpiry = null;
    let expiryCount = 0;

    // In case we're running outside of the context of a timeout callback
    // for some reason (ie. repeating deserialization somehow?)
    clearTimeout(nextChangeTimeout);
    if (expiryCount > 0) {
      updatePasswordStatus();
    }
    if (nextExpiry) {
      nextChangeTimeout =
        setTimeout(processExpiries, nextExpiry - Date.now());
    }
  }

  // For momentarily persisting passwords through an extension update.
  // We use session cookies because they're the only kind of storage
  // that persists beyond a page's lifetime (ie. through extension updates),
  // while still being transient within the browser's lifetime.
  // See http://crbug.com/42599
  function serializePasswordsToCookie() {
    document.cookie = 'serializedState=' +
      encodeURIComponent(JSON.stringify(serializableStatusData())) + ';';
  }

  function readCookie(name) {
  	const nameEQ = name + "=";
  	const ca = document.cookie.split(';');
  	for (let i = 0; i < ca.length; i++) {
  		const c = ca[i].trim();
  		if (c.indexOf(nameEQ) == 0) return c.substring(nameEQ.length,c.length);
  	}
  	return null;
  }

  function deserializeFromCookie() {
    let serializedState = readCookie('serializedState');
    if (serializedState) {
      serializedState = JSON.parse(decodeURIComponent(serializedState));
    }
    for (let {name, password, expiry} of serializedState.passwords) {
      passwords.set(name, {password, expiry});
    }
    processExpiries();
  }

  function initTransientPasswordStore() {
    deserializeFromCookie();
  }

  function updatePasswordStatus() {
    serializePasswordsToCookie();
    // TODO: update any subscribers
  }

  return {
    init: initTransientPasswordStore,
    getStatus: serializableStatusData
    // TODO: "watch" or "listen" function so the background page can hook up
    //       and propagate changes to subscribed popups or whatever
  };
})();
