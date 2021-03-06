/* global browser btoa transientPasswordStore */

"use strict";

function getActiveTab() {
  return browser.tabs.query(
    {active: true, currentWindow: true}, resolve).then(tabs => tabs[0]);
}

const generateRandomPassword = (function(){
  // Character replacements for "safe" Base64 without padding.
  // In a perfect and/or sane world, there'd be no reason to do this,
  // but in the actual world we live in, this is the easiest way to
  // sidestep potential password character set restrictions without
  // reducing entropy, short of going full-on Base62 and making the
  // generated password alphanumeric-only.
  const burlsrep = new Map([

    // Replacing plusses with dots avoids potential blacklisting
    // of "+" or "--" in passwords by sites with a fear-based, cargo-cult
    // understanding of how to prevent SQL injection.
    ['+', '.'],

    // Replacing slashes with underscores avoids potential blacklisting
    // of "//" in passwords by sites with a fear-based, cargo-cult
    // understanding of how to prevent cross-site scripting.
    ['/', '_'],

    // Stripping padding lets us fit more bytes into non-divisble-by-4 lengths.
    ['=','']
  ]);

  // Generate a random password of the given character length (14, by default)
  return function generateRandomPassword(length) {

    // Calculate how many octets of entropy we can fit into the chosen length.
    // Default to 80 bits of entropy, which should be enough,
    // per https://security.stackexchange.com/a/115397/35349
    const byteCount = length ? Math.ceil(length * 4/3) : 10;

    // Return random bits, Base64 encoded.
    return btoa(
      // Credit https://stackoverflow.com/q/12710001 for the idea to use
      // String.fromCharCode.apply for converting the bytes to a string
      String.fromCharCode.apply(null,
        window.crypto.getRandomValues(new Uint8Array(byteCount))
      )).replace(/[+\/=]/g, c => burlsrep.get(c));
  };
})();

function generatePasswordForName(name, respond) {
  transientPasswordStore.set(name, {
    password: generateRandomPassword(),
    // TODO: Make default expiry configurable
    expiry: Date.now() + 3e5
  });
  return respond(transientPasswordStore.getStatus());
}

function getPasswordStatus(respond) {
  return respond(transientPasswordStore.getStatus());
}

function forgetPasswordForName(name) {
  transientPasswordStore.delete(name);
}

function setPasswordExpiryForName(name, expiry) {
  transientPasswordStore.setExpiry(name, expiry);
}

// deserialize any cookied passwords
transientPasswordStore.init();

browser.runtime.onMessage.addListener((message, sender, respond) => {
  switch (message.method) {
    case 'getPasswordStatus':
      return getPasswordStatus(respond);
    case 'generatePassword':
      return generatePasswordForName(message.name, respond);
    case 'forgetPassword':
      return forgetPasswordForName(message.name);
    case 'setPasswordExpiry':
      return setPasswordExpiryForName(message.name, message.expiry);
  }
});

// TODO: Handle incoming port connections for ongoing status updates
