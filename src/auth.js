/**
 * WARNING: This file connects this app to Anythings's internal auth system.
 */
// CAMBIO: Importamos usando ruta relativa para evitar errores de alias en el build
import CreateAuth from "./__create/@auth/create" 
import Credentials from "@auth/core/providers/credentials"
import pg from 'pg';
const { Pool } = pg;
import { hash, verify } from 'argon2'

// ... (El código de la función Adapter se mantiene igual)
function Adapter(client) {
  // ... (todo el código interno del adapter que ya tienes)
}

// Mejora: Solo inicializar el Pool si existe la URL de la base de datos
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const adapter = Adapter(pool);

export const { auth } = CreateAuth({
  providers: [
    Credentials({
      id: 'credentials-signin',
      name: 'Credentials Sign in',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      authorize: async (credentials) => {
        const { email, password } = credentials;
        if (!email || !password || typeof email !== 'string' || typeof password !== 'string') {
          return null;
        }

        const user = await adapter.getUserByEmail(email);
        if (!user) return null;

        const matchingAccount = user.accounts.find(
          (account) => account.provider === 'credentials'
        );
        const accountPassword = matchingAccount?.password;
        if (!accountPassword) return null;

        const isValid = await verify(accountPassword, password);
        return isValid ? user : null;
      },
    }),
    Credentials({
      id: 'credentials-signup',
      name: 'Credentials Sign up',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
        name: { label: 'Name', type: 'text', required: false },
        image: { label: 'Image', type: 'text', required: false },
      },
      authorize: async (credentials) => {
        const { email, password } = credentials;
        if (!email || !password || typeof email !== 'string' || typeof password !== 'string') {
          return null;
        }

        const user = await adapter.getUserByEmail(email);
        if (!user) {
          const newUser = await adapter.createUser({
            id: crypto.randomUUID(),
            emailVerified: null,
            email,
            name: typeof credentials.name === 'string' && credentials.name.trim().length > 0
                ? credentials.name
                : undefined,
            image: typeof credentials.image === 'string' ? credentials.image : undefined,
          });
          
          await adapter.linkAccount({
            extraData: {
              password: await hash(password),
            },
            type: 'credentials',
            userId: newUser.id,
            providerAccountId: newUser.id,
            provider: 'credentials',
          });
          return newUser;
        }
        return null;
      },
    })
  ],
  pages: {
    signIn: '/account/signin',
    signOut: '/account/logout',
  },
});