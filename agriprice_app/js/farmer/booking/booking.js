// ===== mock data (อนาคตเปลี่ยนเป็น fetch API ได้เลย) =====
const MOCK_BOOKINGS = [
  {
    bookingId: "BK240115001",
    status: "success", // waiting | success | cancel
    shopName: "ล้งก้องพันธุ์ไทย นายแดง",
    address: "ตลาดเสรีพร 2 อาคาร1 (ใต้) 123 ถนนหลังสวน อ.พระโขนง นนท 10110",
    queueNo: "A-004",
    time: "14:30",
    createdAt: "2026-02-12 13:55",
  },
  {
    bookingId: "BK240115002",
    status: "waiting",
    shopName: "ล้งผลไม้บ้านสวน",
    address: "88/1 ถนนสายผลไม้ อ.เมือง จ.จันทบุรี 22000",
    queueNo: "B-012",
    time: "15:10",
    createdAt: "2026-02-12 14:05",
  },
  {
    bookingId: "BK240115003",
    status: "cancel",
    shopName: "ล้งทุเรียนป่าลั่น",
    address: "77/7 อ.ท่าใหม่ จ.จันทบุรี 22120",
    queueNo: "C-003",
    time: "10:00",
    createdAt: "2026-02-11 09:12",
  },
];

async function fetchBookings() {
  // อนาคต: return fetch('/api/bookings').then(r => r.json())
  return new Promise((resolve) => setTimeout(() => resolve(MOCK_BOOKINGS), 120));
}

function mapStatusText(status) {
  if (status === "waiting") return "รอคิว";
  if (status === "success") return "สำเร็จ";
  if (status === "cancel") return "ยกเลิก";
  return "ไม่ทราบสถานะ";
}

function renderCard(b) {
  const badgeClass = b.status;
  const statusText = mapStatusText(b.status);

  return `
    <article class="booking-card" data-id="${b.bookingId}">
      <div class="row">
        <div class="shop">${b.shopName}</div>
        <div class="badge ${badgeClass}">${statusText}</div>
      </div>

      <div class="meta">
        เลขที่การจอง: <b>${b.bookingId}</b><br/>
        เวลานัดคิว: <b>${b.time} น.</b>
      </div>

      <div class="queueBox">
        <div>
          <div class="queueLabel">หมายเลขคิวของคุณ</div>
          <div class="queueNo">${b.queueNo}</div>
        </div>
        <div class="meta" style="text-align:right;">
          <div style="opacity:.7;font-size:12px;">วันที่ทำรายการ</div>
          <div><b>${b.createdAt}</b></div>
        </div>
      </div>

      <div class="cta">
        <button class="btn" type="button" data-open>
          ดูรายละเอียด
        </button>
      </div>
    </article>
  `;
}

(function init() {
  // ไม่ใช้ topbar แล้ว - ลบออก
  
  setActiveBottomNav("booking");

  const listEl = document.getElementById("bookingList");
  const emptyEl = document.getElementById("emptyState");
  const searchEl = document.getElementById("searchInput");

  let all = [];
  // อ่าน filter เริ่มต้นจาก query string เพื่อ support redirect หลังยกเลิก
  const urlParams = new URLSearchParams(window.location.search);
  let filter = urlParams.get("filter") || "all";
  if (filter) {
    document.querySelectorAll(".seg-btn").forEach((b) => {
      b.classList.toggle("active", b.dataset.filter === filter);
    });
  }
  let keyword = "";

  function apply() {
    const k = keyword.trim().toLowerCase();
    const filtered = all.filter((b) => {
      const passFilter = filter === "all" ? true : b.status === filter;
      const passSearch =
        !k ||
        b.bookingId.toLowerCase().includes(k) ||
        b.shopName.toLowerCase().includes(k) ||
        b.queueNo.toLowerCase().includes(k);
      return passFilter && passSearch;
    });

    listEl.innerHTML = filtered.map(renderCard).join("");
    emptyEl.hidden = filtered.length !== 0;

    // Delegated click handler: ไปหน้า detail เฉพาะเมื่อกดปุ่ม [data-open]
    // ใช้ assignment เพื่อหลีกเลี่ยงการผูก listener ซ้ำเวลาเรียก apply() หลายครั้ง
    listEl.onclick = function (e) {
      const open = e.target.closest("[data-open]");
      if (!open) return; // ไม่ต้องทำอะไรถ้าไม่กดปุ่มดูรายละเอียด

      const card = e.target.closest(".booking-card");
      if (!card) return;

      const id = card.dataset.id;
      if (!id) return;

      // บันทึกข้อมูลการจองปัจจุบันไว้เพื่อให้ step4 โหลดได้
      try {
        const item = all.find((b) => b.bookingId === id);
        if (item) {
          const copy = { ...item, fromList: true };
          localStorage.setItem("confirmedBooking", JSON.stringify(copy));
          // เก็บ slot/time/อื่นๆ ในกรณีของฟอร์มจองด้วย
          if (copy.slotId) localStorage.setItem("bookingSlotId", copy.slotId);
          if (copy.timeSlot) localStorage.setItem("bookingTimeSlot", JSON.stringify(copy.timeSlot));
        }
      } catch (_){ }

      // ✅ บันทึก referrer เพื่อให้ step4 รู้ว่ากลับมาจากไหน
      localStorage.setItem("bookingReferrer", window.location.href);

      // ไปหน้ารายละเอียดการจอง (step4)
      window.location.href = `booking-step4.html?bookingId=${encodeURIComponent(id)}`;
    };
  }

  document.querySelectorAll(".seg-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".seg-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      filter = btn.dataset.filter;
      apply();
    });
  });

  searchEl.addEventListener("input", () => {
    keyword = searchEl.value;
    apply();
  });

  fetchBookings().then((data) => {
    all = Array.isArray(data) ? data.slice() : [];

    // ถ้าไม่มีข้อมูลจาก API ให้ใส่ MOCK_BOOKINGS สำหรับการทดสอบ/ดีโม
    if (!all.length) {
      all = MOCK_BOOKINGS.slice();
      console.log("[Bookings] No bookings from API — using MOCK_BOOKINGS for demo");
    }

    apply();
  });
})();