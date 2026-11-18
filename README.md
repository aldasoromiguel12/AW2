# Tienda Ritmo y API

Aplicación de tienda con frontend estático servido por Express y API REST. Productos, usuarios, ventas y pedidos se persisten en MongoDB mediante Mongoose. Los archivos de `data/` se conservan como fuente de importación inicial; el servidor no los usa como almacenamiento en tiempo de ejecución. El carrito sigue guardándose en el navegador.

Las órdenes guardan una copia del usuario autenticado, los productos, precios vigentes, cantidades, total, fecha y estado inicial `pendiente`. La API valida productos, disponibilidad y total. Las órdenes pendientes no descuentan stock; las ventas registradas por `/api/ventas` sí lo hacen.

## Configuración e inicio

1. Instala las dependencias con `npm install`.
2. Copia `.env.example` a `.env` y configura `MONGO_URI` y un `JWT_SECRET` aleatorio de al menos 32 caracteres. No subas `.env` al repositorio.
3. Inicia MongoDB localmente o configura una URI de MongoDB Atlas.
4. Importa los datos existentes una sola vez:

   ```bash
   npm run migrate:json
   ```

   La importación es idempotente por identificador: agrega documentos que todavía no existan y no sobrescribe documentos ya importados. Los passwords de texto plano de los JSON se guardan como hashes bcrypt. Los hashes `scrypt` existentes se verifican durante el login y se actualizan a bcrypt después de una autenticación válida. Conserva los JSON originales como respaldo.
5. Inicia la aplicación:

   ```bash
   npm start
   ```

El servidor funciona en `http://localhost:3000`. Las pruebas ejecutan MongoDB aislado en memoria con `npm test`.

### Ejecutar localmente sin instalar MongoDB

Para desarrollo o demostración, se puede usar el servidor MongoDB local basado en `mongodb-memory-server`:

```bash
npm run start:local
```

Este comando importa los JSON al iniciar y guarda los datos de MongoDB en `.local-mongodb/`, que se conserva entre ejecuciones y no se sube al repositorio. Requiere que las dependencias de desarrollo estén instaladas (`npm install`). Para despliegues o uso compartido, configura una instancia real con `npm start`.

En VS Code también se puede iniciar desde **Terminal > Run Task > Iniciar tienda (MongoDB + Express)**. Una vez que aparezca el mensaje de servidor iniciado, **Go Live** sirve `public/` y reenvía las peticiones `/api` al backend en el puerto 3000. No abras la carpeta raíz del proyecto con Live Server.

## Rutas usadas por la tienda

| Método | Ruta | Acceso | Qué hace |
|---|---|---|---|
| GET | `/api/products` | Público | Lista productos; acepta `?category=Accesorios`. |
| POST | `/api/usuarios` | Público | Registra una cuenta. |
| POST | `/api/usuarios/login` | Público | Comprueba las credenciales y devuelve un JWT válido por una hora. |
| POST | `/api/orders` | JWT | Valida y guarda una orden del usuario autenticado. |

El checkout permite iniciar sesión o crear una cuenta. El frontend guarda el token durante la sesión del navegador y lo envía en `Authorization: Bearer <token>`. El servidor toma el nombre y email del usuario autenticado; no confía en la identidad enviada en el body.

Body para iniciar sesión:

```json
{                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   
  "email": "ana@example.com",
  "password": "ClaveSegura2026"
}
```

Body para crear una orden (requiere `Authorization: Bearer <token>`):

```json
{
  "items": [
    { "id": 1, "cantidad": 2 }
  ],
  "total": 49998
}
```

La API responde `201` con `success`, `orderId`, `message` y el total validado. Rechaza órdenes vacías, productos inexistentes, cantidades no válidas, falta de stock o totales que no coinciden con los precios actuales.

## Rutas de productos

| Método | Ruta | Acceso | Qué hace |
|---|---|---|---|
| GET | `/api/productos` | Público | Muestra todos los productos. |
| GET | `/api/productos/:id` | Público | Muestra un producto por su ID. |
| POST | `/api/productos` | JWT | Crea un producto. |
| PUT | `/api/productos/:id` | JWT | Modifica un producto. |
| DELETE | `/api/productos/:id` | JWT | Elimina un producto si no está usado en una venta. |

## Rutas de usuarios

| Método | Ruta | Acceso | Qué hace |
|---|---|---|---|
| GET | `/api/usuarios` | JWT | Muestra usuarios sin passwords. |
| GET | `/api/usuarios/:id` | JWT del propietario | Muestra el perfil propio. |
| POST | `/api/usuarios` | Público | Crea una cuenta y guarda el password con bcrypt. |
| POST | `/api/usuarios/login` | Público | Verifica las credenciales y devuelve un JWT. |
| PUT | `/api/usuarios/:id` | JWT del propietario | Modifica el perfil o password propio. |
| DELETE | `/api/usuarios/:id` | JWT del propietario | Elimina el usuario si no tiene ventas asociadas. |

El email debe tener un formato válido y se guarda en minúsculas. El password debe tener entre 8 y 128 caracteres e incluir letras y números. El teléfono es opcional, de hasta 30 caracteres. No se devuelven passwords ni hashes en las respuestas. Las rutas administrativas de productos y ventas requieren autenticación; el proyecto todavía no define roles.

## Rutas de ventas

| Método | Ruta | Acceso | Qué hace |
|---|---|---|---|
| GET | `/api/ventas` | JWT | Muestra las ventas. |
| GET | `/api/ventas/:id` | JWT del propietario | Muestra una venta propia. |
| POST | `/api/ventas` | JWT | Crea una venta para el usuario autenticado y descuenta stock. |
| PUT | `/api/ventas/:id` | JWT del propietario | Modifica una venta propia. |
| DELETE | `/api/ventas/:id` | JWT del propietario | Elimina una venta propia. |

Las peticiones protegidas deben incluir el encabezado:

```text
Authorization: Bearer <token>
```
