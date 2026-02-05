/* carousel functionality */
(function () {
  const container = document.getElementById('carouselWrap');
  const track = document.getElementById('carouselTrack');
  const prevBtn = document.getElementById('prevBtn');
  const nextBtn = document.getElementById('nextBtn');

  if (!container || !track) return;

  /* clone first and last slides for infinite effect */
  const originalSlides = Array.from(track.children);
  const firstClone1 = originalSlides[0].cloneNode(true);
  const firstClone2 = originalSlides[1].cloneNode(true);
  const lastClone1 = originalSlides[originalSlides.length - 1].cloneNode(true);
  const lastClone2 = originalSlides[originalSlides.length - 2].cloneNode(true);
  track.insertBefore(lastClone1, track.firstChild);
  track.insertBefore(lastClone2, track.firstChild);
  track.appendChild(firstClone1);
  track.appendChild(firstClone2);

  let slides = Array.from(track.children);
  let centerIndex = 2;
  let isTransitioning = false;
  let autoTimer = null;
  let isHovering = false;

  let slideWidth = 0;
  let slideMargin = 0;
  let slideTotal = 0;
  let containerWidth = 0;
  let centerOffset = 0;

  function computeSizes() {
    slides = Array.from(track.children);
    const rect = slides[0].getBoundingClientRect();
    slideWidth = rect.width;
    const style = getComputedStyle(slides[0]);
    const ml = parseFloat(style.marginLeft) || 0;
    const mr = parseFloat(style.marginRight) || 0;
    slideMargin = ml + mr;
    slideTotal = slideWidth + slideMargin;
    containerWidth = container.clientWidth;
    centerOffset = (containerWidth - slideWidth) / 2;
  }

  function setPosition(transition = true) {
    track.style.transition = transition ? 'transform 600ms cubic-bezier(.22,.9,.3,1)' : 'none';
    const translateX = -(centerIndex * slideTotal - centerOffset);
    track.style.transform = `translateX(${translateX}px)`;
    setActive();
  }

  function setActive() {
    slides.forEach(s => s.classList.remove('active'));
    if (slides[centerIndex]) {
      slides[centerIndex].classList.add('active');
    }
  }

  function nextSlide() {
    if (isTransitioning) return;
    isTransitioning = true;
    centerIndex++;
    setPosition(true);
  }

  function prevSlide() {
    if (isTransitioning) return;
    isTransitioning = true;
    centerIndex--;
    setPosition(true);
  }

  track.addEventListener('transitionend', () => {
    slides = Array.from(track.children);

    if (centerIndex === slides.length - 2) {
      track.style.transition = 'none';
      centerIndex = 2;
      setPosition(false);
    } else if (centerIndex === 1) {
      track.style.transition = 'none';
      centerIndex = slides.length - 3;
      setPosition(false);
    }

    isTransitioning = false;
  });

  function startAuto() {
    stopAuto();
    autoTimer = setInterval(() => {
      if (!isHovering) nextSlide();
    }, 3000);
  }

  function stopAuto() {
    if (autoTimer) {
      clearInterval(autoTimer);
      autoTimer = null;
    }
  }

  function enableHoverPause() {
    container.addEventListener('mouseenter', () => {
      isHovering = true;
      stopAuto();
    });
    container.addEventListener('mouseleave', () => {
      isHovering = false;
      startAuto();
    });
  }

  /* navigate carousel controls */
  if (nextBtn && prevBtn) {
    nextBtn.addEventListener('click', nextSlide);
    prevBtn.addEventListener('click', prevSlide);
  }

  window.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') nextSlide();
    if (e.key === 'ArrowLeft') prevSlide();
  });

  window.addEventListener('resize', () => {
    computeSizes();
    setPosition(false);
  });

  /* initialize carousel */
  computeSizes();
  setPosition(false);
  startAuto();
  enableHoverPause();
})();

/* typewriter animation for welcome section */
document.addEventListener("DOMContentLoaded", function() {
  /* welcome section typewriter */
  function typeText(element, text, speed = 55, callback) {
    let i = 0;
    function type() {
      if (i < text.length) {
        element.innerHTML += text.charAt(i);
        i++;
        setTimeout(type, speed);
      } else if (callback) {
        callback();
      }
    }
    type();
  }

  const title = "Hello! I'm Pavan";
  const subtitle = "I am a Software | Backend Engineer";
  const titleEl = document.getElementById("typed-title");
  const subtitleEl = document.getElementById("typed-subtitle");

  if (titleEl && subtitleEl) {
    typeText(titleEl, title, 55, function() {
      setTimeout(() => {
        typeText(subtitleEl, subtitle, 32, function() {
          /* about section typewriter after welcome finishes */
          const aboutDesc = document.querySelector("#about .desc p[style*='margin-top']");
          const aboutText = "I am a DevOps and Cloud Engineer with hands-on experience in building, deploying, and managing cloud-native applications on AWS. I specialize in CI/CD automation using GitHub Actions to enable fast, reliable, and secure software delivery. I have strong experience with Docker and Kubernetes for containerization, orchestration, scaling, and high availability of microservices. I use Terraform to implement Infrastructure as Code, ensuring consistent and repeatable cloud environments. I am proficient in Python for automation, scripting, and operational tooling. I work closely with development teams to improve system reliability, performance, and security while following DevOps best practices.";
          if (aboutDesc) {
            aboutDesc.innerHTML = "";
            typeText(aboutDesc, aboutText, 18);
          }
        });
      }, 400);
    });
  }
});
