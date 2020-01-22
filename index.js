"use strict";

const defaultButtons = "12345".split("").join("\n");
const passwordTest = "(password)";

const $ = x => typeof x === "string" ? document.getElementById(x) : x;

const sleep = ms => () => new Promise(res => setTimeout(res, ms));

const objQuery = o =>
  Object.keys(o).map(k => `${k}=${encodeURIComponent(o[k])}`).join("&")

const evListener = (id, type, f) =>
  $(id).addEventListener(type, f, true);

const show = (msg, kind, txt = null) => {
  const messages = $("log");
  while (messages.children.length > 12) messages.lastChild.remove();
  const fst = document.createElement("div");
  fst.append(document.createTextNode(msg));
  fst.classList.add(kind || "bad");
  if (txt) {
    const snd = document.createElement("div");
    snd.classList.add("histtext");
    snd.append(document.createTextNode(txt));
    snd.classList.add("reuse-text");
    if (txt != passwordTest)
      snd.addEventListener("click", () => {
        $("thetext").value = txt; $("thetext").focus(); });
    fst.append(snd);
  }
  messages.prepend(fst);
  return fst;
};
const makeSend = (msg, txt) => show(msg, "send", txt);
const changeSend = (node, msg, kind) => {
  node.classList.remove("send");
  node.classList.add(kind || "bad");
  if (typeof msg === "string") node.firstChild.nodeValue = msg;
  else { node.firstChild.remove(); node.prepend(msg); }
};

const getImg = () => {
  const data = localStorage.getItem("plq-img");
  if (!data) return null;
  const img = new Image();
  img.src = data;
  img.classList.add("login-image");
  return img;
};
const setImg = txt => {
  const n = $("menu-handle");
  const old = n.querySelector("img");
  if (old) old.remove();
  if (!txt) localStorage.removeItem("plq-img");
  else { localStorage.setItem("plq-img", txt); n.append(getImg()); }
};

const sendToLogger = (x, ok = null, fail = null) => {
  const txt = typeof x === "string" ? x : x.innerText;
  if (txt == "") return;
  const req = new XMLHttpRequest();
  const msg = makeSend("Sending...", txt);
  req.onreadystatechange = () => {
    if (req.readyState != 4) return;
    const isImage = /^data:image\/png;base64,/.test(req.responseText);
    const reply = !isImage ? req.responseText
                           : (setImg(req.responseText), getImg());
    console.log("--> %o", reply);
    const isOK = req.status == 200 && (isImage || req.responseText == "OK");
    changeSend(msg, reply, isOK && "ok");
    if (isOK) ok && ok(); else fail && fail();
  };
  const [user, pswd] = getLogin();
  req.open("GET", `/plq?${
    objQuery({u: user || "???", p: pswd || "???", t: txt})}`, true);
  req.send();
};

let buttons = [];
const setButtonsHTML = bs => {
  buttons = bs.split("\n").filter(s => s);
  if (!buttons.length) buttons = defaultButtons.split("\n");
  $("buttons").innerHTML = buttons.map(b =>
    `<button class="btn" id="${b}" accesskey="${b}">${b}</button>`).join("");
  buttons.forEach(key => {
    const node = $(key);
    evListener(node, "click", () => sendToLogger(node));
  });
};
const setButtons = bs => {
  if (!bs) bs = defaultButtons;
  console.log(`setting buttons: ${bs.replace(/\n/g, ", ")}`);
  const b = $("buttons");
  if (bs == [...b.querySelectorAll("button")].map(b => b.innerText).join("\n"))
    return;
  b.style.height = `${b.scrollHeight}px`;
  Promise.resolve()
    .then(sleep(50)) .then(()=> b.style.height = `0`)
    .then(sleep(500)).then(()=> setButtonsHTML(bs))
    .then(sleep(50)) .then(()=> b.style.height = `${b.scrollHeight}px`)
    .then(sleep(500)).then(()=> b.style.height = ``);
};
setButtons(defaultButtons);

const theTextSend = clear => {
  sendToLogger($("thetext").value.trim(),
               clear && (() => $("thetext").value = ""));
  $("thetext").focus();
};
const theTextKeyListen = () =>
  evListener("thetext", "keyup", e => {
    switch (e.key) {
    case "Enter":
      if (editorOn && !(e.ctrlKey || e.altKey)) break;
      e.preventDefault(); e.stopImmediatePropagation();
      theTextSend(!editorOn);
      return;
    case "Escape":
      e.target.setSelectionRange(0, e.target.value.length);
      document.execCommand("insertText", false, "");
      return;
    }
  });
theTextKeyListen();
evListener("thetext-submit", "click", e => theTextSend(true));

{ // The delay D between runs starts at MIN sec, and in each iteration,
  // then it goes to D*(STEPUP/T**STEPDN) for an execution that lasted T
  // secs, kept within the MIN..MAX bounds.
  const MIN = 1, MAX = 60, STEPUP = 1.5,
        STEPDN = STEPUP ** (1/30); // T = 30s => no change in delay
  let ws, start, delay = MIN;
  const startWS = () => {
    start = Date.now();
    ws = new WebSocket("wss://plq.barzilay.org/ws");
    ws.onmessage = e => setButtons(e.data);
    ws.onerror = e => console.error("websocket error", e);
    ws.onclose = () => {
      const elapsed = (Date.now() - start) / 1000;
      const mult    = STEPUP / (STEPDN ** elapsed);
      delay         = Math.max(Math.min(delay * mult, MAX), MIN);
      console.log(`websocket closed, restarting in ${Math.round(delay)}s`);
      setTimeout(startWS, 1000 * delay);
    };
  };
  startWS();
}

const getLogin = () =>
  ["plq-user", "plq-pswd"].map(i => localStorage.getItem(i));
const getUser = () => getLogin()[0];
const setLogin = () => {
  const user = $("user").value.trim().toLowerCase(),
        pswd = $("pswd").value;
  if (user == "") return show("missing username");
  if (pswd == "") return show("missing password");
  $("user").value = user;
  $("pswd").value = "";
  localStorage.setItem("plq-user", user);
  localStorage.setItem("plq-pswd", md5(pswd));
  setImg(null);
  sendToLogger(passwordTest, hideLogin,
               () => { localStorage.removeItem("plq-pswd");
                       localStorage.removeItem("plq-user");
                       setImg(null); });
};
if (getUser()) setImg(localStorage.getItem("plq-img"));

let menuShown = false;
const toggleMenu = () => {
  menuShown = !menuShown;
  $("nav-links").classList[menuShown ? "add" : "remove"]("expanded");
  $("menu-handle")[menuShown ? "focus" : "blur"]();
};
const hideMenu = () => menuShown && toggleMenu();
evListener("menu-handle", "click", toggleMenu);
evListener("menu-handle", "blur", () => setTimeout(hideMenu,100));

const showLogin = () => {
  $("text-container").style.display = "none";
  $("login-container").style.display = "block";
  const user = localStorage.getItem("plq-user");
  if (!user) $("user").focus();
  else { $("user").value = user; $("pswd").focus(); }
};
const hideLogin = e => {
  $("text-container").style.display = "block";
  $("login-container").style.display = "none";
};
const toggleLogin = e =>
  $("login-container").style.display == "none" ? showLogin()
  : $("pswd").value == "" && getUser() ? hideLogin()
  : setLogin();
const keyLogin = e => {
  switch (e.key) {
  case "Enter":  return setLogin();
  case "Escape": if (getUser()) return hideLogin();
                 else return show("please enter your login information");
  }
};
evListener("show-login", "click", toggleLogin);
["user", "pswd"].forEach(k => evListener(k, "keyup", keyLogin));
if (!localStorage.getItem("plq-pswd")) showLogin();

let editorOn = false;
const toggleEditor = () => {
  let t = $("thetext"), focus = document.activeElement == t, txt = t.value;
  if (!editorOn && getUser() != "eli") return;
  editorOn = !editorOn;
  const editorInitText =
    "???\n\n" + defaultButtons.split("\n").map(b => `${b}. \n`).join("");
  document.body.classList[editorOn ? "add" : "remove"]("sudo");
  t.outerHTML = t.outerHTML.replace(/^(<)[a-z]+|[a-z]+(>)$/g,
                                    editorOn ? "$1textarea$2" : "$1input$2");
  theTextKeyListen();
  t = $("thetext");
  if (!editorOn)
    txt = txt.replace(/\s+/g, "") == editorInitText.replace(/\s+/g, "")
          ? "" : txt.replace(/ *\n */g, " ");
  t.value = txt;
  if (focus) t.focus();
  if (!editorOn) return;
  let editorModified = false;
  t.addEventListener("input", e => {
    if (editorModified) return;
    editorModified = true;
    sendToLogger("New Question");
  });
  if (txt.trim() == "") {
    t.value = editorInitText;
    t.focus();
    t.setSelectionRange(0,3);
  }
};

const editorDone = () => {
  if (!editorOn) return;
  theTextSend(true);
  toggleEditor();
  $("thetext").value = "Done!";
  theTextSend(true);
};

let timerRunning = null, timerDeadline = null, timerShown = null;
const timerUpdate = () => {
  const show = Math.ceil((timerDeadline - Date.now()) / 1000);
  if (timerShown == show) return;
  const pad2 = n => n < 10 ? "0"+n : n;
  if (show >= 0) {
    timerShown = show;
    $("timer").classList.remove("over");
    $("timer").innerHTML = show < 60 ? show
                           : Math.floor(show/60) + ":" + pad2(show%60);
  } else if (show >= -10) {
    $("timer").classList.add("over");
    $("timer").innerHTML = "!!!BZZZ!!!";
  } else timerAdd(0)();
};
const timerAdd = d => () => {
  if (getUser() != "eli") return;
  const now = Date.now();
  timerDeadline = (timerDeadline || now) + d*1000;
  if (!!timerRunning === (timerDeadline > now)) return;
  $("timer").classList.toggle("active"); $("timer").style.opacity = 0;
  $("timer").classList.remove("over");
  setTimeout(() => $("timer").style.opacity = 0.9, 100);
  if (timerRunning) { clearInterval(timerRunning); timerRunning = null; }
  if (timerDeadline > now) timerRunning = setInterval(timerUpdate, 100);
  else timerDeadline = null;
};

const hotKeys = new Map([
  ["t", () => $("thetext").focus()],
  ["l", toggleLogin],
  ["s", toggleEditor],
  ["d", editorDone],
  ["ArrowUp",   timerAdd(+10)],
  ["ArrowDown", timerAdd(-10)]
]);

window.addEventListener("keydown", (e =>
  e.altKey && !e.shiftKey && !e.ctrlKey && hotKeys.has(e.key)
  && (e.preventDefault(), e.stopImmediatePropagation())),
  true);
window.addEventListener("keyup", (e =>
  e.altKey && !e.shiftKey && !e.ctrlKey && hotKeys.has(e.key)
  && (e.preventDefault(), e.stopImmediatePropagation(), hotKeys.get(e.key)())),
  true);

window.addEventListener("load", () => {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register(
      window.location.href.replace(/\/[^\/]*$/, "/worker.js"))
    .then(reg => console.log(`ServiceWorker registered for: ${reg.scope}`),
          err => console.log(`ServiceWorker failure: ${err}`));
  }
});

let installEvt = null;
window.addEventListener("beforeinstallprompt", e => {
  e.preventDefault(); // Prevent Chrome <=67 showing a prompt
  $("install").style.display = "block";
  installEvt = e;
});
evListener("install", "click", () => setTimeout(() => {
  if (!installEvt) return;
  console.log("Installing...");
  $("install").style.display = "none";
  installEvt.prompt();
  installEvt.userChoice.then(res => {
    console.log(`User ${res.outcome} the install prompt`);
    installEvt = null;
  });
}, 250));