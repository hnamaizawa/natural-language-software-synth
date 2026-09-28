"use strict";

// Summarize only counters observed during this playback. Native host counters
// persist across songs and can reset when the host process is restarted.
(() => {
  function delta(before,after){return Number.isFinite(before)&&Number.isFinite(after)&&after>=before?after-before:null;}
  function format(before,after,internal){
    const browser=`内蔵予約遅延 ${internal.late}件（最大 ${Math.round(internal.maxLateMs)} ms）／期限切れ ${internal.expired}件／長い画面処理 ${internal.longTasks}件`;
    if(!before||!after||before.error||after.error)return `${browser}。VST3診断: ${before?.error||after?.error||"対象のライブ音源なし"}。`;
    const overruns=delta(before.overruns,after.overruns);
    const parts=after.instances.map(item=>{
      const old=before.instances.find(entry=>entry.id===item.id),late=old?delta(old.late,item.late):null;
      const process=old?delta(old.processFailures,item.processFailures):null,events=old?delta(old.eventFailures,item.eventFailures):null;
      return `${item.names.join("・")} 遅延${late===null?"計測不可":`${late}件`}・処理失敗${process===null?"計測不可":`${process}件`}・イベント失敗${events===null?"計測不可":`${events}件`}`;
    });
    const load=Number.isFinite(before.load)&&Number.isFinite(after.load)?`／Host負荷 ${before.load.toFixed(1)}%→${after.load.toFixed(1)}%（開始・終了時の参考値）`:"";
    return `${browser}。VST3音声処理の締切超過 ${overruns===null?"計測不可":`${overruns}件`}${load}／${parts.join("、")||"対象なし"}。${overruns===null||parts.some(part=>part.includes("計測不可"))?"ホストが再起動した可能性があります。":""}`;
  }
  window.playbackDiagnostics={delta,format};
})();
