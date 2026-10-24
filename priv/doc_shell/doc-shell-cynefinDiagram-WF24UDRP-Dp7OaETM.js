import{n as ut}from"./doc-shell-mermaid-parser.core-YGcO9WUz.js";import{n as i}from"./doc-shell-chunk-Y2CYZVJY-CrVYBJys.js";import{m as V}from"./doc-shell-src-CReBSzQG.js";import{C as xt,E as ot,H as ht,U as gt,_ as $t,a as bt,c as wt,f as Ct,q as Dt,v as vt,y as U}from"./doc-shell-chunk-DSNLSHJZ-CsOUOwey.js";import{i as Q}from"./doc-shell-chunk-7S6XSTFO-eBZRZ7lc.js";import{t as kt}from"./doc-shell-chunk-JWPE2WC7-CzmgOK61.js";import{a as Tt}from"./doc-shell-mermaid.core-Brv-NXTf.js";var at=i(()=>({domains:new Map,transitions:[]}),"createDefaultData"),_=at(),O={getDomains:i(()=>_.domains,"getDomains"),getTransitions:i(()=>_.transitions,"getTransitions"),setDomains:i(t=>{if(t)for(const e of t){const n=e.domain,o=(e.items??[]).map(c=>({label:c.label}));_.domains.set(n,{name:n,items:o})}},"setDomains"),setTransitions:i(t=>{t&&(_.transitions=t.filter(e=>e.from===e.to?(V.warn(`Cynefin: self-loop transition on domain "${e.from}" is not meaningful and will be skipped.`),!1):!0).map(e=>({from:e.from,to:e.to,label:e.label||void 0})))},"setTransitions"),getConfig:i(()=>Q({...Ct.cynefin,...U().cynefin}),"getConfig"),clear:i(()=>{bt(),_=at()},"clear"),setAccTitle:gt,getAccTitle:vt,setDiagramTitle:Dt,getDiagramTitle:xt,getAccDescription:$t,setAccDescription:ht},At=i(t=>{kt(t,O),O.setDomains(t.domains),O.setTransitions(t.transitions)},"populate"),Bt={parse:i(async t=>{const e=await ut("cynefin",t);V.debug(e),At(e)},"parse")};function G(t){let e=t+1831565813|0;return e=Math.imul(e^e>>>15,e|1),e^=e+Math.imul(e^e>>>7,e|61),((e^e>>>14)>>>0)/4294967296}i(G,"seededRandom");function rt(t){let e=0;for(let n=0;n<t.length;n++){const o=t.charCodeAt(n);e=(e<<5)-e+o,e|=0}return e}i(rt,"hashString");function it(t,e){return typeof t=="number"&&Number.isFinite(t)&&t!==0?t:rt(e)}i(it,"resolveSeed");function st(t,e,n,o){const c=t/2,m=o??t*.015,D=7,I=e/D,d=[];for(let a=0;a<=D;a++){const p=G(n+a*17)*m*2-m;d.push({x:c+p,y:a*I})}let v=`M${d[0].x},${d[0].y}`;for(let a=0;a<d.length-1;a++){const p=d[a],s=d[a+1],f=(p.y+s.y)/2,b=a%2===0?1:-1,x=m*1.5*b*G(n+a*31+7),P=p.x+x,W=f,R=s.x-x;v+=` C${P},${W} ${R},${f} ${s.x},${s.y}`}return v}i(st,"generateFoldPath");function ct(t,e,n,o){const c=e/2,m=o??e*.015,D=7,I=t/D,d=[];for(let a=0;a<=D;a++){const p=G(n+a*23)*m*2-m;d.push({x:a*I,y:c+p})}let v=`M${d[0].x},${d[0].y}`;for(let a=0;a<d.length-1;a++){const p=d[a],s=d[a+1],f=(p.x+s.x)/2,b=a%2===0?1:-1,x=m*1.5*b*G(n+a*37+11),P=f,W=p.y+x,R=f,E=s.y-x;v+=` C${P},${W} ${R},${E} ${s.x},${s.y}`}return v}i(ct,"generateHorizontalBoundary");function lt(t,e){const n=t/2,o=e*.5,c=e,m=t*.03;return[`M${n},${o}`,`C${n+m},${o+(c-o)*.2}`,`${n-m*1.5},${o+(c-o)*.55}`,`${n+m*.5},${o+(c-o)*.75}`,`C${n-m},${o+(c-o)*.85}`,`${n+m*.3},${o+(c-o)*.95}`,`${n},${c}`].join(" ")}i(lt,"generateCliffPath");function dt(t,e,n,o){return[`M${t-n},${e}`,`A${n},${o} 0 1,1 ${t+n},${e}`,`A${n},${o} 0 1,1 ${t-n},${e}`,"Z"].join(" ")}i(dt,"generateConfusionPath");var nt={complex:{model:"Probe → Sense → Respond",practice:"Emergent Practices"},complicated:{model:"Sense → Analyse → Respond",practice:"Good Practices"},clear:{model:"Sense → Categorise → Respond",practice:"Best Practices"},chaotic:{model:"Act → Sense → Respond",practice:"Novel Practices"},confusion:{model:"",practice:"Disorder"}},St=i((t,e)=>{const n=t/2,o=e/2;return{complex:{cx:n/2,cy:o/2,x:0,y:0,w:n,h:o},complicated:{cx:n+n/2,cy:o/2,x:n,y:0,w:n,h:o},chaotic:{cx:n/2,cy:o+o/2,x:0,y:o,w:n,h:o},clear:{cx:n+n/2,cy:o+o/2,x:n,y:o,w:n,h:o},confusion:{cx:n,cy:o,x:n*.7,y:o*.7,w:n*.6,h:o*.6}}},"getDomainLayouts"),Mt=i(()=>{const t=ot(),e=U();return Q(t,e.themeVariables).cynefin},"getCynefinDomainColors"),q=3,zt={draw:i((t,e,n,o)=>{const c=o.db,m=c.getDomains(),D=c.getTransitions(),I=c.getDiagramTitle(),d=c.getAccTitle(),v=c.getAccDescription(),a=c.getConfig(),p=Mt();V.debug("Rendering Cynefin diagram");const s=a.width,f=a.height,b=a.padding,x=a.showDomainDescriptions,P=a.boundaryAmplitude,W=s+b*2,R=f+b*2,E={complex:p.complexBg,complicated:p.complicatedBg,clear:p.clearBg,chaotic:p.chaoticBg,confusion:p.confusionBg},k=Tt(e);wt(k,R,W,a.useMaxWidth??!0),k.attr("viewBox",`0 0 ${W} ${R}`),d&&k.append("title").text(d),v&&k.append("desc").text(v);const T=k.append("g").attr("transform",`translate(${b}, ${b})`),F=St(s,f),Z=it(a.seed,e),ft=T.append("g").attr("class","cynefin-backgrounds"),X=["complex","complicated","chaotic","clear"];for(const l of X){const r=F[l];ft.append("rect").attr("class","cynefinDomain").attr("x",r.x).attr("y",r.y).attr("width",r.w).attr("height",r.h).attr("fill",E[l]).attr("fill-opacity",.4).attr("stroke","none")}const j=T.append("g").attr("class","cynefin-boundaries");j.append("path").attr("class","cynefinBoundary").attr("d",st(s,f,Z,P)).attr("fill","none"),j.append("path").attr("class","cynefinBoundary").attr("d",ct(s,f,Z+100,P)).attr("fill","none"),j.append("path").attr("class","cynefinCliff").attr("d",lt(s,f)).attr("fill","none");const mt=s*.15,pt=f*.15;T.append("path").attr("class","cynefinConfusion").attr("d",dt(s/2,f/2,mt,pt)).attr("fill",E.confusion).attr("fill-opacity",.5);const J=T.append("g").attr("class","cynefin-labels");for(const l of X){const r=F[l];J.append("text").attr("class","cynefinDomainLabel").attr("x",r.cx).attr("y",x?r.cy-30:r.cy).attr("text-anchor","middle").attr("dominant-baseline","middle").text(l.charAt(0).toUpperCase()+l.slice(1))}if(J.append("text").attr("class","cynefinDomainLabel").attr("x",s/2).attr("y",x?f/2-10:f/2).attr("text-anchor","middle").attr("dominant-baseline","middle").text("Confusion"),x){const l=T.append("g").attr("class","cynefin-subtitles");for(const r of X){const u=F[r],y=nt[r];l.append("text").attr("class","cynefinSubtitle").attr("x",u.cx).attr("y",u.cy-10).attr("text-anchor","middle").attr("dominant-baseline","middle").text(y.model),l.append("text").attr("class","cynefinSubtitle").attr("x",u.cx).attr("y",u.cy+5).attr("text-anchor","middle").attr("dominant-baseline","middle").text(y.practice)}l.append("text").attr("class","cynefinSubtitle").attr("x",s/2).attr("y",f/2+8).attr("text-anchor","middle").attr("dominant-baseline","middle").text(nt.confusion.practice)}const K=T.append("g").attr("class","cynefin-items"),H=26;for(const l of["complex","complicated","chaotic","clear","confusion"]){const r=m.get(l);if(!r||r.items.length===0)continue;const u=F[l],y=l==="confusion";let M=r.items,z=0;y&&r.items.length>q&&(z=r.items.length-q,M=r.items.slice(0,q));let A;if(y){const g=x?22:14;A=u.cy+g}else A=u.cy+(x?25:15);if([...M].forEach((g,B)=>{const w=A+B*30,S=K.append("g"),L=S.append("text").attr("class","cynefinItemText").attr("x",0).attr("y",H/2).attr("text-anchor","middle").attr("dominant-baseline","central").text(g.label);let $=g.label.length*7;const h=L.node();if(h&&typeof h.getBBox=="function"){const Y=h.getBBox();Y.width>0&&($=Y.width)}const C=$+20,N=u.cx-C/2;S.attr("transform",`translate(${N}, ${w})`),S.insert("rect","text").attr("class","cynefinItem").attr("x",0).attr("y",0).attr("width",C).attr("height",H).attr("rx",4).attr("ry",4).attr("fill",E[l]).attr("fill-opacity",.95),L.attr("x",C/2).attr("y",H/2)}),z>0){const g=A+M.length*30,B=`+${z} more`,w=K.append("g"),S=w.append("text").attr("class","cynefinItemText").attr("x",0).attr("y",H/2).attr("text-anchor","middle").attr("dominant-baseline","central").text(B);let L=B.length*7;const $=S.node();if($&&typeof $.getBBox=="function"){const N=$.getBBox();N.width>0&&(L=N.width)}const h=L+20,C=u.cx-h/2;w.attr("transform",`translate(${C}, ${g})`),w.insert("rect","text").attr("class","cynefinItemOverflow").attr("x",0).attr("y",0).attr("width",h).attr("height",H).attr("rx",4).attr("ry",4).attr("fill",E[l]).attr("fill-opacity",.6),S.attr("x",h/2).attr("y",H/2)}}if(D.length>0){const l=k.select("defs").empty()?k.append("defs"):k.select("defs"),r=`cynefin-arrow-${e}`;l.append("marker").attr("id",r).attr("viewBox","0 0 10 10").attr("refX",9).attr("refY",5).attr("markerWidth",6).attr("markerHeight",6).attr("orient","auto-start-reverse").append("path").attr("d","M 0 0 L 10 5 L 0 10 z").attr("class","cynefinArrowHead");const u=T.append("g").attr("class","cynefin-arrows");D.forEach(y=>{const M=F[y.from],z=F[y.to];if(!M||!z)return;if(y.from===y.to){V.warn(`Cynefin renderer: skipping self-loop on domain "${y.from}"`);return}const A=M.cx,g=M.cy,B=z.cx,w=z.cy,S=(A+B)/2,L=(g+w)/2,$=B-A,h=w-g,C=Math.sqrt($*$+h*h),N=C*.15,Y=-h/C,yt=$/C,tt=S+Y*N,et=L+yt*N;u.append("path").attr("class","cynefinArrowLine").attr("d",`M${A},${g} Q${tt},${et} ${B},${w}`).attr("fill","none").attr("marker-end",`url(#${r})`),y.label&&u.append("text").attr("class","cynefinArrowLabel").attr("x",tt).attr("y",et-6).attr("text-anchor","middle").attr("dominant-baseline","auto").text(y.label)})}I&&T.append("text").attr("class","cynefinTitle").attr("x",s/2).attr("y",-b/2).attr("text-anchor","middle").attr("dominant-baseline","middle").text(I)},"draw")},Lt=i(()=>{const t=ot(),e=U();return Q(t,e.themeVariables).cynefin},"getCynefinTheme"),Ht={parser:Bt,db:O,renderer:zt,styles:i(()=>{const t=Lt();return`
	.cynefinDomain {
		stroke: none;
	}
	.cynefinDomainLabel {
		font-size: ${t.domainFontSize}px;
		font-weight: bold;
		fill: ${t.labelColor};
	}
	.cynefinSubtitle {
		font-size: ${t.itemFontSize-1}px;
		fill: ${t.textColor};
		font-style: italic;
	}
	.cynefinItem {
		fill-opacity: 0.95;
		stroke: ${t.boundaryColor};
		stroke-width: 1;
	}
	.cynefinItemText {
		font-size: ${t.itemFontSize}px;
		fill: ${t.textColor};
	}
	.cynefinItemOverflow {
		fill-opacity: 0.6;
		stroke: ${t.boundaryColor};
		stroke-width: 1;
		stroke-dasharray: 3 2;
	}
	.cynefinBoundary {
		stroke: ${t.boundaryColor};
		stroke-width: ${t.boundaryWidth};
		stroke-dasharray: 6 3;
	}
	.cynefinCliff {
		stroke: ${t.cliffColor};
		stroke-width: ${t.cliffWidth};
	}
	.cynefinConfusion {
		stroke: ${t.boundaryColor};
		stroke-width: 1.5;
		stroke-dasharray: 4 2;
	}
	.cynefinArrowLine {
		stroke: ${t.arrowColor};
		stroke-width: ${t.arrowWidth};
		fill: none;
	}
	.cynefinArrowHead {
		fill: ${t.arrowColor};
		stroke: none;
	}
	.cynefinArrowLabel {
		font-size: ${t.itemFontSize-1}px;
		fill: ${t.textColor};
	}
	.cynefinTitle {
		font-size: ${t.domainFontSize+2}px;
		font-weight: bold;
		fill: ${t.labelColor};
	}
	`},"styles")};export{Ht as diagram};
