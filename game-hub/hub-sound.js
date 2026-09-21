/* ===================== HubSound — the synthesised sound shelf ======================
   Every sound in the app is oscillators and shaped noise, so there is nothing to
   download, nothing to license and it all works offline. This file is the ONE home
   of the voices (the cue riffs) and the small noise instruments (a hit, a swoosh, a
   dock) — the board's `Sound` in hub-engine.js and the phone page both play from
   here, so a cue sounds the same on the projector and in a student's hand.

   Built like Kit.vote (axiom 4): it takes what it needs and owns nothing else.
     HubSound.make({ level, on }) -> synth
       level()  → the peak gain (0..1) at the moment a sound plays — the caller's
                  volume setting, read fresh each time
       on()     → whether to play at all — the caller's mute
     synth.ac()        the page's one AudioContext, made on first use (null if none)
     synth.unlock()    make + resume it — call from a user gesture, since a browser
                       will not start audio without one (iOS in particular)
     synth.play(name)  a named voice (see VOICES)
     synth.hit(s)      a tile-on-tile contact; s is 0..1 how hard (the table's own
                       strength) — a click and a thump, both scaled by it
     synth.knock(s)    a hard clack: a tile knocked out of its slot
     synth.swoosh(s)   a throw — noise through a rising filter, longer when harder
     synth.dock()      a soft wooden tap: a tile arriving home in its slot
     synth.noise(secs, {hp, bp, q, peak, attack, hold, decay})
                       the shaped-noise building block the instruments are made of
     synth.count       how many sounds were asked for (a probe's window — the
                       harness cannot hear, so it counts)
     synth.last        the name of the last one
   No dependencies. Loaded before hub-engine.js in every shell, and by join.html.
   ================================================================================ */
(function(){
  'use strict';

  /* The voices: short note sequences. f is the pitch, d the length in seconds, `to`
     a pitch to glide to over the note, `type` the oscillator's wave (triangle if
     unsaid). Game-show cues are original riffs, not the shows' own music. */
  const VOICES = {
    correct:[{f:660,d:0.09},{f:990,d:0.13}],
    wrong:  [{f:180,d:0.16,type:'sawtooth'},{f:120,d:0.18,type:'sawtooth'}],
    claim:  [{f:523,d:0.07},{f:784,d:0.07},{f:1047,d:0.14}],
    end:    [{f:440,d:0.14},{f:330,d:0.2}],
    clear:  [{f:523,d:0.1},{f:659,d:0.1},{f:784,d:0.1},{f:1047,d:0.28}],
    flip:   [{f:240,to:820,d:0.3,type:'sine'}],
    reveal: [{f:880,d:0.07},{f:1319,d:0.19}],
    lock:   [{f:150,to:60,d:0.22,type:'sine'},{f:70,to:190,d:0.5,type:'sawtooth'}],
    klaxon: [{f:196,d:0.3,type:'square'},{f:185,d:0.42,type:'square'}],
    sting:  [{f:392,d:0.1,type:'square'},{f:523,d:0.1,type:'square'},{f:784,d:0.34,type:'square'}],
    // the phone's: a tap that did something, and a wrong answer said in the hand —
    // a two-note drop with a buzz under it, lower and blunter than the board's
    blip:   [{f:880,d:0.14,type:'square'}],
    buzz:   [{f:220,to:110,d:0.28,type:'sawtooth'},{f:110,d:0.16,type:'square'}]
  };

  function make(deps){
    deps = deps || {};
    const level = typeof deps.level === 'function' ? deps.level : () => 0.09;
    const on    = typeof deps.on    === 'function' ? deps.on    : () => true;
    let ctx = null;
    const synth = { count: 0, last: null };

    function ac(){
      if(ctx) return ctx;
      const AC = window.AudioContext || window.webkitAudioContext;
      if(!AC) return null;
      try{ ctx = new AC(); }catch(e){ ctx = null; }
      return ctx;
    }
    function unlock(){
      const a = ac(); if(!a) return null;
      if(a.state === 'suspended' && a.resume){ try{ a.resume(); }catch(e){} }
      return a;
    }
    /* the context, only if sound is on: every instrument starts here, so a mute is
       one check and a page without audio support is silent rather than broken */
    function live(name){
      if(!on()) return null;
      const a = unlock(); if(!a) return null;
      synth.count++; synth.last = name;
      return a;
    }
    function tone(a, at, f, to, d, type, peak){
      const osc = a.createOscillator(), gain = a.createGain();
      osc.type = type || 'triangle';
      osc.frequency.setValueAtTime(f, at);
      if(to) osc.frequency.exponentialRampToValueAtTime(to, at + d);
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(peak, at + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + d);
      osc.connect(gain); gain.connect(a.destination);
      osc.start(at); osc.stop(at + d + 0.02);
    }
    function play(name){
      const seq = VOICES[name]; if(!seq) return;
      const a = live(name); if(!a) return;
      const peak = level();
      let at = a.currentTime;
      seq.forEach(n => { tone(a, at, n.f, n.to, n.d, n.type, peak); at += n.d * 0.85; });
    }

    /* A burst of white noise shaped by a filter and an envelope. hp is a highpass
       cutoff, bp a bandpass centre (with q), `to` a frequency the filter sweeps to;
       attack/hold/decay are seconds. Applause, a crack, a hit and a swoosh are all
       this with different numbers. */
    let noiseBuf = null;
    function noise(secs, o){
      o = o || {};
      const a = live(o.name || 'noise'); if(!a) return;
      if(!noiseBuf || noiseBuf.sampleRate !== a.sampleRate || noiseBuf.duration < secs){
        noiseBuf = a.createBuffer(1, Math.ceil(a.sampleRate * Math.max(secs, 0.5)), a.sampleRate);
        const d = noiseBuf.getChannelData(0);
        for(let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      }
      const src = a.createBufferSource(); src.buffer = noiseBuf;
      const filt = a.createBiquadFilter();
      const t = a.currentTime;
      if(o.bp){ filt.type = 'bandpass'; filt.frequency.setValueAtTime(o.bp, t); filt.Q.value = o.q || 1; }
      else { filt.type = 'highpass'; filt.frequency.setValueAtTime(o.hp || 800, t); }
      if(o.to) filt.frequency.exponentialRampToValueAtTime(o.to, t + secs);
      const gain = a.createGain();
      const peak = Math.max(0.0002, (o.peak != null ? o.peak : 1) * level());
      const attack = o.attack || 0.004, hold = o.hold || 0, decay = o.decay || (secs - attack - hold);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(peak, t + attack);
      if(hold) gain.gain.setValueAtTime(peak, t + attack + hold);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + attack + hold + Math.max(0.01, decay));
      src.connect(filt); filt.connect(gain); gain.connect(a.destination);
      src.start(t); src.stop(t + secs + 0.05);
    }

    /* The table's contact sounds. Each takes the shelf's 0..1 strength so a graze is
       a tick and a hard hit is a clack with a thump under it — the same number that
       sizes the sparks, so what you hear is what you see. */
    const clamp01 = v => Math.max(0, Math.min(1, v == null ? 1 : v));
    function hit(s){
      s = clamp01(s);
      noise(0.05 + 0.04 * s, { name: 'hit', hp: 1800 - 900 * s, peak: 0.5 + 0.9 * s, attack: 0.002, decay: 0.03 + 0.05 * s });
      if(s > 0.25){
        const a = live('hit'); if(!a) return;
        tone(a, a.currentTime, 160 + 60 * s, 70, 0.07 + 0.05 * s, 'sine', level() * (0.4 + 0.8 * s));
      }
    }
    function knock(s){
      s = Math.max(0.6, clamp01(s));
      noise(0.09, { name: 'knock', hp: 700, peak: 1.6, attack: 0.002, decay: 0.07 });
      const a = live('knock'); if(!a) return;
      tone(a, a.currentTime, 220, 60, 0.14, 'triangle', level() * 1.3 * s);
    }
    function swoosh(s){
      s = clamp01(s);
      const secs = 0.14 + 0.16 * s;
      noise(secs, { name: 'swoosh', bp: 500, to: 1800 + 1400 * s, q: 0.8, peak: 0.35 + 0.65 * s, attack: 0.03 + 0.03 * s, decay: secs * 0.6 });
    }
    function dock(){
      const a = live('dock'); if(!a) return;
      const t = a.currentTime;
      tone(a, t, 330, 190, 0.075, 'sine', level() * 1.1);
      noise(0.03, { name: 'dock', hp: 2500, peak: 0.35, attack: 0.002, decay: 0.02 });
    }

    return Object.assign(synth, { ac, unlock, play, noise, hit, knock, swoosh, dock, voices: VOICES });
  }

  const HubSound = { make, voices: VOICES };
  window.HubSound = HubSound;
  if(window.HubKit) window.HubKit.sound = HubSound;
})();
