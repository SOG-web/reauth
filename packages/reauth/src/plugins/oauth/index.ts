import oauthPlugin from './plugin';

export * from './plugin';
export * from './types';
export * from './utils';
export * from './schema';
export * from './steps/start.step';
export * from './steps/callback.step';
export * from './steps/link.step';
export * from './steps/unlink.step';

// Providers
export * from './providers/google';
export * from './providers/github';
export * from './providers/discord';
export * from './providers/facebook';
export * from './providers/twitter';
export * from './providers/linkedin';
export * from './providers/microsoft';
export * from './providers/apple';
export * from './providers/spotify';
export * from './providers/twitch';
export * from './providers/auth0';

export default oauthPlugin;
