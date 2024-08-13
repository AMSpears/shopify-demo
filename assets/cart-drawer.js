class CartDrawer extends HTMLElement {
  constructor() {
    super();

    this.addEventListener('keyup', (evt) => evt.code === 'Escape' && this.close());
    this.querySelector('#CartDrawer-Overlay').addEventListener('click', this.close.bind(this));
    this.setHeaderCartIconAccessibility();
  }

  setHeaderCartIconAccessibility() {
    const cartLink = document.querySelector('#cart-icon-bubble');
    if (!cartLink) return;

    cartLink.setAttribute('role', 'button');
    cartLink.setAttribute('aria-haspopup', 'dialog');
    cartLink.addEventListener('click', (event) => {
      event.preventDefault();
      this.open(cartLink);
    });
    cartLink.addEventListener('keydown', (event) => {
      if (event.code.toUpperCase() === 'SPACE') {
        event.preventDefault();
        this.open(cartLink);
      }
    });
  }

  open(triggeredBy) {
    if (triggeredBy) this.setActiveElement(triggeredBy);
    const cartDrawerNote = this.querySelector('[id^="Details-"] summary');
    if (cartDrawerNote && !cartDrawerNote.hasAttribute('role')) this.setSummaryAccessibility(cartDrawerNote);
    // here the animation doesn't seem to always get triggered. A timeout seem to help
    setTimeout(() => {
      this.classList.add('animate', 'active');
    });

    this.addEventListener(
      'transitionend',
      () => {
        const containerToTrapFocusOn = this.classList.contains('is-empty')
          ? this.querySelector('.drawer__inner-empty')
          : document.getElementById('CartDrawer');
        const focusElement = this.querySelector('.drawer__inner') || this.querySelector('.drawer__close');
        trapFocus(containerToTrapFocusOn, focusElement);
      },
      { once: true }
    );

    this.renderCartGifts()
    document.body.classList.add('overflow-hidden');
  }

  close() {
    this.classList.remove('active');
    removeTrapFocus(this.activeElement);
    document.body.classList.remove('overflow-hidden');
  }

  setSummaryAccessibility(cartDrawerNote) {
    cartDrawerNote.setAttribute('role', 'button');
    cartDrawerNote.setAttribute('aria-expanded', 'false');

    if (cartDrawerNote.nextElementSibling.getAttribute('id')) {
      cartDrawerNote.setAttribute('aria-controls', cartDrawerNote.nextElementSibling.id);
    }

    cartDrawerNote.addEventListener('click', (event) => {
      event.currentTarget.setAttribute('aria-expanded', !event.currentTarget.closest('details').hasAttribute('open'));
    });

    cartDrawerNote.parentElement.addEventListener('keyup', onKeyUpEscape);
  }

  renderContents(parsedState) {
    this.querySelector('.drawer__inner').classList.contains('is-empty') &&
      this.querySelector('.drawer__inner').classList.remove('is-empty');
    this.productId = parsedState.id;
    this.getSectionsToRender().forEach((section) => {
      const sectionElement = section.selector
        ? document.querySelector(section.selector)
        : document.getElementById(section.id);

      if (!sectionElement) return;
      sectionElement.innerHTML = this.getSectionInnerHTML(parsedState.sections[section.id], section.selector);
    });

    setTimeout(() => {
      this.querySelector('#CartDrawer-Overlay').addEventListener('click', this.close.bind(this));
      this.open();
    });
  }

  getSectionInnerHTML(html, selector = '.shopify-section') {
    return new DOMParser().parseFromString(html, 'text/html').querySelector(selector).innerHTML;
  }

  getSectionsToRender() {
    return [
      {
        id: 'cart-drawer',
        selector: '#CartDrawer',
      },
      {
        id: 'cart-icon-bubble',
      },
    ];
  }

  getSectionDOM(html, selector = '.shopify-section') {
    return new DOMParser().parseFromString(html, 'text/html').querySelector(selector);
  }

  setActiveElement(element) {
    this.activeElement = element;
  }

    /**
   * Render cart gifts based on the cart total value, threshold, utm_medium and enabled status
   */
  renderCartGifts() {
    const cartGiftEl = document.querySelector('.drawer__cart-gifts');
    const cartTotalValue = document.querySelector('.drawer__footer .totals__total-value')?.innerHTML.replace('$', '').split('.')[0]

    const urlUtmMedium = new URLSearchParams(window.location.search).get('utm_medium') || sessionStorage.getItem('utm_medium');
    const giftEls = cartGiftEl?.querySelectorAll('.select-btn')
    const { cartTotal, cartGiftsThreshold, enabled, productList, utmMedium } = window.cartGifts;  
    const currCartTotal = cartTotalValue ? Number(cartTotalValue) : cartTotal;
    const showGiftList = (cartGiftsThreshold && Number(cartGiftsThreshold) <= Number(currCartTotal)) || enabled || (utmMedium && urlUtmMedium === utmMedium);

    if (urlUtmMedium) {
      // save utm_medium to sessionStorage so that it persist on page reload if it exists at the beginning
      sessionStorage.setItem('utm_medium', urlUtmMedium);
    }
    // Remove gift from cart if a cartGiftsThreshold and the threshold is no longer met 
    if (productList.length > 0 && showGiftList) {
      cartGiftEl?.classList.remove('hidden');

      giftEls?.forEach((giftEl) => {
        const variantId = giftEl.dataset.variantId;
        const spanEl = giftEl.querySelector('span');
        giftEl.addEventListener('click', (e) => {
          this.updateCartData(variantId, giftEls, currCartTotal)
          giftEl.classList.add('selected');
          spanEl.innerText = 'Selected'
        })
      })
    } else {
      // Remove gift from cart if a cartGiftsThreshold and the threshold is no longer met
      this.updateCartData(null, giftEls, currCartTotal)
      cartGiftEl?.classList.add('hidden');
    }

    // if all items are removed from the cart, remove the gift from the cart
    if (Number(cartTotalValue) === 0) {
      this.updateCartData(null, giftEls, 0)
      cartGiftEl?.classList.add('hidden');
    }

    this.initCartGiftsSlider();
    this.refreshCartDrawer(); 
  }

   /**
  * Initialize the cart gifts slider
  */
  initCartGiftsSlider() {
    const swiper = new Swiper('.drawer__cart-gifts .swiper', {
      direction: 'horizontal',
      slidesPerView: 1.4,
      draggable: true,

      navigation: {
        nextEl: '.swiper-button-next',
        prevEl: '.swiper-button-prev',
      },
    });

    swiper.on('init', function() {
      console.log('Swiper initialized', swiper);
    });
  }

    /**
   *  Update the cart data based on the selected gift
   * @param {*} variantId 
   * @param {*} giftEls 
   * @param {*} cartTotal 
   */
  updateCartData(variantId, giftEls, cartTotal) {
    fetch('/cart.js')
    .then((response) => response.json())
    .then((cart) => {
      let existingGift = null;
      const giftElsVariantIds = Array.from(giftEls).map((el) => el.dataset.variantId);
      const {cartGiftsThreshold} = window.cartGifts;

      // Find the existing gift item in the cart
      for (let i = 0; i < cart.items.length; i++) {
        const cartItemVariantId = cart.items[i].variant_id.toString();
        if (giftElsVariantIds.includes(cartItemVariantId)) {
          existingGift = cart.items[i];
          break;
        }
      }

      if (cartTotal === 0) {
        // if all items are removed from the cart, remove the gift from the cart
        this.removeGiftFromCart(existingGift.variant_id)
        return
      }

      if (!variantId && (cartTotal < Number(cartGiftsThreshold)) ) {
        // If the cart total is less than the threshold, remove the gift
        if (existingGift && existingGift.variant_id) {
          this.removeGiftFromCart(existingGift.variant_id)
          return
        }
      }

      if (existingGift && existingGift.variant_id !== variantId) {
        // If a different gift is selected, remove the existing one first
        this.removeGiftFromCart(existingGift.variant_id, () => {
          // After removing, add the new gift
          if (variantId) {
            this.addGiftToCart(variantId);
          }
        })
      } else {
        // If no gift is present, add the selected gift
        this.addGiftToCart(variantId);
      }
      // update the ui to reflect the selected gift
       giftEls.forEach((el) => {
        const giftItemVariantId = el.dataset.variantId;
        const spanEl = el.querySelector('span');
        if (giftItemVariantId === variantId) {
          el.classList.add('selected');
          spanEl.textContent = 'Selected'; 
        } else {
          el.classList.remove('selected');
          spanEl.textContent = 'Select';
        }
       })
    })
    .catch((e) => {
      console.error("Unable to fetch cart data", e);
    });
  }
  /**
   * Add gift item to the cart
   * @param {*} productVariantId 
   * @returns 
   */
  addGiftToCart(productVariantId) {
    if (!productVariantId) {
      console.log('Invalid product variant id');
      return;
    }

    fetch('/cart/add.js', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        items: [
          {
            id: productVariantId,
            quantity: 1,

          },
        ],
      }),
    })
    .then((response) => response.json())
    .then((response) => {
      console.log("Gift Item added to the cart");
      this.refreshCartDrawer()
    })
    .catch((e) => {
      console.error("Unable to add Gift item to the cart", e);
    })
  }

    /**
   * Remove gift item from the cart
   * @param {*} productVariantId 
   * @param {*} callback 
   */
  removeGiftFromCart(productVariantId, callback){
    fetch('/cart/update.js', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        updates: {
          [productVariantId]: 0,
        },
      }),
    })
    .then((response) => response.json())
    .then((response) => {
      console.log("Gift Item removed from the cart");
      this.refreshCartDrawer()
      if (callback && typeof callback === 'function') {
        callback();
      }
    })
    .catch((e) => {
      console.error("Unable to remove gift item from the cart", e);
    })
  };

  /**
   * Refresh the cart drawer 
   */
  refreshCartDrawer() {
    fetch(`${routes.cart_url}?section_id=cart-drawer`)
    .then((response) => response.text())
    .then((responseText) => {
      const html = new DOMParser().parseFromString(responseText, 'text/html');
      const selectors = ['cart-drawer-items', '.cart-drawer__footer'];
      for (const selector of selectors) {
        const targetElement = document.querySelector(selector);
        const sourceElement = html.querySelector(selector);

        if (targetElement && sourceElement) {
          targetElement.replaceWith(sourceElement);
        }
      }
    })
    .catch((e) => {
      console.error(e);
    }).catch((e) => {
      console.error("Unable to fetch cart", e);
    });
  };
}

customElements.define('cart-drawer', CartDrawer);

class CartDrawerItems extends CartItems {
  getSectionsToRender() {
    return [
      {
        id: 'CartDrawer',
        section: 'cart-drawer',
        selector: '.drawer__inner',
      },
      {
        id: 'cart-icon-bubble',
        section: 'cart-icon-bubble',
        selector: '.shopify-section',
      },
    ];
  }
}

customElements.define('cart-drawer-items', CartDrawerItems);
