export function categoryLabel(code?:string,description?:string):string{
 const c=(code||'').trim(),d=(description||'').trim();
 if(!c)return d;
 if(!d||c.toLocaleLowerCase()===d.toLocaleLowerCase())return c;
 return `${c} — ${d}`;
}
export function subcategoryLabels(s:{level2:string;level3:string;level2Des?:string;level3Des?:string}):string{
 return [categoryLabel(s.level2,s.level2Des),categoryLabel(s.level3,s.level3Des)].filter(Boolean).join(' / ');
}
