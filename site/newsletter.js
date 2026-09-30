(() => {
  const section = document.querySelector("#newsletter");
  const sitekey = section?.dataset.newsletterSitekey;
  if (!sitekey) return;
  section.hidden = false;
  const form = section.querySelector("form");
  const button = form.querySelector('button[type="submit"]');
  const status = section.querySelector("#newsletter-status");
  let token = "";
  let widget;
  let sending = false;
  let complete = false;
  function message(text, error = false) {
    status.textContent = text;
    status.classList.toggle("is-error", error);
  }
  function resetToken(text) {
    token = "";
    button.disabled = true;
    if (!sending && !complete) message(text, true);
  }
  function loadChallenge() {
    const script = document.createElement("script");
    script.src =
      "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true;
    script.onload = () => {
      try {
        widget = window.turnstile.render("#newsletter-challenge", {
          sitekey,
          action: "newsletter",
          theme: "light",
          size: "flexible",
          callback: (value) => {
            token = value;
            button.disabled = sending || complete;
            if (!sending && !complete && !status.classList.contains("is-error"))
              message("We’ll email you a link to confirm your subscription.");
          },
          "expired-callback": () =>
            resetToken("The security check expired. Please complete it again."),
          "error-callback": () => {
            resetToken(
              "The security check couldn’t load. Please refresh and try again.",
            );
            return true;
          },
        });
      } catch {
        resetToken(
          "The security check couldn’t load. Please refresh and try again.",
        );
      }
    };
    script.onerror = () =>
      resetToken(
        "The security check couldn’t load. Please refresh and try again.",
      );
    document.head.append(script);
  }
  const observer = new IntersectionObserver(
    (entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        observer.disconnect();
        loadChallenge();
      }
    },
    { rootMargin: "200px" },
  );
  observer.observe(section);
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (sending || complete || !form.reportValidity()) return;
    if (!token) {
      resetToken("Please complete the security check.");
      return;
    }
    sending = true;
    button.disabled = true;
    form.setAttribute("aria-busy", "true");
    message("Sending your confirmation email…");
    try {
      const response = await fetch("/api/newsletter/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: form.elements.email.value,
          consent: form.elements.consent.checked,
          website: form.elements.website.value,
          token,
        }),
        signal: AbortSignal.timeout(15000),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(
          result.message ||
            "Signup is temporarily unavailable. Please try again shortly.",
        );
      complete = true;
      form.querySelectorAll("input").forEach((input) => {
        input.disabled = true;
      });
      button.textContent = "Check your inbox ✓";
      message(
        result.message || "Check your inbox and confirm your subscription.",
      );
    } catch (error) {
      message(
        error.name === "TimeoutError" || error.name === "TypeError"
          ? "We couldn’t reach the signup service. Please try again shortly."
          : error.message,
        true,
      );
      token = "";
      if (widget !== undefined) window.turnstile.reset(widget);
    } finally {
      sending = false;
      form.removeAttribute("aria-busy");
      button.disabled = complete || !token;
    }
  });
})();
