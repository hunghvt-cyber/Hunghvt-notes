export const sortModes=['updated-desc','updated-asc','title-asc','title-desc','custom'];
export function sortNotes(notes,mode,order=[]){
 const ranks=new Map(order.map((id,i)=>[id,i]));
 return [...notes].sort((a,b)=>{
  if(mode==='custom'){const rank=(ranks.get(a.id)??Infinity)-(ranks.get(b.id)??Infinity);if(rank&&!Number.isNaN(rank))return rank;}
  else if(!!a.pinned!==!!b.pinned)return a.pinned?-1:1;
  if(mode==='title-asc'||mode==='title-desc'){const title=(a.title??'').localeCompare(b.title??'','vi',{numeric:true,sensitivity:'base'});if(title)return mode==='title-desc'?-title:title;}
  const time=(a.updatedAt??'').localeCompare(b.updatedAt??'');if(time)return mode==='updated-asc'?time:-time;
  return a.id.localeCompare(b.id);
 });
}
// Move selected rows one visible slot; filtered-out rows keep their positions.
export function shiftSelection(allIds,visibleIds,selected,direction){
 const visible=[...visibleIds];
 if(direction==='up'){for(let i=1;i<visible.length;i++)if(selected.has(visible[i])&&!selected.has(visible[i-1]))[visible[i-1],visible[i]]=[visible[i],visible[i-1]];}
 else{for(let i=visible.length-2;i>=0;i--)if(selected.has(visible[i])&&!selected.has(visible[i+1]))[visible[i],visible[i+1]]=[visible[i+1],visible[i]];}
 const included=new Set(visibleIds);let i=0;return allIds.map(id=>included.has(id)?visible[i++]:id);
}
