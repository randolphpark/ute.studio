const menuButton = document.querySelector(".menu-toggle");
const navigation = document.querySelector("#navigation");
const setMenu = (open) => {
  menuButton.setAttribute("aria-expanded", String(open));
  navigation.classList.toggle("is-open", open);
};
menuButton.addEventListener("click", () =>
  setMenu(menuButton.getAttribute("aria-expanded") !== "true"),
);
navigation.addEventListener("click", (event) => {
  if (event.target.closest("a")) setMenu(false);
});
document.addEventListener("keydown", (event) => {
  if (
    event.key === "Escape" &&
    menuButton.getAttribute("aria-expanded") === "true"
  ) {
    setMenu(false);
    menuButton.focus();
  }
});
matchMedia("(min-width: 761px)").addEventListener("change", (event) => {
  if (event.matches) setMenu(false);
});
document.querySelector("#year").textContent = new Date().getFullYear();

const projects = {
  workhorse: {
    title: "The everyday workhorse.",
    category: "01 / UTE TRAYS & CANOPIES",
    image: "assets/ute-hero.webp",
    alt: "White ute with a black tray and canopy on a red dirt plain",
    description:
      "A launch campaign direction built around the ute that does it all. Warm light, honest materials and a strong product silhouette turn a practical setup into a memorable brand image. The concept could extend into a product reveal, feature-led social posts and a launch-page visual system.",
    deliverables: [
      "Campaign art direction",
      "AI-generated key visual",
      "Social layout concepts",
    ],
  },
  toolbox: {
    title: "Every detail earns its place.",
    category: "02 / TOOLBOXES & STORAGE",
    image: "assets/toolbox.webp",
    alt: "Black aluminium toolbox and drawer module against an orange studio backdrop",
    description:
      "A product visualisation direction that puts materials, storage and function in the spotlight. This AI-generated style study sets the look for a potential 3D production: accurate modelling from product references, close-up feature sequences and animated demonstrations of how the storage works.",
    deliverables: [
      "AI-generated style study",
      "3D art direction concept",
      "Product ad layouts",
    ],
  },
  touring: {
    title: "Clock off. Head out.",
    category: "03 / TOURING & 4×4",
    image: "assets/touring.webp",
    alt: "A sand-coloured touring ute on an Australian outback track",
    description:
      "An escape-the-everyday campaign for touring gear. A cinematic outback setting gives the product a place in the customer’s next adventure. One visual direction carries across vertical stories, feed posts and campaign artwork, with a consistent look from the first impression to the final frame.",
    deliverables: [
      "Lifestyle art direction",
      "AI-generated key visual",
      "Vertical social concepts",
    ],
  },
};
const dialog = document.querySelector("#project-dialog");
document.querySelectorAll("[data-project]").forEach((button) => {
  button.addEventListener("click", () => {
    const project = projects[button.dataset.project];
    document.querySelector("#project-title").textContent = project.title;
    document.querySelector("#project-category").textContent = project.category;
    document.querySelector("#project-description").textContent =
      project.description;
    const image = document.querySelector("#project-image");
    image.src = project.image;
    image.alt = project.alt;
    const deliverables = document.querySelector("#project-deliverables");
    deliverables.replaceChildren(
      ...project.deliverables.map((label) => {
        const item = document.createElement("span");
        item.textContent = label;
        return item;
      }),
    );
    dialog.showModal();
    document.body.classList.add("dialog-open");
  });
});
document
  .querySelector(".dialog-close")
  .addEventListener("click", () => dialog.close());
dialog.addEventListener("click", (event) => {
  if (event.target === dialog) {
    const rect = dialog.getBoundingClientRect();
    if (
      event.clientX < rect.left ||
      event.clientX > rect.right ||
      event.clientY < rect.top ||
      event.clientY > rect.bottom
    )
      dialog.close();
  }
});
dialog.addEventListener("close", () =>
  document.body.classList.remove("dialog-open"),
);
