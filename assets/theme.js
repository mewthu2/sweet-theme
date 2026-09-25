(() => {
  const theme = window.theme || {};
  const root = (window.Shopify && window.Shopify.routes && window.Shopify.routes.root) || theme.routes?.root || '/';

  const cart = {
    drawer() {
      return document.querySelector('[data-cart-drawer]');
    },

    open() {
      const drawer = this.drawer();
      if (!drawer || drawer.open) return;
      drawer.classList.remove('is-open');
      drawer.showModal();
      requestAnimationFrame(() => drawer.classList.add('is-open'));
    },

    close() {
      const drawer = this.drawer();
      if (!drawer || !drawer.open) return;
      drawer.classList.remove('is-open');
      setTimeout(() => drawer.close(), 250);
    },

    updateCount(count) {
      document.querySelectorAll('[data-cart-count]').forEach((el) => {
        el.textContent = count;
      });
    },

    renderSections(sections) {
      const html = sections && sections['cart-drawer'];
      if (!html) return;
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const next = doc.querySelector('[data-cart-drawer-inner]');
      const current = document.querySelector('[data-cart-drawer-inner]');
      if (next && current) current.replaceWith(next);
    },

    async request(url, body) {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ ...body, sections: 'cart-drawer', sections_url: window.location.pathname }),
      });
      const data = await response.json();
      if (!response.ok || data.status) throw new Error(data.description || data.message || theme.strings?.error);
      return data;
    },

    async add(form) {
      const formData = new FormData(form);
      const items = [{ id: Number(formData.get('id')), quantity: Number(formData.get('quantity') || 1) }];
      const data = await this.request(`${root}cart/add.js`, { items });
      this.renderSections(data.sections);
      const state = await fetch(`${root}cart.js`).then((r) => r.json());
      this.updateCount(state.item_count);
      this.open();
    },

    async change(line, quantity) {
      const data = await this.request(`${root}cart/change.js`, { line, quantity });
      this.renderSections(data.sections);
      this.updateCount(data.item_count);
    },
  };

  const showError = (form, message) => {
    let el = form.querySelector('[data-form-error]');
    if (!el) {
      el = document.createElement('p');
      el.className = 'form-error';
      el.setAttribute('role', 'alert');
      el.dataset.formError = '';
      form.append(el);
    }
    el.textContent = message;
  };

  document.addEventListener('submit', async (event) => {
    const form = event.target.closest('[data-product-form]');
    if (!form || theme.cartType === 'page') return;
    event.preventDefault();
    const button = form.querySelector('[type="submit"]');
    button?.setAttribute('aria-busy', 'true');
    form.querySelector('[data-form-error]')?.remove();
    try {
      await cart.add(form);
    } catch (error) {
      showError(form, error.message || theme.strings?.error);
    } finally {
      button?.removeAttribute('aria-busy');
    }
  });

  document.addEventListener('click', async (event) => {
    const opener = event.target.closest('[data-cart-open]');
    if (opener && theme.cartType !== 'page' && cart.drawer()) {
      event.preventDefault();
      cart.open();
      return;
    }

    if (event.target.closest('[data-cart-close]')) {
      event.preventDefault();
      cart.close();
      return;
    }

    const drawer = cart.drawer();
    if (drawer && event.target === drawer) {
      cart.close();
      return;
    }

    const qty = event.target.closest('[data-cart-quantity]');
    if (qty) {
      event.preventDefault();
      const line = Number(qty.dataset.line);
      const quantity = Number(qty.dataset.cartQuantity);
      qty.closest('[data-cart-item]')?.setAttribute('aria-busy', 'true');
      try {
        await cart.change(line, quantity);
      } catch (error) {
        window.alert(error.message);
        qty.closest('[data-cart-item]')?.removeAttribute('aria-busy');
      }
      return;
    }

    const option = event.target.closest('[data-quick-buy] [data-variant-id]');
    if (option) {
      const card = option.closest('[data-quick-buy]');
      const available = option.dataset.variantAvailable === 'true';
      card.querySelectorAll('[data-variant-id]').forEach((el) => el.setAttribute('aria-pressed', String(el === option)));
      card.querySelector('[data-quick-buy-id]').value = option.dataset.variantId;
      card.querySelectorAll('[data-quick-buy-price]').forEach((el) => {
        el.textContent = option.dataset.variantPrice;
      });
      const value = card.querySelector('[data-quick-buy-value]');
      if (value) value.textContent = option.dataset.variantValue;
      const button = card.querySelector('[data-quick-buy-button]');
      if (button) {
        button.disabled = !available;
        if (available) {
          const label = document.createElement('span');
          label.textContent = button.dataset.label;
          const dash = document.createElement('span');
          dash.setAttribute('aria-hidden', 'true');
          dash.textContent = ' - ';
          const price = document.createElement('span');
          price.textContent = option.dataset.variantPrice;
          button.replaceChildren(label, dash, price);
        } else {
          button.textContent = theme.strings.soldOut;
        }
      }
      return;
    }

    const arrow = event.target.closest('[data-carousel-prev], [data-carousel-next]');
    if (arrow) {
      const track = arrow.closest('[data-carousel]')?.querySelector('[data-carousel-track]');
      if (!track) return;
      const direction = arrow.hasAttribute('data-carousel-next') ? 1 : -1;
      track.scrollBy({ left: direction * track.clientWidth * 0.85, behavior: 'smooth' });
      return;
    }

    const tab = event.target.closest('[role="tab"][aria-controls]');
    if (tab && !tab.hasAttribute('href')) selectTab(tab);
  });

  document.addEventListener('keydown', (event) => {
    const tab = event.target.closest('[role="tab"]');
    if (!tab || !['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    const tabs = [...tab.closest('[role="tablist"]').querySelectorAll('[role="tab"]')];
    const index = tabs.indexOf(tab) + (event.key === 'ArrowRight' ? 1 : -1);
    const next = tabs[(index + tabs.length) % tabs.length];
    next.focus();
    selectTab(next);
  });

  document.addEventListener('mouseover', (event) => {
    const tab = event.target.closest('[data-tab-hover] [role="tab"]');
    if (tab) selectTab(tab);
  });

  function selectTab(tab) {
    const list = tab.closest('[role="tablist"]');
    list.querySelectorAll('[role="tab"]').forEach((el) => {
      const selected = el === tab;
      el.setAttribute('aria-selected', String(selected));
      el.tabIndex = selected ? 0 : -1;
      const panel = document.getElementById(el.getAttribute('aria-controls'));
      if (panel) panel.hidden = !selected;
      if (panel && selected) panel.querySelectorAll('[data-carousel-track]').forEach(updateCarouselArrows);
    });
  }

  function updateCarouselArrows(track) {
    const carousel = track.closest('[data-carousel]');
    const prev = carousel.querySelector('[data-carousel-prev]');
    const next = carousel.querySelector('[data-carousel-next]');
    const max = track.scrollWidth - track.clientWidth - 2;
    if (prev) prev.disabled = track.scrollLeft <= 2;
    if (next) next.disabled = track.scrollLeft >= max;
    const progress = carousel.querySelector('[data-carousel-progress]');
    if (progress) {
      const ratio = track.scrollWidth > track.clientWidth ? track.scrollLeft / (track.scrollWidth - track.clientWidth) : 1;
      const size = track.clientWidth / track.scrollWidth;
      progress.style.setProperty('--size', size);
      progress.style.setProperty('--progress', ratio);
    }
  }

  const initCarousels = (scope = document) => {
    scope.querySelectorAll('[data-carousel-track]').forEach((track) => {
      if (track.dataset.ready) return;
      track.dataset.ready = 'true';
      track.addEventListener('scroll', () => updateCarouselArrows(track), { passive: true });
      new ResizeObserver(() => updateCarouselArrows(track)).observe(track);
      updateCarouselArrows(track);
    });
  };

  class AnnouncementBar extends HTMLElement {
    connectedCallback() {
      this.slides = [...this.querySelectorAll('[data-announcement]')];
      if (this.slides.length < 2) return;
      this.index = 0;
      this.timer = setInterval(() => this.next(), Number(this.dataset.speed || 5) * 1000);
      this.addEventListener('mouseenter', () => clearInterval(this.timer));
    }

    disconnectedCallback() {
      clearInterval(this.timer);
    }

    next() {
      this.slides[this.index].hidden = true;
      this.index = (this.index + 1) % this.slides.length;
      this.slides[this.index].hidden = false;
    }
  }

  class VariantPicker extends HTMLElement {
    connectedCallback() {
      const data = this.querySelector('script[type="application/json"]');
      this.variants = data ? JSON.parse(data.textContent) : [];
      this.form = document.getElementById(this.dataset.form);
      this.addEventListener('change', () => this.update());
    }

    update() {
      const selected = [...this.querySelectorAll('fieldset')].map(
        (fieldset) => fieldset.querySelector('input:checked')?.value
      );
      this.querySelectorAll('fieldset').forEach((fieldset, i) => {
        const label = fieldset.querySelector('[data-selected-value]');
        if (label) label.textContent = selected[i];
      });
      const variant = this.variants.find((v) => v.options.every((value, i) => value === selected[i]));
      const section = this.closest('[data-product-section]');
      const button = section.querySelector('[data-add-button]');
      const label = section.querySelector('[data-add-label]');

      if (!variant) {
        button.disabled = true;
        label.textContent = theme.strings.unavailable;
        return;
      }

      this.form.querySelector('input[name="id"]').value = variant.id;
      button.disabled = !variant.available;
      label.textContent = variant.available ? label.dataset.availableLabel || theme.strings.addToCart : theme.strings.soldOut;
      section.querySelectorAll('[data-button-price]').forEach((el) => {
        el.textContent = variant.price;
      });
      section.querySelectorAll('[data-product-price]').forEach((el) => {
        el.innerHTML = variant.price_html;
      });

      const url = new URL(window.location.href);
      url.searchParams.set('variant', variant.id);
      window.history.replaceState({}, '', url);

      if (variant.media_id) {
        const media = section.querySelector(`[data-media-id="${variant.media_id}"]`);
        const track = media?.parentElement;
        if (media && track) track.scrollTo({ left: media.offsetLeft, behavior: 'smooth' });
      }
    }
  }

  class QuantityInput extends HTMLElement {
    connectedCallback() {
      this.input = this.querySelector('input');
      this.addEventListener('click', (event) => {
        const button = event.target.closest('button[data-step]');
        if (!button) return;
        const value = Number(this.input.value || 1) + Number(button.dataset.step);
        this.input.value = Math.max(Number(this.input.min || 1), value);
        this.input.dispatchEvent(new Event('change', { bubbles: true }));
      });
    }
  }

  if (!customElements.get('announcement-bar')) customElements.define('announcement-bar', AnnouncementBar);
  if (!customElements.get('variant-picker')) customElements.define('variant-picker', VariantPicker);
  if (!customElements.get('quantity-input')) customElements.define('quantity-input', QuantityInput);

  initCarousels();
  document.addEventListener('shopify:section:load', (event) => initCarousels(event.target));

  window.theme.cart = cart;
})();
