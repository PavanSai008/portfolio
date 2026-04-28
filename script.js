/* ═══════════════════════════════════════════
   CAROUSEL
═══════════════════════════════════════════ */
(function () {
  const track = document.getElementById("carouselTrack");
  const prevBtn = document.getElementById("prevBtn");
  const nextBtn = document.getElementById("nextBtn");
  const dotsEl = document.getElementById("carouselDots");
  if (!track) return;

  const originals = Array.from(track.children);
  const N = originals.length;

  // Clone all originals before the first child (leading clones)
  for (let i = N - 1; i >= 0; i--) {
    track.insertBefore(originals[i].cloneNode(true), track.firstChild);
  }
  // Clone all originals after the last child (trailing clones)
  for (let i = 0; i < N; i++) {
    track.appendChild(originals[i].cloneNode(true));
  }

  // Build dots (one per original card)
  for (let i = 0; i < N; i++) {
    const d = document.createElement("div");
    d.className = "dot";
    d.addEventListener("click", () => jumpTo(i));
    dotsEl.appendChild(d);
  }

  let allSlides = Array.from(track.children); // 3N total
  let ci = N; // start at first real card
  let animating = false;
  let autoTimer = null;
  let hovering = false;

  let slideW = 0,
    gap = 0,
    stride = 0,
    viewW = 0,
    cOff = 0;

  function measure() {
    allSlides = Array.from(track.children);
    viewW = track.parentElement.clientWidth;
    const s = allSlides[0];
    slideW = s.offsetWidth;
    const cs = getComputedStyle(s);
    gap = (parseFloat(cs.marginLeft) || 0) + (parseFloat(cs.marginRight) || 0);
    stride = slideW + gap;
    cOff = (viewW - slideW) / 2;
  }

  function applyTransform(animated) {
    track.style.transition = animated
      ? "transform 480ms cubic-bezier(0.25,0.46,0.45,0.94)"
      : "none";
    track.style.transform = `translateX(${-(ci * stride - cOff)}px)`;
    // highlight
    allSlides.forEach((s, i) => s.classList.toggle("active", i === ci));
    // dots: real index = ci - N (clamped)
    const realIdx = ci - N;
    document.querySelectorAll(".dot").forEach((d, i) => {
      d.classList.toggle("active", i === ((realIdx % N) + N) % N);
    });
  }

  function goNext() {
    if (animating) return;
    animating = true;
    ci++;
    applyTransform(true);
  }
  function goPrev() {
    if (animating) return;
    animating = true;
    ci--;
    applyTransform(true);
  }
  function jumpTo(realIdx) {
    if (animating) return;
    animating = true;
    ci = N + realIdx;
    applyTransform(true);
  }

  track.addEventListener("transitionend", (e) => {
    if (e.target !== track || e.propertyName !== "transform") return;
    if (ci >= 2 * N) {
      ci = N + (ci - 2 * N);
      applyTransform(false);
    } else if (ci < N) {
      ci = 2 * N - 1 - (N - 1 - ci);
      applyTransform(false);
    }
    animating = false;
  });

  function startAuto() {
    clearInterval(autoTimer);
    autoTimer = setInterval(() => {
      if (!hovering) goNext();
    }, 3200);
  }

  track.parentElement.addEventListener("mouseenter", () => {
    hovering = true;
    clearInterval(autoTimer);
  });
  track.parentElement.addEventListener("mouseleave", () => {
    hovering = false;
    startAuto();
  });

  prevBtn && prevBtn.addEventListener("click", goPrev);
  nextBtn && nextBtn.addEventListener("click", goNext);
  window.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight") goNext();
    if (e.key === "ArrowLeft") goPrev();
  });

  // touch
  let tx = 0;
  track.parentElement.addEventListener(
    "touchstart",
    (e) => {
      tx = e.touches[0].clientX;
    },
    { passive: true },
  );
  track.parentElement.addEventListener(
    "touchend",
    (e) => {
      const dx = e.changedTouches[0].clientX - tx;
      if (Math.abs(dx) > 40) dx < 0 ? goNext() : goPrev();
    },
    { passive: true },
  );

  let resizeTimer;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      measure();
      applyTransform(false);
    }, 150);
  });

  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      measure();
      applyTransform(false);
      startAuto();
    }),
  );
})();

/* ═══════════════════════════════════════════
   LIGHTBOX
═══════════════════════════════════════════ */
function openLightbox(src) {
  document.getElementById("lightboxImg").src = src;
  document.getElementById("lightbox").classList.add("open");
  document.body.style.overflow = "hidden";
}
function closeLightbox() {
  document.getElementById("lightbox").classList.remove("open");
  document.body.style.overflow = "";
}
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeLightbox();
});

/* ═══════════════════════════════════════════
   SCROLL REVEAL
═══════════════════════════════════════════ */
const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) e.target.classList.add("visible");
    });
  },
  { threshold: 0.12 },
);
document.querySelectorAll(".reveal").forEach((el) => observer.observe(el));

/* ═══════════════════════════════════════════
   ACTIVE NAV HIGHLIGHT
═══════════════════════════════════════════ */
const sections = document.querySelectorAll("section[id]");
const navLinks = document.querySelectorAll('nav a[href^="#"]');
window.addEventListener(
  "scroll",
  () => {
    let current = "";
    sections.forEach((s) => {
      if (window.scrollY >= s.offsetTop - 80) current = s.id;
    });
    navLinks.forEach((a) => {
      a.style.color =
        a.getAttribute("href") === "#" + current ? "var(--text)" : "";
    });
  },
  { passive: true },
);
