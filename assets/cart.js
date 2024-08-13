class CartRemoveButton extends HTMLElement {
  constructor() {
    super();

    this.addEventListener('click', (event) => {
      event.preventDefault();
      const cartItems = this.closest('cart-items') || this.closest('cart-drawer-items');
      cartItems.updateQuantity(this.dataset.index, 0);
    });
  }
}

customElements.define('cart-remove-button', CartRemoveButton);

class CartItems extends HTMLElement {
  constructor() {
    super();
    this.lineItemStatusElement =
      document.getElementById('shopping-cart-line-item-status') || document.getElementById('CartDrawer-LineItemStatus');

    const debouncedOnChange = debounce((event) => {
      this.onChange(event);
    }, ON_CHANGE_DEBOUNCE_TIMER);

    this.addEventListener('change', debouncedOnChange.bind(this));
  }

  cartUpdateUnsubscriber = undefined;

  connectedCallback() {
    this.cartUpdateUnsubscriber = subscribe(PUB_SUB_EVENTS.cartUpdate, (event) => {
      if (event.source === 'cart-items') {
        return;
      }
      this.onCartUpdate();
    });
  }

  disconnectedCallback() {
    if (this.cartUpdateUnsubscriber) {
      this.cartUpdateUnsubscriber();
    }
  }

  resetQuantityInput(id) {
    const input = this.querySelector(`#Quantity-${id}`);
    input.value = input.getAttribute('value');
    this.isEnterPressed = false;
  }

  setValidity(event, index, message) {
    event.target.setCustomValidity(message);
    event.target.reportValidity();
    this.resetQuantityInput(index);
    event.target.select();
  }

  validateQuantity(event) {
    const inputValue = parseInt(event.target.value);
    const index = event.target.dataset.index;
    let message = '';

    if (inputValue < event.target.dataset.min) {
      message = window.quickOrderListStrings.min_error.replace('[min]', event.target.dataset.min);
    } else if (inputValue > parseInt(event.target.max)) {
      message = window.quickOrderListStrings.max_error.replace('[max]', event.target.max);
    } else if (inputValue % parseInt(event.target.step) !== 0) {
      message = window.quickOrderListStrings.step_error.replace('[step]', event.target.step);
    }

    if (message) {
      this.setValidity(event, index, message);
    } else {
      event.target.setCustomValidity('');
      event.target.reportValidity();
      this.updateQuantity(
        index,
        inputValue,
        document.activeElement.getAttribute('name'),
        event.target.dataset.quantityVariantId
      );
    }
  }

  onChange(event) {
    this.validateQuantity(event);
  }

  onCartUpdate() {
    if (this.tagName === 'CART-DRAWER-ITEMS') {
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
        });
    } else {
      fetch(`${routes.cart_url}?section_id=main-cart-items`)
        .then((response) => response.text())
        .then((responseText) => {
          const html = new DOMParser().parseFromString(responseText, 'text/html');
          const sourceQty = html.querySelector('cart-items');
          this.innerHTML = sourceQty.innerHTML;
        })
        .catch((e) => {
          console.error(e);
        });
    }
  }

  /**
   * Render cart gifts based on the cart total value, threshold, utm_medium and enabled status
   */
  renderCartGifts() {
    const cartGiftEl = document.querySelector('.drawer__cart-gifts');
    const cartTotalValue = document.querySelector('.drawer__footer .totals__total-value').innerHTML.replace('$', '').split('.')[0]

    const urlUtmMedium = new URLSearchParams(window.location.search).get('utm_medium') || sessionStorage.getItem('utm_medium');
    const giftEls = cartGiftEl?.querySelectorAll('.select-btn')
    const { cartTotal, cartGiftsThreshold, enabled, productList, utmMedium } = window.cartGifts;  
    const currCartTotal = Number(cartTotalValue) || cartTotal;
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
        //  this.updateQuantity()
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
      // if all items are removed from the cart, remove the gift from the cart and reset cart state to empty
      if (response.item_count === 0) { 
        this.updateQuantity(0, 0);
      }
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
  
  getSectionsToRender() {
    return [
      {
        id: 'main-cart-items',
        section: document.getElementById('main-cart-items').dataset.id,
        selector: '.js-contents',
      },
      {
        id: 'cart-icon-bubble',
        section: 'cart-icon-bubble',
        selector: '.shopify-section',
      },
      {
        id: 'cart-live-region-text',
        section: 'cart-live-region-text',
        selector: '.shopify-section',
      },
      {
        id: 'main-cart-footer',
        section: document.getElementById('main-cart-footer').dataset.id,
        selector: '.js-contents',
      },
    ];
  }

  updateQuantity(line, quantity, name, variantId) {
    this.enableLoading(line);
    console.log('Updating quantity', line, quantity, name, variantId);
    const body = JSON.stringify({
      line,
      quantity,
      sections: this.getSectionsToRender().map((section) => section.section),
      sections_url: window.location.pathname,
    });

    fetch(`${routes.cart_change_url}`, { ...fetchConfig(), ...{ body } })
      .then((response) => {
        return response.text();
      })
      .then((state) => {
        const parsedState = JSON.parse(state);
        const quantityElement =
          document.getElementById(`Quantity-${line}`) || document.getElementById(`Drawer-quantity-${line}`);
        const items = document.querySelectorAll('.cart-item');

        if (parsedState.errors) {
          quantityElement.value = quantityElement.getAttribute('value');
          this.updateLiveRegions(line, parsedState.errors);
          return;
        }

        this.classList.toggle('is-empty', parsedState.item_count === 0);
        const cartDrawerWrapper = document.querySelector('cart-drawer');
        const cartFooter = document.getElementById('main-cart-footer');

        if (cartFooter) cartFooter.classList.toggle('is-empty', parsedState.item_count === 0);
        if (cartDrawerWrapper) cartDrawerWrapper.classList.toggle('is-empty', parsedState.item_count === 0);

        this.getSectionsToRender().forEach((section) => {
          const elementToReplace =
            document.getElementById(section.id).querySelector(section.selector) || document.getElementById(section.id);
          elementToReplace.innerHTML = this.getSectionInnerHTML(
            parsedState.sections[section.section],
            section.selector
          );
        });
        const updatedValue = parsedState.items[line - 1] ? parsedState.items[line - 1].quantity : undefined;
        let message = '';
        if (items.length === parsedState.items.length && updatedValue !== parseInt(quantityElement.value)) {
          if (typeof updatedValue === 'undefined') {
            message = window.cartStrings.error;
          } else {
            message = window.cartStrings.quantityError.replace('[quantity]', updatedValue);
          }
        }
        this.updateLiveRegions(line, message);

        const lineItem =
          document.getElementById(`CartItem-${line}`) || document.getElementById(`CartDrawer-Item-${line}`);
        if (lineItem && lineItem.querySelector(`[name="${name}"]`)) {
          cartDrawerWrapper
            ? trapFocus(cartDrawerWrapper, lineItem.querySelector(`[name="${name}"]`))
            : lineItem.querySelector(`[name="${name}"]`).focus();
        } else if (parsedState.item_count === 0 && cartDrawerWrapper) {
          trapFocus(cartDrawerWrapper.querySelector('.drawer__inner-empty'), cartDrawerWrapper.querySelector('a'));
        } else if (document.querySelector('.cart-item') && cartDrawerWrapper) {
          trapFocus(cartDrawerWrapper, document.querySelector('.cart-item__name'));
        }

        publish(PUB_SUB_EVENTS.cartUpdate, { source: 'cart-items', cartData: parsedState, variantId: variantId });
        this.renderCartGifts()
      })
      .catch(() => {
        this.querySelectorAll('.loading__spinner').forEach((overlay) => overlay.classList.add('hidden'));
        const errors = document.getElementById('cart-errors') || document.getElementById('CartDrawer-CartErrors');
        errors.textContent = window.cartStrings.error;
      })
      .finally(() => {
        this.disableLoading(line);
      });
  }

  updateLiveRegions(line, message) {
    const lineItemError =
      document.getElementById(`Line-item-error-${line}`) || document.getElementById(`CartDrawer-LineItemError-${line}`);
    if (lineItemError) lineItemError.querySelector('.cart-item__error-text').textContent = message;

    this.lineItemStatusElement.setAttribute('aria-hidden', true);

    const cartStatus =
      document.getElementById('cart-live-region-text') || document.getElementById('CartDrawer-LiveRegionText');
    cartStatus.setAttribute('aria-hidden', false);

    setTimeout(() => {
      cartStatus.setAttribute('aria-hidden', true);
    }, 1000);
  }

  getSectionInnerHTML(html, selector) {
    return new DOMParser().parseFromString(html, 'text/html').querySelector(selector).innerHTML;
  }

  enableLoading(line) {
    const mainCartItems = document.getElementById('main-cart-items') || document.getElementById('CartDrawer-CartItems');
    mainCartItems.classList.add('cart__items--disabled');

    const cartItemElements = this.querySelectorAll(`#CartItem-${line} .loading__spinner`);
    const cartDrawerItemElements = this.querySelectorAll(`#CartDrawer-Item-${line} .loading__spinner`);

    [...cartItemElements, ...cartDrawerItemElements].forEach((overlay) => overlay.classList.remove('hidden'));

    document.activeElement.blur();
    this.lineItemStatusElement.setAttribute('aria-hidden', false);
  }

  disableLoading(line) {
    const mainCartItems = document.getElementById('main-cart-items') || document.getElementById('CartDrawer-CartItems');
    mainCartItems.classList.remove('cart__items--disabled');

    const cartItemElements = this.querySelectorAll(`#CartItem-${line} .loading__spinner`);
    const cartDrawerItemElements = this.querySelectorAll(`#CartDrawer-Item-${line} .loading__spinner`);

    cartItemElements.forEach((overlay) => overlay.classList.add('hidden'));
    cartDrawerItemElements.forEach((overlay) => overlay.classList.add('hidden'));
  }
}

customElements.define('cart-items', CartItems);

if (!customElements.get('cart-note')) {
  customElements.define(
    'cart-note',
    class CartNote extends HTMLElement {
      constructor() {
        super();

        this.addEventListener(
          'input',
          debounce((event) => {
            const body = JSON.stringify({ note: event.target.value });
            fetch(`${routes.cart_update_url}`, { ...fetchConfig(), ...{ body } });
          }, ON_CHANGE_DEBOUNCE_TIMER)
        );
      }
    }
  );
}
