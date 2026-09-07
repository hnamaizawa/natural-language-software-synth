"use strict";

// v0.4.2 perceived output-level normalization.
// Keeps the existing master_gain clamp intact, adds only bounded per-instrument velocity trims
// and a gentle final compressor inside the existing audio graph.
(() => {
  const LEVEL_TRIMS=Object.freeze({
    generic:.92,
    fretless_bass:1.16,
    studio_drums:1.04,
    dx_ep:1.10,
    electric_guitar:.96
  });

  function outputInstrumentKey(p){
    if(p&&p.instrument_model==="electric_guitar")return"electric_guitar";
    if(p&&(p.instrument_model==="studio_drums"||p.engine_type==="drum"))return"studio_drums";
    if(p&&p.instrument_model==="fretless_bass")return"fretless_bass";
    if(p&&p.instrument_model==="dx_ep")return"dx_ep";
    return"generic";
  }

  function perceivedLevelTrim(p){
    const key=outputInstrumentKey(p);let trim=LEVEL_TRIMS[key]||1;
    if(key==="generic"){
      const cutoff=Number(p?.filter_cutoff_hz??4200);
      if(cutoff<1800)trim*=1.10;
      else if(cutoff<3200)trim*=1.05;
    }else if(key==="electric_guitar"){
      const amp=String(p?.guitar_amp_model||"clean");
      if(amp==="high_gain")trim*=.90;
      else if(amp==="acoustic")trim*=1.08;
      else if(amp==="clean")trim*=1.03;
    }
    return clamp(trim,.82,1.22);
  }

  const baseInit=engine.init.bind(engine);
  engine.init=async function(){
    await baseInit();
    if(this.outputLeveler)return;
    const leveler=this.ctx.createDynamicsCompressor();
    leveler.threshold.value=-18;
    leveler.knee.value=16;
    leveler.ratio.value=2.5;
    leveler.attack.value=.006;
    leveler.release.value=.18;
    this.master.disconnect(this.analyser);
    this.master.connect(leveler);
    leveler.connect(this.analyser);
    this.outputLeveler=leveler;
  };

  const baseNoteOn=engine.noteOn.bind(engine);
  engine.noteOn=function(midiNote,velocity=.85,whenSeconds=0){
    const normalizedVelocity=clamp(Number(velocity)*perceivedLevelTrim(this.patch),.01,1);
    return baseNoteOn(midiNote,normalizedVelocity,whenSeconds);
  };

  window.synthOutputLevel={
    trimForPatch:p=>perceivedLevelTrim(p),
    instrumentKey:p=>outputInstrumentKey(p)
  };
})();
