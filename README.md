# Tienda Ritmo y API

Aplicación de tienda con frontend estático servido por Express y API REST. El catálogo se lee desde `data/productos.json`; el carrito se guarda en el navegador y las órdenes se almacenan en `data/pedidos.json`.

Las órdenes guardan una copia del nombre y email del comprador, los productos, precios vigentes, cantidades, total, fecha y estado inicial `pendiente`. El endpoint valida los productos, el stock disponible y el total calculado desde el catálogo. Las órdenes pendientes no descuentan stock; las ventas registradas por `/api/ventas` sí lo hacen.

## Cómo iniciar el servidor

En la terminal, dentro de la carpeta del proyecto, ejecutar:

```bash
npm install
npm start
```

El servidor funciona en:

```text
http://localhost:3000
```

La tienda se abre en `http://localhost:3000`. Para ejecutar las pruebas automatizadas:

```bash
npm test
```

Las pruebas usan una copia temporal de los datos y no modifican los archivos reales de `data/`.

## Rutas usadas por la tienda

| Método | Ruta | Qué hace |
|---|---|---|
| GET | `/api/products` | Lista todos los productos. |
| GET | `/api/products?category=Accesorios` | Filtra por categoría, sin distinguir mayúsculas. |
| POST | `/api/orders` | Valida y guarda una orden en `data/pedidos.json`. |

Body para crear una orden desde Postman o Thunder Client:

```json
{
  "user": {
    "nombre": "Ana Pérez",
    "email": "ana@example.com"
  },
  "items": [
    { "id": 1, "cantidad": 2 }
  ],
  "total": 49998
}
```

La API responde `201` con `success`, `orderId`, `message` y el total validado. Rechaza órdenes vacías, datos del comprador inválidos, productos inexistentes, cantidades no válidas, falta de stock o totales que no coinciden con los precios actuales.

## Rutas de la API existente

Para probar POST, PUT y DELETE se puede usar Postman o Thunder Client.

## Rutas de productos

| Método | Ruta | Qué hace |
|---|---|---|
| GET | `/api/productos` | Muestra todos los productos. |
| GET | `/api/productos/:id` | Muestra un producto por su ID. |
| POST | `/api/productos` | Crea un producto nuevo. Recibe sus datos en el body. |
| PUT | `/api/productos/:id` | Modifica un producto existente. |
| DELETE | `/api/productos/:id` | Elimina un producto si no está usado en una venta. |

Body para crear un producto:

```json
{
  "nombre": "Botella deportiva",
  "descripcion": "Botella reutilizable",
  "categoria": "Accesorios",
  "precio": 12000,
  "stock": 10,
  "imagen": "https://example.com/botella.jpg"
}
```

## Rutas de usuarios

| Método | Ruta | Qué hace |
|---|---|---|
| GET | `/api/usuarios` | Muestra todos los usuarios sin mostrar sus passwords. |
| GET | `/api/usuarios/:id` | Muestra un usuario por su ID. |
| POST | `/api/usuarios` | Crea un usuario nuevo. Recibe sus datos en el body. |
| POST | `/api/usuarios/login` | Comprueba email y password recibidos en el body. |
| PUT | `/api/usuarios/:id` | Modifica un usuario existente. |
| DELETE | `/api/usuarios/:id` | Elimina un usuario solo si no tiene ventas asociadas. |

Body para iniciar sesión:

```json
{
  "email": "maria.gonzalez@example.com",
  "password": "P4ssw0rd!"
}
```

El campo `telefono` es un string.
## Rutas de ventas

| Método | Ruta | Qué hace |
|---|---|---|
| GET | `/api/ventas` | Muestra todas las ventas. |
| GET | `/api/ventas/:id` | Muestra una venta por su ID. |
| POST | `/api/ventas` | Crea una venta y descuenta el stock de los productos. |
| PUT | `/api/ventas/:id` | Modifica una venta existente. |
| DELETE | `/api/ventas/:id` | Elimina una venta. |

Body para crear una venta:

```json
{
  "id_usuario": 1,
  "direccion": {
    "calle": "Calle Nueva",
    "numero": 100,
    "ciudad": "Buenos Aires",
    "codigoPostal": "1000"
  },
  "productos": [
    { "id_producto": 1, "cantidad": 2 }
  ],
  "pagado": false
}
```


