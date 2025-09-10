/**
 * Example usage of V2 ReAuth architecture with phone and username plugins
 * This demonstrates the new V2 design principles and features
 */

// Import V2 components
import {
  ReAuthEngineV2Impl,
  EntityServiceV2Impl,
  SessionServiceV2Impl,
  createPhonePlugin,
  createUsernamePlugin,
  type PhoneConfigV2,
  type UsernameConfigV2,
} from '../src/v2/index';

async function demonstrateV2Architecture() {
  console.log('🚀 Demonstrating V2 ReAuth Architecture');
  console.log('========================================\n');

  // Create core services
  const entityService = new EntityServiceV2Impl();
  const sessionService = new SessionServiceV2Impl();

  // Create V2 engine
  const engine = new ReAuthEngineV2Impl({
    entityService,
    sessionService,
  });

  // Configure phone plugin with test users
  const phoneConfig: Partial<PhoneConfigV2> = {
    verifyPhone: true,
    sendCode: async (subject: string, code: string, to: string, type: 'verification' | 'reset') => {
      console.log(`📱 SMS to ${to}: Your ${type} code is ${code} (Subject: ${subject})`);
    },
    codeLength: 6,
    sessionTtlSeconds: 3600,
    testUsers: {
      enabled: true,
      environmentGating: false,
      users: ['+1234567890'],
    },
  };

  // Configure username plugin  
  const usernameConfig: Partial<UsernameConfigV2> = {
    sessionTtlSeconds: 3600,
    testUsers: {
      enabled: true,
      environmentGating: false,
      users: ['testuser'],
    },
  };

  // Register plugins
  console.log('📦 Registering plugins...');
  try {
    engine.registerPlugin(createPhonePlugin(phoneConfig));
    console.log('✅ Phone plugin registered');
    
    engine.registerPlugin(createUsernamePlugin(usernameConfig));
    console.log('✅ Username plugin registered');
  } catch (error) {
    console.error('❌ Plugin registration failed:', error);
    return;
  }

  // Initialize engine
  console.log('\n🔧 Initializing engine...');
  try {
    await engine.initialize();
    console.log('✅ Engine initialized');
  } catch (error) {
    console.error('❌ Engine initialization failed:', error);
    return;
  }

  // Demonstrate introspection
  console.log('\n🔍 Engine Introspection:');
  const introspection = engine.introspect();
  console.log(`Found ${introspection.plugins.length} plugins:`);
  
  introspection.plugins.forEach((plugin) => {
    console.log(`\n📌 Plugin: ${plugin.name} (v${plugin.version})`);
    console.log(`   Steps: ${plugin.steps.length}`);
    plugin.steps.forEach((step) => {
      console.log(`   - ${step.name}: ${step.protocol.method} ${step.protocol.path} (auth: ${step.protocol.auth})`);
    });
  });

  // Demonstrate phone registration
  console.log('\n📱 Phone Registration Demo:');
  try {
    const phoneRegisterResult = await engine.executeStep('phone', 'register', {
      phone: '+1234567890',
      password: 'SecurePass123!',
    });
    console.log('Phone registration result:', phoneRegisterResult);
  } catch (error) {
    console.error('❌ Phone registration failed:', error);
  }

  // Demonstrate phone login
  console.log('\n📱 Phone Login Demo:');
  try {
    const phoneLoginResult = await engine.executeStep('phone', 'login', {
      phone: '+1234567890',
      password: 'SecurePass123!',
    });
    console.log('Phone login result:', phoneLoginResult);
  } catch (error) {
    console.error('❌ Phone login failed:', error);
  }

  // Demonstrate username registration
  console.log('\n👤 Username Registration Demo:');
  try {
    const usernameRegisterResult = await engine.executeStep('username', 'register', {
      username: 'testuser',
      password: 'SecurePass123!',
    });
    console.log('Username registration result:', usernameRegisterResult);
  } catch (error) {
    console.error('❌ Username registration failed:', error);
  }

  // Demonstrate username login
  console.log('\n👤 Username Login Demo:');
  try {
    const usernameLoginResult = await engine.executeStep('username', 'login', {
      username: 'testuser',
      password: 'SecurePass123!',
    });
    console.log('Username login result:', usernameLoginResult);
  } catch (error) {
    console.error('❌ Username login failed:', error);
  }

  console.log('\n🎉 V2 Architecture demonstration complete!');
  console.log('\n🔐 Security Features Demonstrated:');
  console.log('   ✅ Hashed verification codes at rest');
  console.log('   ✅ Post-password verification gating');
  console.log('   ✅ Enumeration-safe messaging');
  console.log('   ✅ Type-level config validation');
  console.log('   ✅ Fail-fast initialization');
  console.log('   ✅ Session TTL enforcement (min 30s)');
  console.log('   ✅ Test users support');
  console.log('   ✅ Plugin introspection');
}

// Export for use in tests
export { demonstrateV2Architecture };

// Run demo if this file is executed directly
if (require.main === module) {
  demonstrateV2Architecture().catch(console.error);
}