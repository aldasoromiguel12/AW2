# API de productos, usuarios y ventas

Este proyecto es un servidor: recibe pedidos y devuelve datos en formato JSON.

Los datos se guardan en los archivos de la carpeta `data/`.

> Importante: este proyecto usa ES modules (`"type": "module"` en `package.json`). El código está escrito con sintaxis ES6/import-export y no con CommonJS.

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

Para probar las rutas GET se puede usar el navegador. Para probar POST, PUT y DELETE se puede usar Postman o Thunder Client.

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

El servidor calcula el total de la venta y verifica que existan el usuario y los productos.

## Respuestas frecuentes

- `200`: operación correcta.
- `201`: registro creado.
- `400`: datos enviados incorrectos.
- `401`: email o password incorrectos.
- `404`: no se encontró el recurso.
- `409`: no se puede realizar la operación por una relación existente o un dato repetido.
