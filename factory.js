const currency = new Intl.NumberFormat('en-US', {
  style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1,
});

function renderPriceChart(card, history) {
  const chart = card.querySelector('[data-chart]');
  const changeLabel = card.querySelector('[data-chart-change]');
  const rangeLabel = card.querySelector('[data-chart-range]');
  const points = Array.isArray(history)
    ? history.filter(point => Array.isArray(point) && Number.isFinite(point[0]) && Number.isFinite(point[1]) && point[1] > 0)
    : [];

  if (points.length < 2) {
    chart.textContent = 'Price history is not available yet.';
    chart.classList.add('chart-message');
    return;
  }

  const prices = points.map(point => point[1]);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const spread = max - min || max * 0.1;
  const width = 600;
  const height = 180;
  const pad = 12;
  const coordinates = points.map((point, index) => ({
    x: pad + index * (width - pad * 2) / (points.length - 1),
    y: height - pad - (point[1] - min) / spread * (height - pad * 2),
  }));
  const line = coordinates.map((point, index) => `${index ? 'L' : 'M'}${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(' ');
  const last = coordinates.at(-1);
  const area = `${line} L${last.x.toFixed(1)} ${height} L${pad} ${height} Z`;
  const change = (prices.at(-1) / prices[0] - 1) * 100;
  const date = timestamp => new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(timestamp * 1000));

  changeLabel.textContent = `${change >= 0 ? '+' : ''}${change.toFixed(1)}%`;
  changeLabel.classList.toggle('chart-down', change < 0);
  rangeLabel.textContent = `${date(points[0][0])} — ${date(points.at(-1)[0])} · daily close`;
  chart.classList.remove('chart-message');
  chart.innerHTML = `<svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" role="img" aria-label="Token price trend over the last ${points.length} days, ${change >= 0 ? 'up' : 'down'} ${Math.abs(change).toFixed(1)} percent"><path class="chart-area" d="${area}"/><path class="chart-line" d="${line}"/><circle class="chart-endpoint" cx="${last.x.toFixed(1)}" cy="${last.y.toFixed(1)}" r="5"/></svg>`;
}

for (const card of document.querySelectorAll('.launch-card[data-token]')) {
  const address = card.dataset.token;
  const current = card.querySelector('[data-market-cap]');
  const peak = card.querySelector('[data-peak-cap]');

  fetch(`/api/factory-market?token=${encodeURIComponent(address)}`)
    .then(response => {
      if (!response.ok) throw new Error('Market data unavailable');
      return response.json();
    })
    .then(data => {
      current.textContent = Number.isFinite(data.marketCap) ? currency.format(data.marketCap) : 'Unavailable';
      peak.textContent = Number.isFinite(data.peakMarketCap) ? currency.format(data.peakMarketCap) : 'Unavailable';
      peak.title = `Estimated from on-chain DEX candles. Highest day: ${data.peakCandleUtc.slice(0, 10)} UTC`;
      renderPriceChart(card, data.priceHistory);
    })
    .catch(() => {
      current.textContent = 'Unavailable';
      peak.title = `${peak.title}. Live refresh unavailable`;
      const chart = card.querySelector('[data-chart]');
      chart.textContent = 'Chart temporarily unavailable. View the full chart instead.';
      chart.classList.add('chart-message');
    });
}

for (const button of document.querySelectorAll('button[data-copy]')) {
  button.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(button.dataset.copy);
      const label = button.getAttribute('aria-label');
      button.setAttribute('aria-label', 'Contract address copied');
      button.querySelector('span').textContent = '✓';
      setTimeout(() => {
        button.setAttribute('aria-label', label);
        button.querySelector('span').textContent = '↗';
      }, 2000);
    } catch {
      button.setAttribute('aria-label', 'Copy failed; select the address manually');
    }
  });
}
