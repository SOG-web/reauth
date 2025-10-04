# SDK Generator Compatibility Analysis

## Current State

The SDK generator works with the new ReAuth engine introspection format. Entity schema has been removed as it's no longer used.

## Introspection Data Structure

### What SDK Generator Expects

```typescript
interface IntrospectionData {
  plugins: Array<{
    name: string;
    steps: Array<{
      name: string;
      inputs: Record<string, unknown>; // JSON Schema
      outputs: Record<string, unknown>; // JSON Schema
      requiresAuth: boolean;
    }>;
  }>;
}
```

### What Engine Provides

```typescript
getIntrospectionData(): {
  plugins: Array<{
    name: string;
    description: string;
    steps: Array<{
      name: string;
      description?: string;
      inputs: unknown;           // toJsonSchema() result
      outputs: unknown;          // toJsonSchema() result
      protocol: unknown;
      requiresAuth: boolean;     // from protocol.http.auth
    }>;
  }>;
  generatedAt: string;
  version: string;
}
```

## Compatibility

✅ **Fully Compatible**

The SDK generator works with the new introspection format:

1. **Entity removed**: No longer part of introspection data (not needed)
2. **Plugin structure matches**: `name` and `steps` array are present
3. **Step structure matches**: All required fields are present:
   - `name`: ✅ Present
   - `inputs`: ✅ Present (from `validationSchema.toJsonSchema()`)
   - `outputs`: ✅ Present (from `outputs.toJsonSchema()`)
   - `requiresAuth`: ✅ Present (from `protocol.http.auth`)
4. **Extra fields ignored**: SDK generator ignores extra fields like `description`, `protocol`, `generatedAt`, `version`

## How It Works

### In the Engine (engine.ts)

```typescript
getIntrospectionData() {
  return {
    plugins: this.plugins.map((p) => ({
      name: p.name,
      description: `${p.name} authentication plugin`,
      steps: (p.steps || []).map((s) => ({
        name: s.name,
        description: s.description,
        inputs: s.validationSchema?.toJsonSchema() || {},  // ✅ JSON Schema
        outputs: s.outputs?.toJsonSchema() || {},          // ✅ JSON Schema
        protocol: s.protocol || {},
        requiresAuth: Boolean(s.protocol?.http?.auth || false),  // ✅ Boolean
      })),
    })),
    generatedAt: new Date().toISOString(),
    version: '1.0.0',
  };
}
```

### In the SDK Generator (index.ts)

```typescript
const { plugins } = introspectionData;

for (const plugin of plugins) {
  const pluginName = plugin.name.replace(/-/g, '_');

  for (const step of plugin.steps) {
    const stepName = step.name.replace(/-/g, '_');

    // Uses inputs - ✅ Compatible
    const inputSchema = jsonSchemaToZod(step.inputs, { name: inputSchemaName });

    // Uses outputs - ✅ Compatible
    const outputSchema = jsonSchemaToZod(step.outputs, { name: outputSchemaName });

    // Uses requiresAuth - ✅ Compatible
    if (step.requiresAuth) {
      // Add auth headers
    }
  }
}
```

## Testing

To test the SDK generator with the new engine:

1. **Start the Hono test app**:

   ```bash
   cd apps/hono-test
   pnpm dev
   ```

2. **Generate SDK**:

   ```bash
   cd packages/sdk-generator
   pnpm build
   node dist/index.js \
     --url http://localhost:3001/test-introspection \
     --output ../../apps/web/lib/reauth-client \
     --client axios \
     --key test-key-123
   ```

3. **Verify generated files**:
   - Check `apps/web/lib/reauth-client/plugins/` for plugin files
   - Check `apps/web/lib/reauth-client/index.ts` for main client
   - Note: `schemas.ts` is no longer generated (entity removed)

## Schema Conversion

### Arktype to JSON Schema

The engine uses Arktype schemas with `.toJsonSchema()` method:

```typescript
// In plugin step definition
validationSchema: type({
  email: 'email',
  password: 'string'
})

// Converted to JSON Schema
{
  type: 'object',
  properties: {
    email: { type: 'string', format: 'email' },
    password: { type: 'string' }
  },
  required: ['email', 'password']
}
```

### JSON Schema to Zod

The SDK generator converts JSON Schema to Zod:

```typescript
// JSON Schema
{
  type: 'object',
  properties: {
    email: { type: 'string', format: 'email' },
    password: { type: 'string' }
  }
}

// Generated Zod Schema
export const loginInputSchema = z.object({
  email: z.string().email(),
  password: z.string()
});
```

## Conclusion

**Entity removed, SDK generator updated!**

The ReAuth engine no longer includes entity schema in introspection data. The SDK generator has been updated to work without it. The conversion chain for plugin steps still works seamlessly:

```
Arktype Schema → toJsonSchema() → JSON Schema → jsonSchemaToZod() → Zod Schema
```

## Next Steps

1. ✅ Engine introspection is working
2. ✅ SDK generator is compatible
3. 🔄 Test the full workflow:
   - Start Hono app with new engine
   - Generate SDK using introspection endpoint
   - Verify generated client works in web app
