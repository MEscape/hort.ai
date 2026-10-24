import { createSign, generateKeyPairSync } from 'node:crypto';
import { createRequire } from 'node:module';

/**
 * A throw-away certificate chain shaped like Amazon's (leaf with SAN echo-api.amazon.com under a CA), generated per
 * test run so no key is ever committed. node-forge is the library the ASK SDK itself uses; it is loaded through
 * Node's require so the test touches the very instance the SDK validates with.
 */
interface ForgeAttribute {
  readonly name: string;
  readonly value: string;
}
interface ForgeCertificate {
  publicKey: unknown;
  serialNumber: string;
  readonly validity: { notBefore: Date; notAfter: Date };
  setSubject(attributes: readonly ForgeAttribute[]): void;
  setIssuer(attributes: readonly ForgeAttribute[]): void;
  setExtensions(extensions: readonly object[]): void;
  sign(key: unknown, digest: unknown): void;
}
interface ForgeCaStore {
  addCertificate(certificate: string): void;
}
interface Forge {
  readonly pki: {
    createCertificate(): ForgeCertificate;
    privateKeyFromPem(pem: string): unknown;
    publicKeyFromPem(pem: string): unknown;
    certificateToPem(certificate: ForgeCertificate): string;
    createCaStore(certificates: readonly unknown[]): ForgeCaStore;
  };
  readonly md: { readonly sha256: { create(): unknown } };
}

export const forge = createRequire(import.meta.url)('node-forge') as Forge;

const DAY_MS = 86_400_000;

function keyPair() {
  const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  return {
    privatePem: privateKey.export({ type: 'pkcs8', format: 'pem' }),
    publicPem: publicKey.export({ type: 'spki', format: 'pem' }),
  };
}

function certificate(options: {
  readonly serial: string;
  readonly subject: string;
  readonly issuer: string;
  readonly publicPem: string;
  readonly signingPrivatePem: string;
  readonly extensions: readonly object[];
}): string {
  const cert = forge.pki.createCertificate();
  cert.publicKey = forge.pki.publicKeyFromPem(options.publicPem);
  cert.serialNumber = options.serial;
  cert.validity.notBefore = new Date(Date.now() - DAY_MS);
  cert.validity.notAfter = new Date(Date.now() + DAY_MS);
  cert.setSubject([{ name: 'commonName', value: options.subject }]);
  cert.setIssuer([{ name: 'commonName', value: options.issuer }]);
  cert.setExtensions(options.extensions);
  cert.sign(forge.pki.privateKeyFromPem(options.signingPrivatePem), forge.md.sha256.create());
  return forge.pki.certificateToPem(cert);
}

export interface TestCertificateChain {
  /** Leaf followed by the CA, as Amazon serves it. */
  readonly chainPem: string;
  readonly caPem: string;
  /** `Signature-256` header value for a body, signed with the leaf key. */
  sign(body: string): string;
}

export function createTestCertificateChain(): TestCertificateChain {
  const ca = keyPair();
  const leaf = keyPair();
  const caPem = certificate({
    serial: '01',
    subject: 'hort test CA',
    issuer: 'hort test CA',
    publicPem: ca.publicPem,
    signingPrivatePem: ca.privatePem,
    extensions: [
      { name: 'basicConstraints', cA: true },
      { name: 'keyUsage', keyCertSign: true, digitalSignature: true },
    ],
  });
  const leafPem = certificate({
    serial: '02',
    subject: 'echo-api.amazon.com',
    issuer: 'hort test CA',
    publicPem: leaf.publicPem,
    signingPrivatePem: ca.privatePem,
    extensions: [{ name: 'subjectAltName', altNames: [{ type: 2, value: 'echo-api.amazon.com' }] }],
  });
  return {
    chainPem: `${leafPem}\n${caPem}`,
    caPem,
    sign: (body) => createSign('RSA-SHA256').update(body, 'utf8').sign(leaf.privatePem, 'base64'),
  };
}
