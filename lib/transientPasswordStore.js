"use strict";

window.transientPasswordStore = (function(){
  // Passwords we're currently holding
  const passwords = new Map();

  // the timeout ID for the next password expiry
  let nextChangeTimeout = null;

  function serializableStatusData() {
    return {
      passwords: Array.from(passwords.entries()).map(
        ([name, {password, expiry}]) => ({name, password, expiry})),
    };
  }

  // TODO: Give this a better name to represent how
  //       it's now the core update function
  function processExpiries(changed) {
    let nextExpiry = Infinity;
    let expiryCount = 0;

    for (let [name, {expiry}] of passwords) {
      if (expiry > Date.now()) {
        nextExpiry = Math.min(nextExpiry, expiry);
      } else {
        passwords.delete(name);
        ++expiryCount;
      }
    }

    // In case we're running outside of the context of a timeout callback
    // (ie. resetting expiration)
    clearTimeout(nextChangeTimeout);

    // If there's (still) a pending expiration
    if (nextExpiry < Infinity) {
      // Get ready for it
      nextChangeTimeout =
        setTimeout(processExpiries, nextExpiry - Date.now());
    }

    // If we removed any expired passwords or the caller changed something
    if (expiryCount > 0 || changed) {
      // Re-serialize with expired passwords removed
      updatePasswordStatus();
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
      for (let {name, password, expiry} of serializedState.passwords) {
        passwords.set(name, {password, expiry});
      }
      processExpiries();
    }
  }

  function initTransientPasswordStore() {
    deserializeFromCookie();
  }

  function updatePasswordStatus() {
    serializePasswordsToCookie();
    // TODO: update any subscribers
  }

  function setPasswordForName(name, object) {
    passwords.set(name, object);
    processExpiries(true);
  }

  function deletePasswordForName(name) {
    passwords.delete(name);
    processExpiries(true);
  }

  function setExpiryForName(name, expiry) {
    const object = passwords.get(name);
    object.expiry = expiry;
    processExpiries(true);
  }

  return {
    init: initTransientPasswordStore,
    getStatus: serializableStatusData,
    set: setPasswordForName,
    setExpiry: setExpiryForName,
    delete: deletePasswordForName
    // TODO: "watch" or "listen" function so the background page can hook up
    //       and propagate changes to subscribed popups or whatever
  };
})();
