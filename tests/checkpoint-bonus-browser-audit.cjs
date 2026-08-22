"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const baseUrl = process.argv[2] || "http://127.0.0.1:4173/";
const debuggingPort = Number(process.argv[3] || 9222);
const outputDirectory = path.resolve(process.argv[4] || path.join(process.cwd(), "checkpoint-bonus-audit"));
const rewardIds = [
  "stars_100", "life_refill", "stars_500", "color_voucher",
  "hat_voucher", "beard_voucher", "gold_slime"
];
const voucherIds = new Set(["color_voucher", "hat_voucher", "beard_voucher"]);
const viewports = [
  {width: 720, height: 405},
  {width: 1280, height: 720}
];

const delay = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

async function createTarget() {
  const response = await fetch(
    `http://127.0.0.1:${debuggingPort}/json/new?${encodeURIComponent("about:blank")}`,
    {method: "PUT"}
  );
  assert.equal(response.ok, true, `could not create Edge target: ${response.status}`);
  return response.json();
}

async function connectCdp(webSocketDebuggerUrl) {
  const socket = new WebSocket(webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, {once: true});
    socket.addEventListener("error", reject, {once: true});
  });
  let nextId = 1;
  const pending = new Map();
  const eventWaiters = new Map();
  const eventObservers = new Map();
  socket.addEventListener("message", event => {
    const message = JSON.parse(event.data);
    if (message.id) {
      const request = pending.get(message.id);
      if (!request) return;
      pending.delete(message.id);
      if (message.error) request.reject(new Error(message.error.message));
      else request.resolve(message.result);
      return;
    }
    const waiters = eventWaiters.get(message.method) ?? [];
    eventWaiters.delete(message.method);
    waiters.forEach(resolve => resolve(message.params));
    (eventObservers.get(message.method) ?? []).forEach(observer => observer(message.params));
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = nextId++;
    pending.set(id, {resolve, reject});
    socket.send(JSON.stringify({id, method, params}));
  });
  const waitForEvent = (method, timeoutMs = 10000) => new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`CDP event timeout: ${method}`)), timeoutMs);
    const wrapped = params => {
      clearTimeout(timer);
      resolve(params);
    };
    const waiters = eventWaiters.get(method) ?? [];
    waiters.push(wrapped);
    eventWaiters.set(method, waiters);
  });
  const on = (method, observer) => {
    const observers = eventObservers.get(method) ?? [];
    observers.push(observer);
    eventObservers.set(method, observers);
  };
  return {socket, send, waitForEvent, on};
}

async function auditViewport(cdp, viewport) {
  const {send, waitForEvent} = cdp;
  await send("Emulation.setDeviceMetricsOverride", {
    width: viewport.width,
    height: viewport.height,
    deviceScaleFactor: 1,
    mobile: false
  });
  const navigate = async url => {
    const loaded = waitForEvent("Page.loadEventFired");
    await send("Page.navigate", {url});
    await loaded;
    await delay(700);
  };
  const evaluate = async expression => {
    const result = await send("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
      userGesture: true
    });
    if (result.exceptionDetails) {
      throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
    }
    return result.result.value;
  };

  await navigate(`${baseUrl}?checkpoint-bonus-audit=${viewport.width}`);
  await evaluate(`localStorage.clear(); sessionStorage.setItem("slimejumperLocalDevMode", "on"); true`);
  await navigate(`${baseUrl}?checkpoint-bonus-audit=${viewport.width}-${Date.now()}`);
  const startup = await evaluate(`({
    ready: Boolean(window.SlimeCheckpointBonus?.isConfigured?.()),
    dev: typeof DEV_MODE !== "undefined" && DEV_MODE,
    errors: window.__checkpointBonusAuditErrors ?? []
  })`);
  assert.equal(startup.ready, true);
  assert.equal(startup.dev, true);

  const viewportResults = [];
  for (const rewardId of rewardIds) {
    await evaluate(`window.SlimeCheckpointBonus.resetStateForDev()`);
    assert.equal(
      await evaluate(`window.SlimeCheckpointBonus.devForceReward(${JSON.stringify(rewardId)})`),
      true,
      `${rewardId} did not open`
    );
    await delay(100);
    const prepared = await evaluate(`(() => {
      const overlay = document.getElementById("checkpointBonusOverlay");
      const panel = document.getElementById("checkpointBonusPanel");
      const machine = document.getElementById("checkpointBonusMachine");
      const action = document.getElementById("checkpointBonusAction");
      const rect = element => {
        const box = element.getBoundingClientRect();
        return {left: box.left, top: box.top, right: box.right, bottom: box.bottom,
          width: box.width, height: box.height};
      };
      return {
        overlayHidden: overlay.classList.contains("hidden"),
        panel: rect(panel), machine: rect(machine), action: rect(action),
        actionText: action.textContent.trim(),
        reelCount: overlay.querySelectorAll(".checkpointBonusReelFrame").length,
        leverCount: overlay.querySelectorAll(".checkpointBonusLever").length,
        closeCount: overlay.querySelectorAll("[data-close], .close, [aria-label='Schließen']").length,
        documentWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
        panelOverflow: panel.scrollHeight - panel.clientHeight
      };
    })()`);
    assert.equal(prepared.overlayHidden, false);
    assert.equal(prepared.actionText, "SPIN STARTEN");
    assert.equal(prepared.reelCount, 1);
    assert.equal(prepared.leverCount, 1);
    assert.equal(prepared.closeCount, 0);
    assert.ok(prepared.panel.left >= -0.5 && prepared.panel.right <= viewport.width + 0.5);
    assert.ok(prepared.panel.top >= -0.5 && prepared.panel.bottom <= viewport.height + 0.5);
    assert.ok(prepared.action.top >= 0 && prepared.action.bottom <= viewport.height + 0.5);
    assert.ok(prepared.machine.left >= 0 && prepared.machine.right <= viewport.width + 0.5);
    assert.equal(prepared.documentWidth, prepared.clientWidth);
    assert.ok(prepared.panelOverflow <= 1, `prepared panel clips by ${prepared.panelOverflow}px`);

    await evaluate(`document.getElementById("checkpointBonusAction").click()`);
    await delay(180);
    assert.match(
      await evaluate(`document.getElementById("checkpointBonusAction").textContent`),
      /STOPPEN/
    );
    const stopStarted = Date.now();
    await evaluate(`document.getElementById("checkpointBonusAction").click()`);
    let phase = null;
    for (let attempt = 0; attempt < 70; attempt++) {
      phase = await evaluate(`window.SlimeCheckpointBonus.getState().pending?.phase ?? null`);
      if (["landed", "payout_applied"].includes(phase)) break;
      await delay(50);
    }
    const decelerationElapsed = Date.now() - stopStarted;
    assert.ok(
      decelerationElapsed >= 2200 && decelerationElapsed <= 2800,
      `${rewardId} deceleration was ${decelerationElapsed}ms`
    );

    let voucherChoiceCount = 0;
    let voucherSelectionScreenshot = null;
    if (voucherIds.has(rewardId)) {
      assert.equal(phase, "landed");
      await evaluate(`document.getElementById("checkpointBonusAction").click()`);
      await delay(80);
      voucherChoiceCount = await evaluate(
        `document.querySelectorAll("#checkpointBonusVoucherChoices button").length`
      );
      assert.ok(voucherChoiceCount > 0);
      const voucherScreenshot = await send("Page.captureScreenshot", {
        format: "png",
        fromSurface: true
      });
      voucherSelectionScreenshot =
        `${viewport.width}x${viewport.height}-${rewardId}-selection.png`;
      fs.writeFileSync(
        path.join(outputDirectory, voucherSelectionScreenshot),
        Buffer.from(voucherScreenshot.data, "base64")
      );
      await evaluate(`document.querySelector("#checkpointBonusVoucherChoices button").click()`);
      await delay(100);
    }

    const landed = await evaluate(`(() => {
      const panel = document.getElementById("checkpointBonusPanel");
      const action = document.getElementById("checkpointBonusAction");
      const reward = document.getElementById("checkpointBonusReward");
      const choices = document.getElementById("checkpointBonusVoucherChoices");
      const box = element => {
        const value = element.getBoundingClientRect();
        return {left: value.left, top: value.top, right: value.right, bottom: value.bottom,
          width: value.width, height: value.height};
      };
      return {
        phase: window.SlimeCheckpointBonus.getState().pending?.phase,
        rewardText: reward.textContent.trim(),
        jackpot: panel.classList.contains("checkpointBonusPanel--jackpot"),
        panel: box(panel), action: box(action), reward: box(reward), choices: box(choices),
        panelOverflow: panel.scrollHeight - panel.clientHeight,
        documentWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth
      };
    })()`);
    assert.equal(landed.phase, "payout_applied");
    assert.ok(landed.rewardText.length > 0);
    assert.equal(landed.jackpot, rewardId === "gold_slime");
    assert.ok(landed.panel.left >= -0.5 && landed.panel.right <= viewport.width + 0.5);
    assert.ok(landed.panel.top >= -0.5 && landed.panel.bottom <= viewport.height + 0.5);
    assert.ok(landed.action.top >= 0 && landed.action.bottom <= viewport.height + 0.5);
    assert.equal(landed.documentWidth, landed.clientWidth);
    assert.ok(landed.panelOverflow <= 1, `landed panel clips by ${landed.panelOverflow}px`);

    const screenshot = await send("Page.captureScreenshot", {format: "png", fromSurface: true});
    const screenshotName = `${viewport.width}x${viewport.height}-${rewardId}.png`;
    fs.writeFileSync(path.join(outputDirectory, screenshotName), Buffer.from(screenshot.data, "base64"));
    viewportResults.push({
      rewardId,
      decelerationElapsed,
      rewardText: landed.rewardText,
      voucherChoiceCount,
      voucherSelectionScreenshot,
      screenshot: screenshotName
    });
    await evaluate(`document.getElementById("checkpointBonusAction").click()`);
    await delay(80);
    assert.equal(
      await evaluate(`document.getElementById("checkpointBonusOverlay").classList.contains("hidden")`),
      true
    );
  }
  let autoStopElapsed = null;
  if (viewport.width === 720) {
    await evaluate(`window.SlimeCheckpointBonus.resetStateForDev()`);
    assert.equal(await evaluate(`window.SlimeCheckpointBonus.devForceReward("stars_100")`), true);
    const autoStopStarted = Date.now();
    await evaluate(`document.getElementById("checkpointBonusAction").click()`);
    for (let attempt = 0; attempt < 175; attempt++) {
      const autoPhase = await evaluate(
        `window.SlimeCheckpointBonus.getState().pending?.phase ?? null`
      );
      if (autoPhase === "payout_applied") break;
      await delay(50);
    }
    autoStopElapsed = Date.now() - autoStopStarted;
    assert.ok(
      autoStopElapsed >= 7200 && autoStopElapsed <= 8200,
      `automatic stop completed after ${autoStopElapsed}ms`
    );
    const screenshot = await send("Page.captureScreenshot", {format: "png", fromSurface: true});
    fs.writeFileSync(
      path.join(outputDirectory, `${viewport.width}x${viewport.height}-auto-stop.png`),
      Buffer.from(screenshot.data, "base64")
    );
    await evaluate(`document.getElementById("checkpointBonusAction").click()`);
  }
  return {rewards: viewportResults, autoStopElapsed};
}

(async () => {
  fs.mkdirSync(outputDirectory, {recursive: true});
  const target = await createTarget();
  const cdp = await connectCdp(target.webSocketDebuggerUrl);
  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");
  await cdp.send("Log.enable");
  const runtimeExceptions = [];
  cdp.on("Runtime.exceptionThrown", details => runtimeExceptions.push(details));
  const results = [];
  try {
    for (const viewport of viewports) {
      results.push({viewport, ...(await auditViewport(cdp, viewport))});
    }
    assert.equal(runtimeExceptions.length, 0, "uncaught browser runtime exception detected");
  } finally {
    await cdp.send("Page.close").catch(() => {});
    cdp.socket.close();
  }
  process.stdout.write(JSON.stringify({outputDirectory, results}, null, 2) + "\n");
})().catch(error => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
