// The cursor: a dot on the pointer and a ring that trails it. Only for a mouse or trackpad.
(() => {
  if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;

  const root = document.documentElement;
  const dot = document.createElement("div");
  const ring = document.createElement("div");
  dot.className = "cur cur--dot";
  ring.className = "cur cur--ring";
  dot.setAttribute("aria-hidden", "true");
  ring.setAttribute("aria-hidden", "true");
  document.body.append(ring, dot);
  root.classList.add("has-cursor");

  const SELECTOR = "a, button, [role='button'], .leaf, summary, label, canvas.can-pick";
  let x = -100;
  let y = -100;
  let rx = x;
  let ry = y;
  let seen = false;
  let frame = 0;

  const show = (on) => {
    dot.classList.toggle("is-on", on);
    ring.classList.toggle("is-on", on);
  };
  const flag = (name, on) => {
    dot.classList.toggle(name, on);
    ring.classList.toggle(name, on);
  };

  function draw() {
    frame = 0;
    rx += (x - rx) * 0.22;
    ry += (y - ry) * 0.22;
    ring.style.transform = `translate3d(${rx}px, ${ry}px, 0)`;
    if (Math.abs(x - rx) > 0.1 || Math.abs(y - ry) > 0.1) frame = requestAnimationFrame(draw);
  }

  function move(event) {
    x = event.clientX;
    y = event.clientY;
    // The dot is set right here, so it is never behind the pointer.
    dot.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    if (!seen) {
      seen = true;
      rx = x;
      ry = y;
      ring.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    }
    show(true);
    const target = event.target;
    flag("is-link", Boolean(target && target.closest && target.closest(SELECTOR)));
    if (!frame) frame = requestAnimationFrame(draw);
  }

  window.addEventListener("pointermove", move, { passive: true });
  window.addEventListener("pointerdown", (event) => {
    move(event);
    flag("is-down", true);
  }, { passive: true });
  window.addEventListener("pointerup", () => flag("is-down", false), { passive: true });
  window.addEventListener("pointercancel", () => flag("is-down", false), { passive: true });
  document.addEventListener("mouseleave", () => show(false));
  document.addEventListener("mouseenter", () => seen && show(true));
  window.addEventListener("blur", () => show(false));
})();
