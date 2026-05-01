/**
 * AGRIPRICE Dashboard Pro Logic
 */

document.addEventListener('DOMContentLoaded', () => {
  const backBtn = document.getElementById('backBtn');
  
  if (backBtn) {
    backBtn.addEventListener('click', () => {
      window.history.back();
    });
  }

  // Handle Period Tabs
  const periodTabs = document.querySelectorAll('.period-tab');
  periodTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      periodTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      // Here you would fetch new data based on period
    });
  });

  // Render Doughnut Chart
  renderDonutChart();
});

function renderDonutChart() {
  const ctx = document.getElementById('bookingSummaryChart');
  if (!ctx) return;

  // We are recreating the look of the "Booking Summary" doughnut chart
  // from the design (Red rounded segments with gaps).
  
  new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Completed', 'Empty', 'Empty2', 'Empty3', 'Empty4'],
      datasets: [{
        data: [25, 25, 25, 25], 
        backgroundColor: [
          '#ef4444', // Red 
          '#ef4444', 
          '#ef4444', 
          '#ef4444'
        ],
        borderWidth: 8,
        borderColor: '#ffffff', // Create gaps
        hoverOffset: 4,
        borderRadius: 20 // Rounded ends
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '75%', // Thickness of the ring
      plugins: {
        legend: {
          display: false // We use custom HTML legend
        },
        tooltip: {
          enabled: false
        }
      },
      layout: {
        padding: 10
      }
    }
  });
}
