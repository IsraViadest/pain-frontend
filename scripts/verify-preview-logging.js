/* created by: Christian Stelmach (chrisp.stel@gmail.com), GitHub: @cstelmach
 * Local preview only: activates real controls and writes identifiable test-visit events.
 * Run with eval.mjs, then verify this userId/tabId against the collector's JSONL file. */
(async () => {
  if (location.origin !== "http://127.0.0.1:5176") {
    return { passed: false, error: "Logging test requires the isolated port-5176 preview" };
  }
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  const click = selector => {
    const button = document.querySelector(selector);
    if (!button || button.disabled) throw Error("Control unavailable: " + selector);
    button.click();
  };
  const originalFetch = window.fetch;
  const sent = [];
  window.fetch = async function (input, options) {
    const response = await originalFetch.call(this, input, options);
    if (new URL(typeof input === "string" ? input : input.url, location.href).pathname === "/metrics/events") {
      const batch = JSON.parse(options.body);
      const reply = response.ok ? await response.clone().json() : {};
      sent.push({ status: response.status, accepted: reply.accepted, batch });
    }
    return response;
  };
  try {
    click('button[data-layer="physpain"]');
    await wait(1400);
    click('[data-metric-target="about"]');
    await wait(300);
    click('.info-modal__close');
    click('button[data-layer="emopain"]');
    await wait(1400);
    click('.emo-legend__exclude[data-cat="06_anger"]');
    await wait(1400);
    click('.emo-legend__exclude[data-cat="06_anger"]');
    await wait(1400);
    click('.emo-legend__item[data-cat="06_anger"]');
    await wait(1400);
    click('[data-metric-target="share"]');
    await wait(300);
    click('.consent-modal__btn--agree');
    await wait(500);
    const options = [...document.querySelectorAll('.survey-screen--1 .survey-bubble')];
    if (options.length < 2) throw Error("Survey options missing");
    options[0].click();
    options[1].click();
    click('.survey-screen--1 .survey-screen__advance');
    await wait(700);
    click('.survey-modal__close');
    click('button[data-layer="envpain"]');
    await wait(6500);
    if (!sent.length || sent.some(row => row.status !== 200)) throw Error("Metrics request failed");
    const events = sent.flatMap(row => row.batch.events);
    const has = (type, target, action) => events.some(e => e.type === type && e.target === target && e.action === action);
    for (const expected of [["control", "layer", "click"], ["window", "about", "close"],
      ["emotion", "emotion-filter", "click"], ["emotion", "emotion-filter", "disable"],
      ["emotion", "emotion-filter", "enable"], ["country", "country", "open"],
      ["survey", "survey", "next"]]) {
      if (!has(...expected)) throw Error("Missing emitted event " + expected.join("/"));
    }
    if (!events.some(e => e.type === "survey" && e.action === "next" && e.selectedCount === 2)) {
      throw Error("Survey selection count missing");
    }
    if (!events.some(e => e.type === "control" && e.layer === "envpain")) {
      throw Error("Map metrics did not continue after the survey");
    }
    const last = sent.at(-1).batch;
    const retry = await originalFetch('/metrics/events', { method: 'POST',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(last) });
    if (!retry.ok || (await retry.json()).accepted !== 0) throw Error("Retry was not deduplicated");
    return { passed: true, userId: last.userId, tabId: last.tabId,
      statuses: sent.map(row => row.status), retryAccepted: 0, events };
  } catch (error) {
    return { passed: false, error: String(error), statuses: sent.map(row => row.status),
      userId: sent.at(-1)?.batch.userId, tabId: sent.at(-1)?.batch.tabId };
  } finally {
    window.fetch = originalFetch;
  }
})()
