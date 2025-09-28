import {
  generateKeyPair,
  SignJWT,
  importJWK,
  exportJWK,
  JWTPayload,
} from 'jose';
import { FumaClient, JWKSKeys } from '../types';

export async function getJWKS(db: FumaClient, id: string): Promise<JWKSKeys> {
  const version = await db.version();
  const orm = db.orm(version);

  const jwks = await orm.findFirst('reauth_jwks', {
    where: (b: any) => b('id', '=', id),
  });

  if (!jwks) {
    const { publicKey, privateKey } = await generateKeyPair('RS256');

    const pubK = JSON.stringify(await exportJWK(publicKey));
    const priK = JSON.stringify(await exportJWK(privateKey));

    await orm.create('reauth_jwks', {
      id,
      public_key: pubK,
      private_key: priK,
    });

    return { publicKey, privateKey, new: true };
  }

  const publicKey = await importJWK(
    JSON.parse(jwks.public_key as string),
    'RS256',
  );
  const privateKey = await importJWK(
    JSON.parse(jwks.private_key as string),
    'RS256',
  );

  return { publicKey, privateKey };
}

export async function signJWT(
  payload: JWTPayload,
  privateKey: CryptoKey | Uint8Array<ArrayBufferLike>,
  issuer: string,
  clientId: string,
  expTime: string | number | Date,
) {
  const jwt = await new SignJWT(payload)
    .setProtectedHeader({ alg: 'RS256' })
    .setIssuer(issuer)
    .setAudience(clientId)
    .setIssuedAt()
    .setExpirationTime(expTime)
    .sign(privateKey);

  return jwt;
}
