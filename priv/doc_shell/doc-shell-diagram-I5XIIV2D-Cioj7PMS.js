import{n as D}from"./doc-shell-mermaid-parser.core-YGcO9WUz.js";import{n as k}from"./doc-shell-chunk-Y2CYZVJY-CrVYBJys.js";import{m as x}from"./doc-shell-src-CReBSzQG.js";import{C as T,H as z,U as E,_ as F,a as P,c as A,f as W,q as _,v as N,y as L}from"./doc-shell-chunk-DSNLSHJZ-CsOUOwey.js";import{i as y}from"./doc-shell-chunk-7S6XSTFO-eBZRZ7lc.js";import{t as M}from"./doc-shell-chunk-JWPE2WC7-CzmgOK61.js";import{a as Y}from"./doc-shell-mermaid.core-Brv-NXTf.js";var H=W.packet,B=class{constructor(){this.packet=[],this.setAccTitle=E,this.getAccTitle=N,this.setDiagramTitle=_,this.getDiagramTitle=T,this.getAccDescription=F,this.setAccDescription=z}static{k(this,"PacketDB")}getConfig(){const t=y({...H,...L().packet});return t.showBits&&(t.paddingY+=10),t}getPacket(){return this.packet}pushWord(t){t.length>0&&this.packet.push(t)}clear(){P(),this.packet=[]}},I=1e4,O=k((t,e)=>{M(t,e);let r=-1,o=[],i=1;const{bitsPerRow:l}=e.getConfig();for(let{start:a,end:s,bits:d,label:g}of t.blocks){if(a!==void 0&&s!==void 0&&s<a)throw new Error(`Packet block ${a} - ${s} is invalid. End must be greater than start.`);if(a??=r+1,a!==r+1)throw new Error(`Packet block ${a} - ${s??a} is not contiguous. It should start from ${r+1}.`);if(d===0)throw new Error(`Packet block ${a} is invalid. Cannot have a zero bit field.`);for(s??=a+(d??1)-1,d??=s-a+1,r=s,x.debug(`Packet block ${a} - ${r} with label ${g}`);o.length<=l+1&&e.getPacket().length<I;){const[c,p]=U({start:a,end:s,bits:d,label:g},i,l);if(o.push(c),c.end+1===i*l&&(e.pushWord(o),o=[],i++),!p)break;({start:a,end:s,bits:d,label:g}=p)}}e.pushWord(o)},"populate"),U=k((t,e,r)=>{if(t.start===void 0)throw new Error("start should have been set during first phase");if(t.end===void 0)throw new Error("end should have been set during first phase");if(t.start>t.end)throw new Error(`Block start ${t.start} is greater than block end ${t.end}.`);if(t.end+1<=e*r)return[t,void 0];const o=e*r-1,i=e*r;return[{start:t.start,end:o,label:t.label,bits:o-t.start},{start:i,end:t.end,label:t.label,bits:t.end-i}]},"getNextFittingBlock"),C={parser:{yy:void 0},parse:k(async t=>{const e=await D("packet",t),r=C.parser?.yy;if(!(r instanceof B))throw new Error("parser.parser?.yy was not a PacketDB. This is due to a bug within Mermaid, please report this issue at https://github.com/mermaid-js/mermaid/issues.");x.debug(e),O(e,r)},"parse")},j=k((t,e,r,o)=>{const i=o.db,l=i.getConfig(),{rowHeight:a,paddingY:s,bitWidth:d,bitsPerRow:g}=l,c=i.getPacket(),p=i.getDiagramTitle(),u=a+s,n=u*(c.length+1)-(p?0:a),h=d*g+2,f=Y(e);f.attr("viewBox",`0 0 ${h} ${n}`),A(f,n,h,l.useMaxWidth);for(const[m,b]of c.entries())q(f,b,m,l);f.append("text").text(p).attr("x",h/2).attr("y",n-u/2).attr("dominant-baseline","middle").attr("text-anchor","middle").attr("class","packetTitle")},"draw"),q=k((t,e,r,{rowHeight:o,paddingX:i,paddingY:l,bitWidth:a,bitsPerRow:s,showBits:d,bitOrder:g})=>{const c=t.append("g"),p=r*(o+l)+l,u=g==="descending";for(const n of e){const h=n.end-n.start+1,f=n.start%s,m=(u?s-f-h:f)*a+1,b=h*a-i;if(c.append("rect").attr("x",m).attr("y",p).attr("width",b).attr("height",o).attr("class","packetBlock"),c.append("text").attr("x",m+b/2).attr("y",p+o/2).attr("class","packetLabel").attr("dominant-baseline","middle").attr("text-anchor","middle").text(n.label),!d)continue;const[$,S]=u?[n.end,n.start]:[n.start,n.end],w=h===1,v=p-2;c.append("text").attr("x",m+(w?b/2:0)).attr("y",v).attr("class","packetByte start").attr("dominant-baseline","auto").attr("text-anchor",w?"middle":"start").text($),w||c.append("text").attr("x",m+b).attr("y",v).attr("class","packetByte end").attr("dominant-baseline","auto").attr("text-anchor","end").text(S)}},"drawWord"),G={draw:j},K={byteFontSize:"10px",startByteColor:"black",endByteColor:"black",labelColor:"black",labelFontSize:"12px",titleColor:"black",titleFontSize:"14px",blockStrokeColor:"black",blockStrokeWidth:"1",blockFillColor:"#efefef"},et={parser:C,get db(){return new B},renderer:G,styles:k(({packet:t}={})=>{const e=y(K,t);return`
	.packetByte {
		font-size: ${e.byteFontSize};
	}
	.packetByte.start {
		fill: ${e.startByteColor};
	}
	.packetByte.end {
		fill: ${e.endByteColor};
	}
	.packetLabel {
		fill: ${e.labelColor};
		font-size: ${e.labelFontSize};
	}
	.packetTitle {
		fill: ${e.titleColor};
		font-size: ${e.titleFontSize};
	}
	.packetBlock {
		stroke: ${e.blockStrokeColor};
		stroke-width: ${e.blockStrokeWidth};
		fill: ${e.blockFillColor};
	}
	`},"styles")};export{et as diagram};
