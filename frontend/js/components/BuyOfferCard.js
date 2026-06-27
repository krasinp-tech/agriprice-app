/**
 * <buy-offer-card> Web Component
 */
class BuyOfferCard extends HTMLElement {
  constructor() {
    super();
  }

  connectedCallback() {
    this.render();
  }

  static get observedAttributes() {
    return ['title', 'price', 'unit', 'category', 'image', 'buyer-name', 'buyer-avatar', 'distance'];
  }

  attributeChangedCallback() {
    this.render();
  }

  render() {
    const title = this.getAttribute('title') || 'ไม่ระบุชื่อ';
    const price = this.getAttribute('price') || '0';
    const unit = this.getAttribute('unit') || 'กก.';
    const category = this.getAttribute('category') || '';
    const image = this.getAttribute('image') || '../../assets/images/default.png';
    const buyerName = this.getAttribute('buyer-name') || 'พ่อค้า';
    const buyerAvatar = this.getAttribute('buyer-avatar') || '../../assets/images/avatar-buyer.svg';
    const distance = this.getAttribute('distance') || '';

    this.innerHTML = `
      <div class="offer-card" style="view-transition-name: offer-${this.getAttribute('id')};">
        <div class="offer-image">
          <img src="${image}" alt="${title}" loading="lazy">
          <span class="offer-category">${category}</span>
        </div>
        <div class="offer-content">
          <div class="offer-buyer">
            <img src="${buyerAvatar}" class="buyer-avatar">
            <span class="buyer-name">${buyerName}</span>
          </div>
          <h3 class="offer-title">${title}</h3>
          <div class="offer-footer">
            <div class="offer-price">
              <span class="price-val">${price}</span>
              <span class="price-unit">฿/${unit}</span>
            </div>
            ${distance ? `<span class="offer-distance">${distance}</span>` : ''}
          </div>
        </div>
      </div>
    `;
  }
}

customElements.define('buy-offer-card', BuyOfferCard);
