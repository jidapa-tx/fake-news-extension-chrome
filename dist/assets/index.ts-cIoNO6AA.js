(function(){const d="sbs-badge",L="sbs-badge-styles",P={"facebook.com":"facebook","x.com":"twitter","twitter.com":"twitter","today.line.me":"lineToday"},C={อันตราย:{color:"#DC2626",bg:"#FEF2F2",emoji:"🔴"},น่าสงสัย:{color:"#EA580C",bg:"#FFF7ED",emoji:"🟠"},ไม่แน่ใจ:{color:"#CA8A04",bg:"#FEFCE8",emoji:"🟡"},ค่อนข้างจริง:{color:"#16A34A",bg:"#F0FDF4",emoji:"🟢"},ยืนยันแล้ว:{color:"#059669",bg:"#F0FDF4",emoji:"✅"}},h="display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:20px;font-size:11px;font-weight:600;font-family:'IBM Plex Sans Thai',sans-serif;cursor:pointer;margin-top:4px;user-select:none;transition:opacity 0.2s;";let s=0,a=3;function D(){if(document.getElementById(L))return;const e=document.createElement("style");e.id=L,e.textContent="@keyframes sbs-spin { to { transform: rotate(360deg) } }",document.head.appendChild(e)}function M(){const e=document.createElement("div");return e.className=d,e.style.cssText=h+"color:#64748B;background:#F8FAFC;border:1px solid #CBD5E1;",e.title="ชัวร์ก่อนแชร์ — กำลังตรวจสอบ",e.innerHTML='<span style="width:10px;height:10px;border:2px solid #CBD5E1;border-top-color:#1E40AF;border-radius:50%;animation:sbs-spin 0.8s linear infinite;display:inline-block;flex-shrink:0"></span> กำลังตรวจสอบ...',e}function $(e,t,n,o){const r=C[t]??C.ไม่แน่ใจ;e.style.cssText=h+`color:${r.color};background:${r.bg};border:1px solid ${r.color}40;`,e.title="ชัวร์ก่อนแชร์ — คลิกเพื่อดูผล",e.innerHTML=`${r.emoji} ${t} (${n}%)`,e.addEventListener("click",m=>{try{m.stopPropagation(),chrome.runtime.sendMessage({type:"OPEN_POPUP_WITH_RESULT",resultId:o})}catch{}})}function p(e){e.style.cssText=h+"color:#94A3B8;background:#F8FAFC;border:1px solid #E2E8F0;",e.title="ชัวร์ก่อนแชร์ — ตรวจสอบไม่ได้",e.innerHTML="⚠ ตรวจไม่ได้"}function q(e,t){try{chrome.runtime.sendMessage({type:"ANALYZE_BADGE",text:t},n=>{try{if(chrome.runtime.lastError||!n){p(e);return}n.ok?$(e,n.result.verdict,n.result.score,n.result.id):p(e)}catch{p(e)}})}catch{p(e)}}function O(){const e=location.hostname.replace(/^www\./,"");return P[e]??null}function y(e,t){if(s>=a||e.querySelector(`.${d}`))return;D();const n=M();e.appendChild(n),s++,q(n,t.slice(0,5e3))}function E(){s>=a||(document.querySelectorAll('[data-testid="tweetText"]').forEach(e=>{var o;if(s>=a||e.querySelector(`.${d}`))return;const t=e.querySelector('[data-testid="tweet-text-show-more-link"]');if(t){t.click();return}const n=(o=e.innerText)==null?void 0:o.trim();!n||n.length<30||y(e,n)}),document.querySelectorAll('[data-ad-preview="message"], [class*="userContent"]').forEach(e=>{var n;if(s>=a||e.querySelector(`.${d}`))return;for(const o of e.querySelectorAll('[role="button"], span, div'))if(o.childElementCount===0&&o.innerText.trim()==="ดูเพิ่มเติม"){o.click();return}const t=(n=e.innerText)==null?void 0:n.trim();!t||t.length<30||y(e,t)}),document.querySelectorAll("article p").forEach(e=>{var n;if(s>=a||e.querySelector(`.${d}`))return;const t=(n=e.innerText)==null?void 0:n.trim();!t||t.length<30||y(e,t)}))}function j(){document.querySelectorAll(`.${d}`).forEach(e=>e.remove()),s=0}let l=null;function A(){l||(l=new MutationObserver(()=>{try{E()}catch{}}),l.observe(document.body,{childList:!0,subtree:!0}))}function K(){l==null||l.disconnect(),l=null}try{chrome.storage.local.get("sbs_settings",e=>{var t;try{const n=e.sbs_settings,o=O(),r=(n==null?void 0:n.enabled)??!0,m=o?((t=n==null?void 0:n.sites)==null?void 0:t[o])??!0:!1;a=(n==null?void 0:n.badgeLimit)??3,r&&m&&(E(),A()),chrome.storage.onChanged.addListener(v=>{var T;try{if(!v.sbs_settings)return;const i=v.sbs_settings.newValue,F=(i==null?void 0:i.enabled)??!0,I=o?((T=i==null?void 0:i.sites)==null?void 0:T[o])??!0:!1;a=(i==null?void 0:i.badgeLimit)??3,F&&I?(E(),A()):(j(),K())}catch{}})}catch{}})}catch{}const g="sbs-pick-mode-styles",u="sbs-pick-toolbar",f="sbs-pick-hover";let b=!1,c=null;const G=new Set(["p","article","section","blockquote","div"]),H=['[data-testid="tweetText"]','[data-ad-preview="message"]',"article p"];function R(e){var n;const t=e.tagName.toLowerCase();return G.has(t)?(((n=e.innerText)==null?void 0:n.trim().length)??0)>=30:!1}function x(e){if(!(e instanceof HTMLElement)||e.closest(`#${u}`))return null;for(const o of H){const r=e.closest(o);if(r)return r}let t=e,n=0;for(;t&&n<6;){if(R(t))return t;t=t.parentElement,n++}return null}function Y(){if(document.getElementById(g))return;const e=document.createElement("style");e.id=g,e.textContent=`
    body { cursor: crosshair !important; }
    .${f} {
      outline: 2px solid #1E40AF !important;
      background-color: rgba(30, 64, 175, 0.08) !important;
    }
    #${u}, #${u}:hover {
      background: #1E40AF !important;
    }
    #sbs-pick-cancel, #sbs-pick-cancel:hover {
      background: #DC2626 !important;
    }
  `,document.head.appendChild(e)}function z(){var e;(e=document.getElementById(g))==null||e.remove()}function N(){var t;if(document.getElementById(u))return;const e=document.createElement("div");e.id=u,e.style.cssText=`
    position: fixed;
    top: 12px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 2147483647;
    display: flex;
    align-items: center;
    gap: 10px;
    background: #1E40AF;
    color: white;
    padding: 8px 16px;
    border-radius: 24px;
    font-family: 'IBM Plex Sans Thai', sans-serif;
    font-size: 13px;
    font-weight: 500;
    box-shadow: 0 4px 16px rgba(30,64,175,0.4);
    pointer-events: auto;
  `,e.innerHTML=`
    <span>🔍 โหมดเลือกข้อความ — คลิกที่ข้อความที่ต้องการตรวจสอบ</span>
    <button id="sbs-pick-cancel" style="
      background: #DC2626;
      color: white;
      border: none;
      padding: 4px 10px;
      border-radius: 12px;
      font-size: 12px;
      cursor: pointer;
      font-family: inherit;
    ">ยกเลิก</button>
  `,document.body.appendChild(e),(t=document.getElementById("sbs-pick-cancel"))==null||t.addEventListener("click",k)}function V(){var e;(e=document.getElementById(u))==null||e.remove()}function w(e){try{const t=x(e.target);c&&c!==t&&c.classList.remove(f),t&&(t.classList.add(f),c=t)}catch{}}function S(e){try{const t=x(e.target);t==null||t.classList.remove(f)}catch{}}async function U(e){const t=e.querySelector('[data-testid="tweet-text-show-more-link"]');if(t){t.click(),await new Promise(r=>setTimeout(r,400));return}const o=(e.closest('[data-ad-preview="message"]')??e).querySelectorAll('[role="button"], span, div');for(const r of o)if(r.childElementCount===0&&r.innerText.trim()==="ดูเพิ่มเติม"){r.click(),await new Promise(m=>setTimeout(m,400));return}}async function _(e){try{const t=x(e.target);if(!t)return;e.preventDefault(),e.stopPropagation(),await U(t);let n=t.innerText.trim();n=n.replace(/\n{2,}/g,`
`).slice(0,5e3),k(),chrome.runtime.sendMessage({type:"PICKED_TEXT",text:n})}catch{}}function B(e){if(e.key==="Escape")try{k()}catch{}}function k(){b&&(b=!1,c==null||c.classList.remove(f),c=null,z(),V(),document.removeEventListener("mouseover",w),document.removeEventListener("mouseout",S),document.removeEventListener("click",_,!0),document.removeEventListener("keydown",B))}function X(){b||(b=!0,Y(),N(),document.addEventListener("mouseover",w),document.addEventListener("mouseout",S),document.addEventListener("click",_,!0),document.addEventListener("keydown",B))}try{chrome.runtime.onMessage.addListener((e,t,n)=>{try{e.type==="ACTIVATE_PICK_MODE"&&(X(),n({ok:!0}))}catch{}})}catch{}
})()
