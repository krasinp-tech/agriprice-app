/* components/favorites/allfavorites.js */
(function allFavoritesInit() {
	const FAVORITES_KEY = "agri.favoriteProducts.v1";

	const mount = document.getElementById("allFavoritesMount");
	const emptyState = document.getElementById("allFavoritesEmpty");
	if (!mount || !emptyState) return;

	function getRole() {
		try {
			const raw = localStorage.getItem(window.AUTH_USER_KEY || "user");
			const user = raw ? JSON.parse(raw) : null;
			if (user?.role) return String(user.role).toLowerCase();
		} catch (_) {}
		return (localStorage.getItem("role") || "guest").toLowerCase();
	}

	function loadFavorites() {
		try {
			const raw = localStorage.getItem(FAVORITES_KEY);
			const data = raw ? JSON.parse(raw) : [];
			if (!Array.isArray(data)) return [];
			return data
				.filter((item) => item && typeof item === "object")
				.sort((a, b) => Number(b.favoritedAt || 0) - Number(a.favoritedAt || 0));
		} catch (_) {
			return [];
		}
	}

	function saveFavorites(items) {
		localStorage.setItem(FAVORITES_KEY, JSON.stringify(items));
	}

	async function loadCardTemplate() {
		const res = await fetch("../product-card/product-card.html");
		if (!res.ok) throw new Error("load product-card template failed");
		const html = await res.text();
		const holder = document.createElement("div");
		holder.innerHTML = html;
		const tpl = holder.querySelector("#productCardTpl");
		if (!tpl) throw new Error("productCardTpl not found");
		return tpl;
	}

	function fillCard(card, item) {
		card.dataset.sellerId = item.sellerId || "";
		card.dataset.sellerName = item.sellerName || "";

		const avatar = card.querySelector('[data-bind="avatar"]');
		if (avatar) {
			avatar.src = item.avatar || "";
			avatar.alt = item.sellerName || "seller";
		}

		const bind = (selector, value) => {
			const el = card.querySelector(selector);
			if (el) el.textContent = value || "";
		};

		bind('[data-bind="sellerName"]', item.sellerName || "-");
		bind('[data-bind="sellerSub"]', item.sellerSub || "-");
		bind('[data-bind="priceA"]', item.priceA || "-");
		bind('[data-bind="priceB"]', item.priceB || "-");
		bind('[data-bind="priceC"]', item.priceC || "-");
		bind('[data-bind="distance"]', item.distance || "-");
		bind('[data-bind="updateTime"]', item.updateTime || "-");

		const favBtn = card.querySelector('[data-action="toggle-favorite"]');
		if (favBtn) favBtn.classList.add("active");
	}

	function goProfile(card) {
		const name = card.dataset.sellerName || card.querySelector(".seller-name")?.textContent?.trim() || "";
		window.location.href = `../../pages/shared/profile.html?name=${encodeURIComponent(name)}`;
	}

	function goBooking() {
		const role = getRole();
		localStorage.setItem("bookingReferrer", window.location.href);
		window.location.href =
			role === "buyer"
				? "../../pages/buyer/setbooking/booking.html"
				: "../../pages/farmer/booking/booking-step1.html";
	}

	function refreshEmptyState() {
		const hasCard = !!mount.querySelector(".product-card");
		emptyState.hidden = hasCard;
	}

	function removeFavorite(card) {
		const sellerId = String(card.dataset.sellerId || "");
		if (!sellerId) return;

		const next = loadFavorites().filter((item) => String(item.sellerId || "") !== sellerId);
		saveFavorites(next);

		card.remove();
		refreshEmptyState();
	}

	async function render() {
		const role = getRole();
		if (role !== "farmer") {
			mount.innerHTML = "";
			emptyState.hidden = false;
			emptyState.querySelector("p").textContent = "หน้านี้แสดงเฉพาะบัญชี farmer";
			return;
		}

		const items = loadFavorites();
		if (!items.length) {
			mount.innerHTML = "";
			emptyState.hidden = false;
			return;
		}

		const tpl = await loadCardTemplate();

		mount.innerHTML = "";
		items.forEach((item) => {
			const card = tpl.content.firstElementChild.cloneNode(true);
			fillCard(card, item);
			mount.appendChild(card);
		});

		refreshEmptyState();
	}

	mount.addEventListener("click", (e) => {
		const card = e.target.closest(".product-card");
		if (!card) return;

		const actionEl = e.target.closest("[data-action]");
		if (!actionEl) return;

		const action = actionEl.dataset.action;

		if (action === "open-profile") {
			goProfile(card);
			return;
		}

		if (action === "toggle-favorite") {
			e.preventDefault();
			e.stopPropagation();
			removeFavorite(card);
			return;
		}

		if (action === "book") {
			e.preventDefault();
			goBooking();
			return;
		}

		if (action === "contact") {
			e.preventDefault();
			window.location.href = "../../pages/shared/chat.html";
		}
	});

	mount.addEventListener("keydown", (e) => {
		if (e.key !== "Enter") return;

		const actionEl = e.target.closest("[data-action]");
		const card = e.target.closest(".product-card");
		if (!card || !actionEl) return;

		const action = actionEl.dataset.action;
		if (action === "open-profile") goProfile(card);
		if (action === "toggle-favorite") removeFavorite(card);
	});

	render().catch((err) => {
		console.error("allfavorites render error:", err);
		emptyState.hidden = false;
	});
})();
