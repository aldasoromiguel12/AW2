const API_URL = new URL('/api/products', window.location.origin);
const FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1552674605-db6ffd4facb5?auto=format&fit=crop&w=900&q=85';
const productGrid = document.querySelector('#product-grid');
const productCount = document.querySelector('#product-count');
const allProductsCount = document.querySelector('.filter-button[data-category=""] span');
const sortButtons = [...document.querySelectorAll('.sort-button')];
const filterButtons = [...document.querySelectorAll('.filter-button')];
const cartItemsList = document.querySelector('#cart-items');
const headerCartButton = document.querySelector('.header-cart');
const headerCartCount = document.querySelector('#header-cart-count');
const cartItemCount = document.querySelector('#cart-item-count');
const cartSubtotal = document.querySelector('#cart-subtotal');
const cartTotal = document.querySelector('#cart-total');
const checkoutButton = document.querySelector('#checkout-button');
const buyerForm = document.querySelector('#buyer-form');
const checkoutMessage = document.querySelector('#checkout-message');
let productos = [];
let compraEnCurso = false;

function leerCarritoGuardado() {
  try {
    const savedCart = JSON.parse(localStorage.getItem('carrito') || '[]');
    if (!Array.isArray(savedCart)) return [];

    return savedCart
      .filter((item) => item && Number.isInteger(Number(item.id)) && Number.isFinite(Number(item.precio)) && Number.isInteger(Number(item.cantidad)) && Number(item.cantidad) > 0)
      .map((item) => ({ ...item, id: Number(item.id), precio: Number(item.precio), cantidad: Number(item.cantidad) }));
  } catch (error) {
    console.warn('No se pudo recuperar el carrito guardado:', error);
    return [];
  }
}

export let carrito = leerCarritoGuardado();

const priceFormatter = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2
});

function createProductCard(product) {
  const card = document.createElement('article');
  card.className = 'product-card';

  const visual = document.createElement('div');
  visual.className = 'product-visual';

  const image = document.createElement('img');
  image.alt = product.descripcion || product.nombre;
  image.loading = 'lazy';
  image.addEventListener('error', () => {
    if (image.dataset.fallbackApplied) return;
    image.dataset.fallbackApplied = 'true';
    image.src = FALLBACK_IMAGE;
  });
  image.src = product.imagen || FALLBACK_IMAGE;

  const details = document.createElement('div');
  details.className = 'product-details';

  const category = document.createElement('p');
  category.className = 'product-category';
  category.textContent = product.categoria || 'Sin categoría';

  const name = document.createElement('h2');
  name.textContent = product.nombre || 'Producto sin nombre';

  const purchase = document.createElement('div');
  purchase.className = 'product-purchase';

  const price = document.createElement('p');
  price.className = 'product-price';
  price.textContent = priceFormatter.format(Number(product.precio) || 0);

  const addButton = document.createElement('button');
  addButton.type = 'button';
  addButton.className = 'add-button';
  addButton.dataset.id = String(product.id);
  addButton.setAttribute('aria-label', `Añadir ${product.nombre} al carrito`);
  addButton.textContent = 'Añadir al carrito';

  visual.append(image);
  details.append(category, name);
  purchase.append(price, addButton);
  details.append(purchase);
  card.append(visual, details);

  return card;
}

function showGridMessage(message, role = 'status') {
  const state = document.createElement('p');
  state.className = 'product-state';
  state.setAttribute('role', role);
  state.textContent = message;
  productGrid.replaceChildren(state);
}

function renderizarProductos() {
  const sortedProducts = [...productos];
  const sortOrder = document.querySelector('.sort-button.is-selected')?.dataset.sort || 'destacados';

  if (sortOrder === 'precio-asc') {
    sortedProducts.sort((first, second) => Number(first.precio) - Number(second.precio));
  } else if (sortOrder === 'precio-desc') {
    sortedProducts.sort((first, second) => Number(second.precio) - Number(first.precio));
  }

  productGrid.replaceChildren(...sortedProducts.map(createProductCard));
  if (sortedProducts.length === 0) showGridMessage('No hay productos en esta categoría.');
}

function createCartAction(label, action, product, disabled = false) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = action === 'remove' ? 'remove-button' : 'quantity-button';
  button.dataset.cartAction = action;
  button.dataset.id = String(product.id);
  button.disabled = disabled;
  button.setAttribute('aria-label', `${label} ${product.nombre}`);
  button.textContent = action === 'remove' ? '×' : label === 'Aumentar cantidad de' ? '+' : '−';
  return button;
}

function createCartItem(product) {
  const item = document.createElement('li');
  item.className = 'cart-item';

  const image = document.createElement('img');
  image.alt = '';
  image.loading = 'lazy';
  image.addEventListener('error', () => {
    if (image.dataset.fallbackApplied) return;
    image.dataset.fallbackApplied = 'true';
    image.src = FALLBACK_IMAGE;
  });
  image.src = product.imagen || FALLBACK_IMAGE;

  const info = document.createElement('div');
  info.className = 'cart-item-info';

  const name = document.createElement('h3');
  name.textContent = product.nombre || 'Producto sin nombre';

  const category = document.createElement('p');
  category.textContent = product.categoria || 'Producto';

  const quantity = document.createElement('div');
  quantity.className = 'quantity-control';
  quantity.setAttribute('aria-label', `Cantidad: ${product.cantidad}`);
  quantity.append(
    createCartAction('Disminuir cantidad de', 'decrement', product, product.cantidad <= 1)
  );

  const quantityValue = document.createElement('span');
  quantityValue.textContent = String(product.cantidad);
  quantity.append(quantityValue, createCartAction('Aumentar cantidad de', 'increment', product));

  info.append(name, category, quantity);

  const end = document.createElement('div');
  end.className = 'cart-item-end';

  const lineTotal = document.createElement('strong');
  lineTotal.textContent = priceFormatter.format(product.precio * product.cantidad);
  end.append(lineTotal, createCartAction('Eliminar', 'remove', product));

  item.append(image, info, end);
  return item;
}

// Sincroniza el array en memoria con el almacenamiento local del navegador.
export function actualizarLocalStorage() {
  try {
    localStorage.setItem('carrito', JSON.stringify(carrito));
  } catch (error) {
    console.error('No se pudo guardar el carrito:', error);
  }
}

// Actualiza la lista, el subtotal y el contador a partir del estado actual.
export function renderizarCarrito() {
  const itemCount = carrito.reduce((count, product) => count + product.cantidad, 0);
  const subtotal = carrito.reduce((sum, product) => sum + product.precio * product.cantidad, 0);

  headerCartCount.textContent = String(itemCount);
  headerCartButton.setAttribute('aria-label', `Carrito, ${itemCount} artículos`);
  cartItemCount.textContent = `(${itemCount})`;
  cartSubtotal.textContent = priceFormatter.format(subtotal);
  cartTotal.textContent = priceFormatter.format(subtotal);
  checkoutButton.disabled = itemCount === 0 || compraEnCurso;
  cartItemsList.replaceChildren(
    ...(carrito.length ? carrito.map(createCartItem) : [Object.assign(document.createElement('li'), {
      className: 'cart-empty',
      textContent: 'Tu carrito está vacío.'
    })])
  );
}

function mostrarMensajeCompra(message, type = '') {
  checkoutMessage.textContent = message;
  checkoutMessage.classList.toggle('is-success', type === 'success');
  checkoutMessage.classList.toggle('is-error', type === 'error');
}

// Envía la compra y conserva el carrito si el servidor no confirma la orden.
async function finalizarCompra(event) {
  event.preventDefault();
  mostrarMensajeCompra('');

  if (carrito.length === 0) {
    mostrarMensajeCompra('Agrega al menos un producto antes de finalizar la compra.', 'error');
    return;
  }

  if (!buyerForm.reportValidity()) return;

  const nombre = buyerForm.elements.nombre.value.trim();
  const email = buyerForm.elements.email.value.trim();
  if (!nombre || !email) {
    mostrarMensajeCompra('Completa tu nombre y un email válido para continuar.', 'error');
    return;
  }

  const total = carrito.reduce((sum, product) => sum + product.precio * product.cantidad, 0);
  const order = {
    user: { nombre, email },
    items: carrito.map(({ id, nombre: productName, precio, cantidad }) => ({
      id,
      nombre: productName,
      precio,
      cantidad
    })),
    total: Number(total.toFixed(2))
  };

  compraEnCurso = true;
  checkoutButton.disabled = true;
  checkoutButton.setAttribute('aria-busy', 'true');
  mostrarMensajeCompra('Enviando tu orden...');

  try {
    const response = await fetch(new URL('/api/orders', window.location.origin), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(order)
    });

    const result = await response.json().catch(() => ({}));
    if (response.status !== 201 || !result.orderId) {
      throw new Error(result.error || 'No se pudo confirmar la orden. Intenta nuevamente.');
    }

    carrito = [];
    localStorage.removeItem('carrito');
    renderizarCarrito();
    buyerForm.reset();
    mostrarMensajeCompra(`¡Compra realizada con éxito! Tu número de orden es ${result.orderId}.`, 'success');
  } catch (error) {
    console.error('No se pudo finalizar la compra:', error);
    mostrarMensajeCompra(
      error instanceof TypeError
        ? 'No pudimos conectar con el servidor. Revisa tu conexión e intenta nuevamente.'
        : error.message,
      'error'
    );
  } finally {
    compraEnCurso = false;
    checkoutButton.removeAttribute('aria-busy');
    renderizarCarrito();
  }
}

// Agrega el producto del catálogo o incrementa su cantidad si ya está guardado.
export function agregarAlCarrito(productoId) {
  const product = productos.find((item) => String(item.id) === String(productoId));
  if (!product) return;

  const existingProduct = carrito.find((item) => item.id === Number(product.id));
  if (existingProduct) {
    existingProduct.cantidad += 1;
  } else {
    carrito.push({ ...product, id: Number(product.id), precio: Number(product.precio), cantidad: 1 });
  }

  actualizarLocalStorage();
  renderizarCarrito();
}

function cambiarCantidad(productoId, cambio) {
  const product = carrito.find((item) => item.id === Number(productoId));
  if (!product) return;
  product.cantidad = Math.max(1, product.cantidad + cambio);
  actualizarLocalStorage();
  renderizarCarrito();
}

function eliminarDelCarrito(productoId) {
  carrito = carrito.filter((item) => item.id !== Number(productoId));
  actualizarLocalStorage();
  renderizarCarrito();
}

export async function cargarProductos(categoria = '') {
  productGrid.setAttribute('aria-busy', 'true');
  showGridMessage('Cargando productos...');

  try {
    const url = new URL(API_URL);
    if (categoria) url.searchParams.set('category', categoria);

    const response = await fetch(url);
    if (!response.ok) throw new Error(`Error HTTP ${response.status}`);

    const products = await response.json();
    if (!Array.isArray(products)) throw new Error('La respuesta de productos no es válida');

    productos = products;
    renderizarProductos();
    productCount.textContent = String(products.length).padStart(2, '0');
    if (!categoria) allProductsCount.textContent = String(products.length).padStart(2, '0');
  } catch (error) {
    console.error('No se pudieron cargar los productos:', error);
    showGridMessage('No se pudieron cargar los productos. Intenta nuevamente.', 'alert');
  } finally {
    productGrid.setAttribute('aria-busy', 'false');
  }
}

filterButtons.forEach((button) => {
  button.addEventListener('click', () => {
    filterButtons.forEach((filterButton) => {
      const isSelected = filterButton === button;
      filterButton.classList.toggle('is-selected', isSelected);
      filterButton.setAttribute('aria-pressed', String(isSelected));
    });

    cargarProductos(button.dataset.category || '');
  });
});

sortButtons.forEach((button) => {
  button.addEventListener('click', () => {
    sortButtons.forEach((sortButton) => {
      const isSelected = sortButton === button;
      sortButton.classList.toggle('is-selected', isSelected);
      sortButton.setAttribute('aria-pressed', String(isSelected));
    });

    renderizarProductos();
  });
});

productGrid.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-id]');
  if (button) agregarAlCarrito(button.dataset.id);
});

cartItemsList.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-cart-action]');
  if (!button) return;

  const productId = button.dataset.id;
  if (button.dataset.cartAction === 'increment') cambiarCantidad(productId, 1);
  if (button.dataset.cartAction === 'decrement') cambiarCantidad(productId, -1);
  if (button.dataset.cartAction === 'remove') eliminarDelCarrito(productId);
});

buyerForm.addEventListener('submit', finalizarCompra);

renderizarCarrito();
cargarProductos();