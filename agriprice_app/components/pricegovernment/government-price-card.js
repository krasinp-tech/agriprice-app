/* components/pricegovernment/government-price-card.js */
(function () {
  function getQuery(name) {
    return new URLSearchParams(window.location.search).get(name);
  }

  const commodityParam = getQuery("commodity") || "ทุเรียน";
  const commodity = commodityParam.replace(/\s+\d+$/, "");

  const backBtn = document.getElementById("backBtn");
  const commodityTag = document.getElementById("commodityTag");
  const dateTag = document.getElementById("dateTag");
  const stateEl = document.getElementById("state");
  const tableWrap = document.getElementById("tableWrap");

  if (backBtn) backBtn.addEventListener("click", () => window.history.back());

  commodityTag.textContent = commodity;

  function setLoading(text) {
    stateEl.innerHTML = `<div class="loading">${text || "กำลังโหลด..."}</div>`;
  }
  function setError(text) {
    stateEl.innerHTML = `<div class="error">${text || "โหลดข้อมูลไม่สำเร็จ"}</div>`;
  }
  function clearState() { stateEl.innerHTML = ""; }

  function renderTable(data) {
    const unit = data.unit || "-";
    tableWrap.innerHTML = `
      <table class="price-table" aria-label="Government price table">
        <thead>
          <tr>
            <th style="width:40%">สายพันธุ์</th>
            <th>ต่ำสุด (${unit})</th>
            <th>สูงสุด (${unit})</th>
            <th>เฉลี่ย (${unit})</th>
          </tr>
        </thead>
        <tbody>
          ${data.rows.map(r => `
            <tr>
              <td>${r.variety || "-"}</td>
              <td>${r.min ?? "-"}</td>
              <td>${r.max ?? "-"}</td>
              <td>${r.avg ?? "-"}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    `;
  }

  async function load() {
    try {
      setLoading("กำลังโหลดราคาจำลอง...");
      
      // Wait briefly to ensure mock-prices.js has loaded
      const db = await new Promise((resolve) => {
        if (window.__GOV_MOCK_DB__) {
          resolve(window.__GOV_MOCK_DB__);
        } else {
          // Fallback: wait up to 1 second for mock data
          let attempts = 0;
          const interval = setInterval(() => {
            attempts++;
            if (window.__GOV_MOCK_DB__) {
              clearInterval(interval);
              resolve(window.__GOV_MOCK_DB__);
            } else if (attempts > 10) {
              clearInterval(interval);
              resolve({});
            }
          }, 100);
        }
      });

      const data = db[commodity] || db[commodityParam];

      if (!data) {
        clearState();
        dateTag.textContent = "";
        const availableCommodities = Object.keys(db).join(", ") || "ไม่มีข้อมูล";
        setError(`ยังไม่มีข้อมูลจำลองของ "${commodity}"<br>ลองเลือก: ${availableCommodities}`);
        tableWrap.innerHTML = "";
        return;
      }

      clearState();
      dateTag.textContent = `อัปเดต: ${data.date}`;
      renderTable(data);
    } catch (e) {
      console.error(e);
      setError("เกิดข้อผิดพลาดในการแสดงผล");
    }
  }

  load();
})();
