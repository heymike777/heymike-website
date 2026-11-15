const currency = new Intl.NumberFormat('en-US', {
  style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1,
});

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
    })
    .catch(() => {
      current.textContent = 'Unavailable';
      peak.title = `${peak.title}. Live refresh unavailable`;
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
