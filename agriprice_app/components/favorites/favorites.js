/* components/favorites/favorites.js */
(function favoritesInit() {
	const section = document.querySelector(".favorites-section");
	const track = document.getElementById("favoritesTrack");
	const dotsWrap = document.getElementById("favoritesDots");
	if (!section || !track || !dotsWrap) return;

	const role = (localStorage.getItem("role") || "").toLowerCase();
	if (role !== "farmer") {
		section.remove();
		return;
	}

	const STORAGE_KEY = "agri.favoriteProducts.v1";
	const mockFavorites = [
		{ id: "buyer-1", name: "ล้งนพรัตน์", subtitle: "ทุเรียน หมอนทอง", cardId: "card-durian-1" },
		{ id: "buyer-2", name: "รับซื้อหลังสวน", subtitle: "ทุเรียน มังคุด", cardId: "card-durian-2" },
		{ id: "buyer-3", name: "ช่อหวานรับซื้อ", subtitle: "ลองกอง", cardId: "card-longkong-1" },
		{ id: "buyer-4", name: "ล้งขวัญเมือง", subtitle: "หลังสวน ชุมพร", cardId: "card-durian-3" },
		{ id: "buyer-5", name: "ตลาดอวยชัย", subtitle: "รับซื้อผลนานา", cardId: "card-mixed-1" },
		{ id: "buyer-6", name: "ล้งกนก ผลไม้หลังสวน", subtitle: "ทุเรียน มังคุด", cardId: "card-durian-4" },
	];

	function loadFavoritesFromStorage() {
		try {
			const raw = localStorage.getItem(STORAGE_KEY);
			if (!raw) return mockFavorites;
			const items = JSON.parse(raw);
			if (!Array.isArray(items) || items.length === 0) return mockFavorites;
			
			// Sort by favoritedAt (newest first), then take first 6
			const sorted = items.sort((a, b) => (b.favoritedAt || 0) - (a.favoritedAt || 0));
			return sorted.slice(0, 6).map((item) => ({
				id: item.sellerId || "",
				name: item.sellerName || "",
				subtitle: item.sellerSub || "",
				cardId: item.cardId || "",
			}));
		} catch (err) {
			console.error("Failed to load favorites:", err);
			return mockFavorites;
		}
	}

	let favorites = loadFavoritesFromStorage();

	function escapeHtml(str) {
		return String(str)
			.replaceAll("&", "&amp;")
			.replaceAll("<", "&lt;")
			.replaceAll(">", "&gt;")
			.replaceAll('"', "&quot;")
			.replaceAll("'", "&#039;");
	}

	function getPrefixToPages() {
		const path = (window.location.pathname || "").replace(/\\/g, "/");
		const dir = path.endsWith("/") ? path : path.substring(0, path.lastIndexOf("/") + 1);
		const pagesIdx = dir.indexOf("/pages/");
		if (pagesIdx === -1) return "pages/";
		const afterPages = dir.substring(pagesIdx + "/pages/".length);
		const depth = afterPages.split("/").filter(Boolean).length;
		return "../".repeat(depth);
	}

	function getPerView() {
		return (window.innerWidth || document.documentElement.clientWidth || 375) >= 768 ? 4 : 3;
	}

	let cards = [];
	let perView = getPerView();
	const pagesPrefix = getPrefixToPages();
	const profileBase = `${pagesPrefix}shared/profile.html`;

	function renderCards() {
		track.innerHTML = "";

		favorites.forEach((item) => {
			const button = document.createElement("button");
			button.className = "fav-card";
			button.type = "button";
			button.setAttribute("role", "listitem");
			button.dataset.buyerId = item.id;
			button.dataset.cardId = item.cardId;
			button.innerHTML = `
				<span class="fav-title">${escapeHtml(item.name)}</span>
				<span class="fav-subtitle">${escapeHtml(item.subtitle)}</span>
			`;
			track.appendChild(button);
		});

		cards = Array.from(track.querySelectorAll(".fav-card"));
	}

	function pagesCount() {
		perView = getPerView();
		return Math.max(1, Math.ceil(cards.length / perView));
	}

	function getPageWidth() {
		if (!cards.length) return track.clientWidth || 1;
		const gap = parseFloat(getComputedStyle(track).gap || "10") || 10;
		const cardWidth = cards[0].getBoundingClientRect().width || 1;
		return (cardWidth + gap) * perView;
	}

	function clamp(n, min, max) {
		return Math.max(min, Math.min(max, n));
	}

	function scrollToPage(pageIndex, smooth) {
		const pages = pagesCount();
		const idx = clamp(pageIndex, 0, pages - 1);
		const target = cards[idx * perView];
		if (!target) return;
		target.scrollIntoView({ behavior: smooth ? "smooth" : "auto", inline: "start", block: "nearest" });
	}

	function buildDots() {
		const pages = pagesCount();
		dotsWrap.innerHTML = "";
		if (pages <= 1) return;

		for (let i = 0; i < pages; i++) {
			const dot = document.createElement("span");
			dot.className = "dot" + (i === 0 ? " active" : "");
			dot.addEventListener("click", () => scrollToPage(i, true));
			dotsWrap.appendChild(dot);
		}
	}

	function setActiveDot() {
		const dots = Array.from(dotsWrap.querySelectorAll(".dot"));
		if (!dots.length) return;
		const pageWidth = getPageWidth();
		const pageIndex = clamp(Math.round(track.scrollLeft / pageWidth), 0, pagesCount() - 1);
		dots.forEach((dot, index) => dot.classList.toggle("active", index === pageIndex));
	}

	track.addEventListener("click", (event) => {
		const card = event.target.closest(".fav-card");
		if (!card) return;

		const buyerId = card.dataset.buyerId || "";
		const cardId = card.dataset.cardId || "";
		const query = new URLSearchParams();
		if (buyerId) query.set("id", buyerId);
		if (cardId) query.set("scrollTo", cardId);
		window.location.href = `${profileBase}?${query.toString()}`;
	});

	let raf = null;
	track.addEventListener("scroll", () => {
		if (raf) cancelAnimationFrame(raf);
		raf = requestAnimationFrame(setActiveDot);
	});

	window.addEventListener("resize", () => {
		buildDots();
		setActiveDot();
	});

	function refreshFavorites() {
		favorites = loadFavoritesFromStorage();
		renderCards();
		buildDots();
		setActiveDot();
	}

	window.addEventListener("favoritesChanged", refreshFavorites);

	renderCards();
	buildDots();
	setActiveDot();
})();
