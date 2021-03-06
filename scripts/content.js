/* global browser */

"use strict";

function setAllPasswordInputsTo(password){
  for (let input of document.querySelectorAll('input[type=password]')) {
    input.value = password;
  }
}

browser.runtime.onMessage.addListener((message, sender, respond) => {
  switch (message.method) {
    case 'setPassword':
      return setAllPasswordInputsTo(message.password);
  }
});
