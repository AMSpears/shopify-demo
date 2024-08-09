document.addEventListener('DOMContentLoaded', () => {
  const cartGiftEl = document.querySelector('.drawer__cart-gifts');
  const urlUtmMedium = new URLSearchParams(window.location.search).get('utm_medium') || sessionStorage.getItem('utm_medium');
  
  if (urlUtmMedium) {
    // save utm_medium to sessionStorage so that it persist on page reload if it exists at the beginning
    sessionStorage.setItem('utm_medium', urlUtmMedium);
  }

  const { cartTotal, cartGiftsThreshold, enabled, productList, utmMedium } = window.cartGifts;   
  const showGiftList = (Number(cartGiftsThreshold) && Number(cartGiftsThreshold) >= Number(cartTotal)) || enabled || (utmMedium && urlUtmMedium === utmMedium);

  if (productList.length > 0 && showGiftList) {
    cartGiftEl.classList.remove('hidden');
  } else {
    cartGiftEl.classList.add('hidden');
  }

  /**
   * TODO:
   * 1. Add the logic to remove gift from the cart if the cart if threshold exists and is not met
   * 2. Add carousel logic
   * 3. Style carousel
   * 
   */
});