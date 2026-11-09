/* Is this page being served by the phone relay?

   This file says no. The relay (tools/buzzer-relay.js) answers the same path with
   `true` instead, so a page served by the relay knows phones can work there, and a
   page opened from GitHub Pages or from disk knows they cannot — without any page
   naming a host. It is the relay declaring itself, not the page guessing.

   Read once, before the settings register: it is what the Phone buzzers default
   reads, so a visitor's first load on the relay starts with phones on and the join
   code showing, with nothing to switch. Load it before hub-app-settings.js. */
window.HubRelayHere = false;
