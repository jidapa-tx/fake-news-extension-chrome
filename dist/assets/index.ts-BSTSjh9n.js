(function(){const l="sbs-badge",P={"facebook.com":"facebook","x.com":"twitter","twitter.com":"twitter","today.line.me":"lineToday"},v=[{verdict:"น่าสงสัย",score:32,color:"#EA580C",bg:"#FFF7ED",emoji:"🟠"},{verdict:"อันตราย",score:8,color:"#DC2626",bg:"#FEF2F2",emoji:"🔴"},{verdict:"ยืนยันแล้ว",score:92,color:"#059669",bg:"#F0FDF4",emoji:"✅"},{verdict:"ไม่แน่ใจ",score:51,color:"#CA8A04",bg:"#FEFCE8",emoji:"🟡"}];function _(){return v[Math.floor(Math.random()*v.length)]}function A(){const e=location.hostname.replace(/^www\./,"");return P[e]??null}function f(e){const t=_(),n=document.createElement("div");return n.className=l,n.style.cssText=`
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 2px 8px;
    border-radius: 20px;
    font-size: 11px;
    font-weight: 600;
    font-family: 'IBM Plex Sans Thai', sans-serif;
    color: ${t.color};
    background: ${t.bg};
    border: 1px solid ${t.color}40;
    cursor: pointer;
    margin-top: 4px;
    user-select: none;
    transition: opacity 0.2s;
  `,n.title="ชัวร์ก่อนแชร์ — คลิกเพื่อดูผล",n.innerHTML=`${t.emoji} ${t.verdict} (${t.score}%)`,n.addEventListener("click",o=>{try{o.stopPropagation(),chrome.runtime.sendMessage({type:"OPEN_POPUP_WITH_RESULT",resultId:e})}catch{}}),n}function p(){document.querySelectorAll('[data-testid="tweetText"]').forEach(e=>{if(e.querySelector(`.${l}`))return;const t=e.querySelector('[data-testid="tweet-text-show-more-link"]');if(t){t.click();return}e.appendChild(f(`mock-${e.dataset.testid}-${Date.now()}`))}),document.querySelectorAll('[data-ad-preview="message"], [class*="userContent"]').forEach(e=>{if(!e.querySelector(`.${l}`)){for(const t of e.querySelectorAll('[role="button"], span, div'))if(t.childElementCount===0&&t.innerText.trim()==="ดูเพิ่มเติม"){t.click();return}e.appendChild(f(`mock-fb-${Date.now()}`))}}),document.querySelectorAll("article p").forEach(e=>{e.querySelector(`.${l}`)||e.innerText.trim().length<30||e.appendChild(f(`mock-line-${Date.now()}`))})}function I(){document.querySelectorAll(`.${l}`).forEach(e=>e.remove())}let i=null;function x(){i||(i=new MutationObserver(()=>{try{p()}catch{}}),i.observe(document.body,{childList:!0,subtree:!0}))}function M(){i==null||i.disconnect(),i=null}try{chrome.storage.local.get("sbs_settings",e=>{var t;try{const n=e.sbs_settings,o=A(),r=(n==null?void 0:n.enabled)??!0,m=o?((t=n==null?void 0:n.sites)==null?void 0:t[o])??!0:!1;r&&m&&(p(),x()),chrome.storage.onChanged.addListener(g=>{var h;try{if(!g.sbs_settings)return;const s=g.sbs_settings.newValue,L=(s==null?void 0:s.enabled)??!0,S=o?((h=s==null?void 0:s.sites)==null?void 0:h[o])??!0:!1;L&&S?(p(),x()):(I(),M())}catch{}})}catch{}})}catch{}const b="sbs-pick-mode-styles",a="sbs-pick-toolbar",d="sbs-pick-hover";let u=!1,c=null;const $=new Set(["p","article","section","blockquote","div"]),D=['[data-testid="tweetText"]','[data-ad-preview="message"]',"article p"];function B(e){var n;const t=e.tagName.toLowerCase();return $.has(t)?(((n=e.innerText)==null?void 0:n.trim().length)??0)>=30:!1}function y(e){if(!(e instanceof HTMLElement)||e.closest(`#${a}`))return null;for(const o of D){const r=e.closest(o);if(r)return r}let t=e,n=0;for(;t&&n<6;){if(B(t))return t;t=t.parentElement,n++}return null}function F(){if(document.getElementById(b))return;const e=document.createElement("style");e.id=b,e.textContent=`
    body { cursor: crosshair !important; }
    .${d} {
      outline: 2px solid #1E40AF !important;
      background-color: rgba(30, 64, 175, 0.08) !important;
    }
    #${a}, #${a}:hover {
      background: #1E40AF !important;
    }
    #sbs-pick-cancel, #sbs-pick-cancel:hover {
      background: #DC2626 !important;
    }
  `,document.head.appendChild(e)}function O(){var e;(e=document.getElementById(b))==null||e.remove()}function q(){var t;if(document.getElementById(a))return;const e=document.createElement("div");e.id=a,e.style.cssText=`
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
  `,document.body.appendChild(e),(t=document.getElementById("sbs-pick-cancel"))==null||t.addEventListener("click",E)}function K(){var e;(e=document.getElementById(a))==null||e.remove()}function k(e){try{const t=y(e.target);c&&c!==t&&c.classList.remove(d),t&&(t.classList.add(d),c=t)}catch{}}function w(e){try{const t=y(e.target);t==null||t.classList.remove(d)}catch{}}async function j(e){const t=e.querySelector('[data-testid="tweet-text-show-more-link"]');if(t){t.click(),await new Promise(r=>setTimeout(r,400));return}const o=(e.closest('[data-ad-preview="message"]')??e).querySelectorAll('[role="button"], span, div');for(const r of o)if(r.childElementCount===0&&r.innerText.trim()==="ดูเพิ่มเติม"){r.click(),await new Promise(m=>setTimeout(m,400));return}}async function T(e){try{const t=y(e.target);if(!t)return;e.preventDefault(),e.stopPropagation(),await j(t);let n=t.innerText.trim();n=n.replace(/\n{2,}/g,`
`).slice(0,5e3),E(),chrome.runtime.sendMessage({type:"PICKED_TEXT",text:n})}catch{}}function C(e){if(e.key==="Escape")try{E()}catch{}}function E(){u&&(u=!1,c==null||c.classList.remove(d),c=null,O(),K(),document.removeEventListener("mouseover",k),document.removeEventListener("mouseout",w),document.removeEventListener("click",T,!0),document.removeEventListener("keydown",C))}function G(){u||(u=!0,F(),q(),document.addEventListener("mouseover",k),document.addEventListener("mouseout",w),document.addEventListener("click",T,!0),document.addEventListener("keydown",C))}try{chrome.runtime.onMessage.addListener((e,t,n)=>{try{e.type==="ACTIVATE_PICK_MODE"&&(G(),n({ok:!0}))}catch{}})}catch{}
})()
